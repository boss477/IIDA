"""
Flask app: serves floor plan viewer + /api/analyze via Fireworks Kimi vision.
  pip install -r requirements.txt
  Set FIREWORKS_API_KEY and/or FIREWORKS_API_KEY_FALLBACK in .env (see .env.example)
  npm run build && python app.py
  open http://127.0.0.1:5173
"""
import json
import os
import re
from pathlib import Path
from typing import Optional

import requests
from flask import Flask, Response, jsonify, request, send_from_directory

ROOT_DIR = Path(__file__).resolve().parent
DIST_DIR = ROOT_DIR / "dist"

app = Flask(__name__, static_folder=None)

ANALYZE_USER_TEXT = (
    "Extract structural walls (outer shell + interior partitions as centerlines with thickness, "
    "NOT room edges), room floor polygons for every visible bounded space including closets/laundry/mech, "
    "windows on exterior walls, room labels with dimensionsText when printed on the plan, calibration "
    "segments for horizontal width and vertical height when dimensions are printed, and furniture. "
    "Trace room polygons along inner wall corners with multiple vertices per room—avoid 4-point bounding boxes. "
    "Preserve exact aspect ratio and stepped/angled geometry. Output one compact valid JSON object only "
    "(no trailing commas, no markdown)."
)

REFINE_BOX_ROOMS_TEXT = (
    "REFINEMENT: Your previous output used too many 4-corner rectangular room polygons. "
    "Re-output the complete JSON. For each room, trace the inner wall boundary with enough vertices "
    "(usually 6–12+) to capture corners, L-shapes, and recesses. Minimize rooms that have only 4 points."
)

FIREWORKS_API_BASE = "https://api.fireworks.ai/inference/v1"
FIREWORKS_CHAT_URL = f"{FIREWORKS_API_BASE}/chat/completions"
VISION_CONNECT_TIMEOUT = 30


def _load_env_file() -> None:
    path = ROOT_DIR / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ[key] = value


_load_env_file()
VISION_READ_TIMEOUT = max(
    60, int(os.environ.get("FIREWORKS_READ_TIMEOUT", "7200"))
)
FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "").strip()
FIREWORKS_API_KEY_FALLBACK = os.environ.get("FIREWORKS_API_KEY_FALLBACK", "").strip()
FIREWORKS_MODEL = os.environ.get(
    "FIREWORKS_MODEL", "accounts/fireworks/models/kimi-k2p6"
).strip()
VISION_PROVIDER = "fireworks"

