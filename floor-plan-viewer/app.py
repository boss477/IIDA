"""
Flask app: serves floor plan viewer + /api/analyze via Google Gemini vision.
  pip install -r requirements.txt
  Set GEMINI_API_KEY in .env (see .env.example)
  npm run build && python app.py
  open http://127.0.0.1:5173
"""
import json
import os
import re
from pathlib import Path

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
    "Preserve exact aspect ratio and stepped/angled geometry. Output one compact valid JSON object only "
    "(no trailing commas, no markdown)."
)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_CONNECT_TIMEOUT = 30
GEMINI_READ_TIMEOUT = 600


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
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview").strip()

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


def validate_analysis(data: dict, image_width: int, image_height: int) -> str | None:
    errors: list[str] = []
    rooms = data.get("rooms") or []
    walls = data.get("walls") or []

    if not walls:
        errors.append(
            "walls[] is empty — structural walls are required (wall layer will not be drawn)."
        )

    if len(rooms) > 3:
        box_rooms = [r for r in rooms if isinstance(r, dict) and len(r.get("polygon") or []) == 4]
        if box_rooms:
            errors.append(
                f"{len(box_rooms)} room(s) have only 4 polygon points (likely bounding boxes, not traced shapes). "
                "Re-analyze or edit vertices."
            )

    if image_width > 0 and image_height > 0 and walls:
        shell_ar = _shell_aspect_ratio(walls)
        if shell_ar is not None:
            img_ar = image_width / image_height
            rel_diff = abs(shell_ar - img_ar) / max(img_ar, 1e-6)
            if rel_diff > 0.4:
                errors.append(
                    f"Shell aspect ratio ({shell_ar:.2f}) differs from image ({img_ar:.2f}) by "
                    f"{round(rel_diff * 100)}% — coordinates may be cropped or wrong."
                )

    return " ".join(errors) if errors else None


def b64_image_size(b64: str) -> tuple[int, int]:
    try:
        img_data = base64.b64decode(b64)
        img = Image.open(BytesIO(img_data))
        return img.width, img.height
    except Exception:
        return 0, 0


def gemini_generate_url() -> str:
    return f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}:generateContent"


def gemini_text_from_response(data: dict) -> str:
    if isinstance(data.get("error"), dict):
        err = data["error"]
        raise ValueError(err.get("message") or str(err))
    candidates = data.get("candidates") or []
    if not candidates:
        raise ValueError("Gemini returned no candidates")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text"))
    if not text.strip():
        raise ValueError("Gemini returned empty text")
    return text


def analyze_with_gemini(image_b64: str, mime: str) -> str:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set. Add it to floor-plan-viewer/.env")
    url = gemini_generate_url() + "?key=" + GEMINI_API_KEY
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": ANALYZE_USER_TEXT},
                    {"inline_data": {"mime_type": mime or "image/png", "data": image_b64}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 65536,
            "responseMimeType": "application/json",
        },
    }
    r = requests.post(
        url,
        json=body,
        timeout=(GEMINI_CONNECT_TIMEOUT, GEMINI_READ_TIMEOUT),
    )
    data = r.json()
    if not r.ok:
        err = data.get("error", {}) if isinstance(data, dict) else {}
        msg = err.get("message") if isinstance(err, dict) else r.text
        raise ValueError(f"Gemini {r.status_code}: {msg}")
    text = gemini_text_from_response(data)
    return text


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
    window.__SERVER_VISION_MODEL__ = {json.dumps(GEMINI_MODEL)};
    window.__SERVER_VISION_PROVIDER__ = "gemini";
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
    if not GEMINI_API_KEY:
        return jsonify(
            {
                "ok": False,
                "provider": "gemini",
                "model": GEMINI_MODEL,
                "error": "GEMINI_API_KEY not set in .env",
            }
        ), 502
    try:
        url = f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}?key={GEMINI_API_KEY}"
        r = requests.get(url, timeout=10)
        return jsonify(
            {
                "ok": r.ok,
                "provider": "gemini",
                "model": GEMINI_MODEL,
                "status": r.status_code,
            }
        ), (200 if r.ok else 502)
    except requests.RequestException as e:
        return jsonify(
            {
                "ok": False,
                "provider": "gemini",
                "model": GEMINI_MODEL,
                "error": f"Gemini API not reachable: {e}",
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
        txt = analyze_with_gemini(b64, mime)
        parsed = parse_response(txt)
        validation_err = validate_analysis(parsed, img_w, img_h)
        if validation_err:
            raise ValueError(validation_err)
        return jsonify(parsed)
    except ValueError as e:
        return jsonify({"error": str(e)}), 502
    except requests.RequestException as e:
        return jsonify({"error": f"Gemini API error: {e}"}), 502
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
    print(f"Analyze API http://127.0.0.1:{port}/api/analyze -> Gemini {GEMINI_MODEL}")
    if GEMINI_API_KEY:
        print("Gemini API key: loaded from .env / environment")
    else:
        print("Gemini API key: MISSING — set GEMINI_API_KEY in .env")
    app.run(host="127.0.0.1", port=port, debug=False)