SYSTEM_PROMPT = """You analyze architectural floor plan images for a premium architectural SVG renderer.

Return exactly one valid JSON object. Extract enough normalized geometry to redraw the plan as vector SVG.

COORDINATE SYSTEM: all values are normalized 0.0-1.0. x = across image width, y = down image height, origin = top-left of the bitmap.
Normalize against the FULL bitmap canvas, including whitespace and title text. Do not crop to the plan before producing coordinates.
Preserve the original image aspect ratio. Do not normalize the plan into a square or redraw rooms as equal-size boxes.
If the visible apartment footprint is wider than it is tall in the source image, the extracted outer shell bounding box must also be wider than tall.
Trace the visible plan pixel-for-pixel: use the actual wall corners, offsets, angled corridor edges, jogs, and recesses. Do not simplify an irregular outline into rectangles.

WALLS - most important field:
- walls is a required array. Do NOT leave it empty if black wall lines are visible.
- Walls are the thick black or dark lines you see in the image. Rooms are the filled zones between those lines.
- Do NOT put room perimeter edges into walls. A wall is a structural element, not a room boundary.
- Each wall entry: { id, role, points:[{x,y},...], thickness }
  - role: "exterior" for outer building shell, "partition" for interior dividers.
  - points: centerline of the wall. 2 points = short partition segment. 3+ points = wall run or closed exterior shell.
  - thickness (normalized): exterior walls 0.012-0.018, interior partitions 0.006-0.010.
- Include one closed exterior shell with all visible jogs/recesses plus individual partition segments between rooms.

ROOMS:
- rooms[].polygon traces the floor area INSIDE the walls (not the wall centerlines).
- Include every labeled or visibly bounded space: bedrooms, living, kitchen, balcony, baths, walk-in closets, closet, laundry, mech, hall/corridor, and any small storage rooms.
- CRITICAL: Do NOT output rectangular bounding boxes. Each room polygon needs enough vertices to follow the real wall shape (typically 6–12+ points for non-rectangular rooms).
- Only use exactly 4 polygon points for a room if it is a perfect axis-aligned rectangle with no recesses; otherwise add vertices at every corner, jog, and step.
- If a room has an angled or stepped boundary, include those vertices in order instead of approximating with a bounding box.
- rooms[].flooring: "wood" for bedrooms/living/dining/halls, "tile" for bathrooms/wet areas, "plain" for kitchens/utility, "stone" for balconies/patios.
- rooms[].labelPoint: {x,y} near visual center of room.

OTHER FIELDS:
- windows: include every window gap on exterior walls as { id, position:{x,y}, width, height? }.
- rooms[].dimensionsText: copy printed dimensions when visible (e.g. "12' 0\\" x 9' 11\\"").
- calibration: include at least two segments when dimensions are printed: one horizontal segment using the longest clear room width, and one vertical segment using the tallest clear room height. Format each as { id, from:{x,y}, to:{x,y}, lengthM }.
- furniture: { id, type, x, y, width, height, rotationDeg? }. x/y are centers, normalized.
- furniture_catalog: optional.
- Omit doors[] entirely unless a door swing is needed for a visible room boundary.

JSON RULES: strictly valid JSON; no trailing commas; close all brackets; keep response under token limit by omitting duplicative fields.

Reply with ONLY valid JSON, no markdown, no code fences."""


def strip_fence(s: str) -> str:
    t = s.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.I)
        t = re.sub(r"\s*```$", "", t)
    t = re.sub(r"<think>[\s\S]*?</redacted_thinking>", "", t, flags=re.I)
    t = re.sub(r"<think[\s\S]*?</think>", "", t, flags=re.I)
    t = re.sub(r"<thinking>[\s\S]*?</thinking>", "", t, flags=re.I)
    return t.strip()


def repair_json_text(text: str) -> str:
    t = text.strip()
    t = re.sub(r",\s*}", "}", t)
    t = re.sub(r",\s*]", "]", t)
    start = t.find("{")
    if start > 0:
        t = t[start:]
    end = t.rfind("}")
    if end > 0:
        t = t[: end + 1]
    return t


def escape_unescaped_inner_quotes(text: str) -> str:
    out = []
    in_string = False
    escaped = False
    n = len(text)

    for i, ch in enumerate(text):
        if escaped:
            out.append(ch)
            escaped = False
            continue

        if ch == "\\":
            out.append(ch)
            escaped = in_string
            continue

        if ch == '"':
            if not in_string:
                in_string = True
                out.append(ch)
                continue

            j = i + 1
            while j < n and text[j].isspace():
                j += 1
            next_ch = text[j] if j < n else ""
            if next_ch in (":", ",", "}", "]", ""):
                in_string = False
                out.append(ch)
            else:
                out.append('\\"')
            continue

        out.append(ch)

    return "".join(out)


def parse_model_json(text: str) -> dict:
    cleaned = strip_fence(text)
    repaired = repair_json_text(cleaned)
    last_err = None
    for candidate in (cleaned, repaired, escape_unescaped_inner_quotes(repaired)):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as err:
            last_err = err
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(repair_json_text(match.group(0)))
        except json.JSONDecodeError as err:
            last_err = err
    if last_err is None:
        raise ValueError("No JSON object in model response")
    raise last_err


def _num(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value, lo=0.0, hi=1.0, default=None):
    n = _num(value, default)
    if n is None:
        return None
    return max(lo, min(hi, n))


def _point(value):
    if not isinstance(value, dict):
        return None
    x = _clamp(value.get("x"))
    y = _clamp(value.get("y"))
    if x is None or y is None:
        return None
    return {"x": x, "y": y}


def _points(value, min_count=1):
    if not isinstance(value, list):
        return []
    pts = []
    for item in value:
        p = _point(item)
        if p is not None:
            pts.append(p)
    return pts if len(pts) >= min_count else []


def _copy_keys(src: dict, keys: list[str]) -> dict:
    return {k: src[k] for k in keys if k in src and src[k] is not None}


def _normalize_room(room: dict, idx: int) -> dict | None:
    if not isinstance(room, dict):
        return None
    polygon = _points(room.get("polygon"), min_count=3)
    if not polygon:
        return None
    out = _copy_keys(
        room,
        ["id", "name", "type", "flooring", "color", "dimensionsText", "dimensions", "areaSqFt"],
    )
    out.setdefault("id", f"room-{idx}")
    out.setdefault("name", str(out["id"]))
    out["polygon"] = polygon
    label_point = _point(room.get("labelPoint"))
    if label_point is not None:
        out["labelPoint"] = label_point
    return out


def _normalize_wall(wall: dict, idx: int) -> dict | None:
    if not isinstance(wall, dict):
        return None
    points = _points(wall.get("points"), min_count=2)
    if not points:
        return None
    out = _copy_keys(wall, ["id"])
    out.setdefault("id", f"wall-{idx}")
    out["points"] = points
    role = str(wall.get("role") or wall.get("kind") or "").lower()
    if role not in ("exterior", "partition"):
        role = "exterior" if len(points) >= 4 else "partition"
    out["role"] = role
    default_thickness = 0.014 if role == "exterior" else 0.008
    raw = wall.get("thickness")
    out["thickness"] = _clamp(raw, lo=0.001, hi=0.05, default=default_thickness)
    return out


def _normalize_door(door: dict, idx: int) -> dict | None:
    if not isinstance(door, dict):
        return None
    out = _copy_keys(door, ["id", "type", "swing", "connects"])
    out.setdefault("id", f"door-{idx}")
    out.setdefault("type", "door")

    polygon = _points(door.get("polygon"), min_count=3)
    if polygon:
        out["polygon"] = polygon

    position = _point(door.get("position"))
    if position is not None:
        out["position"] = position
    else:
        x = _clamp(door.get("x"))
        y = _clamp(door.get("y"))
        if x is not None and y is not None:
            out["x"] = x
            out["y"] = y

    for key in ["width", "height", "radius"]:
        if key in door:
            value = _clamp(door.get(key), lo=0.001, hi=1.0)
            if value is not None:
                out[key] = value

    return out if ("polygon" in out or "position" in out or ("x" in out and "y" in out)) else None


def _normalize_furniture(item: dict, idx: int) -> dict | None:
    if not isinstance(item, dict):
        return None
    x = _clamp(item.get("x"))
    y = _clamp(item.get("y"))
    if x is None or y is None:
        return None
    out = _copy_keys(item, ["id", "type", "catalogId", "shape", "imageUrl"])
    out.setdefault("id", f"f-{idx}")
    out["x"] = x
    out["y"] = y
    for key in ["width", "height", "depth", "scale"]:
        if key in item:
            value = _clamp(item.get(key), lo=0.001, hi=1.0)
            if value is not None:
                out[key] = value
    for key in ["rotationDeg", "rotation", "zIndex", "chairs"]:
        if key in item:
            value = _num(item.get(key))
            if value is not None:
                out[key] = value
    return out


def _normalize_window(window: dict, idx: int) -> dict | None:
    if not isinstance(window, dict):
        return None
    position = _point(window.get("position"))
    width = _clamp(window.get("width"), lo=0.001, hi=1.0)
    if position is None or width is None:
        return None
    out = _copy_keys(window, ["id"])
    out.setdefault("id", f"window-{idx}")
    out["position"] = position
    out["width"] = width
    height = _clamp(window.get("height"), lo=0.001, hi=1.0)
    if height is not None:
        out["height"] = height
    return out


def normalize_analysis(data: dict) -> dict:
    if not isinstance(data, dict):
        data = {}
    out = {
        "analysisVersion": str(data.get("analysisVersion") or "1.0"),
        "label": data.get("label") or "",
        "rooms": [],
        "walls": [],
        "doors": [],
        "furniture_catalog": data.get("furniture_catalog")
        if isinstance(data.get("furniture_catalog"), list)
        else [],
        "furniture": [],
    }
    if isinstance(data.get("calibration"), dict):
        out["calibration"] = data["calibration"]

    out["rooms"] = [
        room
        for room in (_normalize_room(room, i) for i, room in enumerate(data.get("rooms") or []))
        if room is not None
    ]
    out["walls"] = [
        wall
        for wall in (_normalize_wall(wall, i) for i, wall in enumerate(data.get("walls") or []))
        if wall is not None
    ]
    out["doors"] = [
        door
        for door in (_normalize_door(door, i) for i, door in enumerate(data.get("doors") or []))
        if door is not None
    ]
    out["furniture"] = [
        item
        for item in (
            _normalize_furniture(item, i) for i, item in enumerate(data.get("furniture") or [])
        )
        if item is not None
    ]
    windows = [
        window
        for window in (_normalize_window(window, i) for i, window in enumerate(data.get("windows") or []))
        if window is not None
    ]
    if windows:
        out["windows"] = windows
    return out


def parse_response(text: str) -> dict:
    return normalize_analysis(parse_model_json(text))


def _shell_aspect_ratio(walls: list) -> float | None:
    best = None
    for wall in walls or []:
        pts = wall.get("points") if isinstance(wall, dict) else None
        if not pts or len(pts) < 3:
            continue
        role = str(wall.get("role") or "").lower()
        if role == "exterior":
            best = wall
            break
        if best is None or len(pts) > len(best.get("points") or []):
            best = wall
    if not best:
        return None
    xs = [p["x"] for p in best["points"] if isinstance(p, dict) and "x" in p and "y" in p]
    ys = [p["y"] for p in best["points"] if isinstance(p, dict) and "x" in p and "y" in p]
    if not xs or not ys:
        return None
    bw = max(xs) - min(xs)
    bh = max(ys) - min(ys)
    if bh < 1e-6:
        return None
    return bw / bh


def _count_box_rooms(data: dict) -> tuple[int, int]:
    rooms = data.get("rooms") or []
    box = sum(
        1
        for r in rooms
        if isinstance(r, dict) and len(r.get("polygon") or []) == 4
    )
    return box, len(rooms)


def validate_analysis(data: dict, image_width: int, image_height: int) -> dict:
    warnings: list[str] = []
    blocking: str | None = None
    rooms = data.get("rooms") or []
    walls = data.get("walls") or []

    if not walls:
        blocking = (
            "walls[] is empty — structural walls are required (wall layer will not be drawn). "
            "Re-analyze or add walls in JSON."
        )

    box_count, room_count = _count_box_rooms(data)
    if room_count > 3 and box_count > 0:
        warnings.append(
            f"{box_count} room(s) have only 4 polygon points (likely bounding boxes). "
            "Use Edit vertices to refine, or re-analyze."
        )

    if image_width > 0 and image_height > 0 and walls:
        shell_ar = _shell_aspect_ratio(walls)
        if shell_ar is not None:
            img_ar = image_width / image_height
            rel_diff = abs(shell_ar - img_ar) / max(img_ar, 1e-6)
            if rel_diff > 0.4:
                warnings.append(
                    f"Shell aspect ratio ({shell_ar:.2f}) differs from image ({img_ar:.2f}) by "
                    f"{round(rel_diff * 100)}% — check scale or re-analyze."
                )

    return {"blocking": blocking, "warnings": warnings}


def _should_refine_box_rooms(data: dict) -> bool:
    box_count, room_count = _count_box_rooms(data)
    if room_count < 4:
        return False
    return box_count >= 5 or (room_count > 0 and box_count / room_count >= 0.35)


def b64_image_size(b64: str) -> tuple[int, int]:
    try:
        img_data = base64.b64decode(b64)
        img = Image.open(BytesIO(img_data))
        return img.width, img.height
    except Exception:
        return 0, 0


def fireworks_api_keys() -> list[str]:
    keys: list[str] = []
    if FIREWORKS_API_KEY:
        keys.append(FIREWORKS_API_KEY)
    if FIREWORKS_API_KEY_FALLBACK and FIREWORKS_API_KEY_FALLBACK not in keys:
        keys.append(FIREWORKS_API_KEY_FALLBACK)
    return keys


def fireworks_text_from_response(data: dict) -> str:
    if isinstance(data.get("error"), dict):
        err = data["error"]
        raise ValueError(err.get("message") or str(err))
    choices = data.get("choices") or []
    if not choices:
        raise ValueError("Fireworks returned no choices")
    message = choices[0].get("message") or {}
    text = message.get("content") or ""
    if not str(text).strip():
        raise ValueError("Fireworks returned empty text")
    return str(text)


def _fireworks_should_try_next_key(status: int) -> bool:
    return status in (401, 403, 429) or status >= 500


def analyze_with_fireworks(
    image_b64: str, mime: str, extra_user_text: str | None = None
) -> str:
    keys = fireworks_api_keys()
    if not keys:
        raise ValueError(
            "FIREWORKS_API_KEY or FIREWORKS_API_KEY_FALLBACK is not set. Add to floor-plan-viewer/.env"
        )
    user_text = ANALYZE_USER_TEXT
    if extra_user_text:
        user_text = user_text + "\n\n" + extra_user_text
    body = {
        "model": FIREWORKS_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime or 'image/png'};base64,{image_b64}"
                        },
                    },
                ],
            },
        ],
        "temperature": 0.2,
        "max_tokens": 65536,
    }
    last_err: Optional[Exception] = None
    for idx, api_key in enumerate(keys):
        r = requests.post(
            FIREWORKS_CHAT_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=(VISION_CONNECT_TIMEOUT, VISION_READ_TIMEOUT),
        )
        try:
            data = r.json()
        except ValueError:
            data = {}
        if r.ok:
            return fireworks_text_from_response(data)
        err = data.get("error", {}) if isinstance(data, dict) else {}
        msg = err.get("message") if isinstance(err, dict) else r.text
        last_err = ValueError(f"Fireworks {r.status_code}: {msg}")
        if idx < len(keys) - 1 and _fireworks_should_try_next_key(r.status_code):
            continue
        raise last_err
    if last_err:
        raise last_err
    raise ValueError("Fireworks analyze failed")


def serve_index():
    index_path = DIST_DIR / "index.html"
    if not index_path.exists():
        return (
            "Built frontend not found. Run `npm install` and `npm run build`, then restart `python app.py`.",
            500,
        )

    html = index_path.read_text(encoding="utf-8")
    config_script = f"""
  <script>
    window.__ANALYZE_API__ = window.location.origin;
    window.__SERVER_VISION_MODEL__ = {json.dumps(FIREWORKS_MODEL)};
    window.__SERVER_VISION_PROVIDER__ = {json.dumps(VISION_PROVIDER)};
  </script>"""
    html = html.replace("</head>", f"{config_script}\n</head>")
    return Response(html, mimetype="text/html")


@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return resp


@app.route("/api/analyze", methods=["OPTIONS"])
def analyze_opts():
    return "", 204


@app.route("/api/health", methods=["GET"])
def health():
    keys = fireworks_api_keys()
    if not keys:
        return jsonify(
            {
                "ok": False,
                "provider": VISION_PROVIDER,
                "model": FIREWORKS_MODEL,
                "error": "FIREWORKS_API_KEY / FIREWORKS_API_KEY_FALLBACK not set in .env",
            }
        ), 502
    try:
        r = requests.post(
            FIREWORKS_CHAT_URL,
            headers={
                "Authorization": f"Bearer {keys[0]}",
                "Content-Type": "application/json",
            },
            json={
                "model": FIREWORKS_MODEL,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
            },
            timeout=15,
        )
        return jsonify(
            {
                "ok": r.ok,
                "provider": VISION_PROVIDER,
                "model": FIREWORKS_MODEL,
                "status": r.status_code,
                "fallbackConfigured": bool(FIREWORKS_API_KEY_FALLBACK),
            }
        ), (200 if r.ok else 502)
    except requests.RequestException as e:
        return jsonify(
            {
                "ok": False,
                "provider": VISION_PROVIDER,
                "model": FIREWORKS_MODEL,
                "error": f"Fireworks API not reachable: {e}",
            }
        ), 502


import base64
from io import BytesIO
from PIL import Image

def resize_image_b64(b64: str, max_size: int = 2048) -> str:
    try:
        img_data = base64.b64decode(b64)
        img = Image.open(BytesIO(img_data))
        if img.width <= max_size and img.height <= max_size:
            return b64
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        out = BytesIO()
        img.save(out, format=img.format or "PNG")
        return base64.b64encode(out.getvalue()).decode("utf-8")
    except Exception:
        return b64

@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        payload = request.get_json(force=True, silent=True) or {}
        b64 = payload.get("imageBase64")
        if not b64:
            return jsonify({"error": "imageBase64 required"}), 400
        
        b64 = resize_image_b64(b64, max_size=2048)
        img_w, img_h = b64_image_size(b64)
        mime = payload.get("mimeType") or "image/png"
        txt = analyze_with_fireworks(b64, mime)
        parsed = parse_response(txt)
        if _should_refine_box_rooms(parsed):
            try:
                txt2 = analyze_with_fireworks(b64, mime, REFINE_BOX_ROOMS_TEXT)
                parsed2 = parse_response(txt2)
                box1, _ = _count_box_rooms(parsed)
                box2, _ = _count_box_rooms(parsed2)
                if box2 < box1:
                    parsed = parsed2
            except (ValueError, requests.RequestException):
                pass

        validation = validate_analysis(parsed, img_w, img_h)
        if validation.get("blocking"):
            raise ValueError(validation["blocking"])
        warnings = validation.get("warnings") or []
        if warnings:
            parsed = dict(parsed)
            parsed["_validationWarnings"] = warnings
        return jsonify(parsed)
    except ValueError as e:
        return jsonify({"error": str(e)}), 502
    except requests.Timeout as e:
        return (
            jsonify(
                {
                    "error": (
                        f"Fireworks API timed out (read timeout={VISION_READ_TIMEOUT}s). "
                        f"Increase FIREWORKS_READ_TIMEOUT in .env (e.g. 7200 or 10800) and restart the server."
                    )
                }
            ),
            504,
        )
    except requests.RequestException as e:
        return jsonify({"error": f"Fireworks API error: {e}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/", methods=["GET"])
def index():
    return serve_index()


@app.route("/assets/<path:filename>", methods=["GET"])
def assets(filename):
    return send_from_directory(DIST_DIR / "assets", filename)


@app.route("/fixtures/<path:filename>", methods=["GET"])
def fixtures(filename):
    return send_from_directory(DIST_DIR / "fixtures", filename)


@app.route("/<path:_path>", methods=["GET"])
def spa_fallback(_path):
    return serve_index()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5173"))
    print(f"Floor plan viewer http://127.0.0.1:{port}")
    print(f"Analyze API http://127.0.0.1:{port}/api/analyze -> Fireworks {FIREWORKS_MODEL}")
    if fireworks_api_keys():
        print(
            "Fireworks API key(s): "
            + ("primary + fallback" if len(fireworks_api_keys()) > 1 else "loaded")
        )
    else:
        print("Fireworks API key: MISSING — set FIREWORKS_API_KEY in .env")
    print(f"Fireworks read timeout: {VISION_READ_TIMEOUT}s (FIREWORKS_READ_TIMEOUT in .env)")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
