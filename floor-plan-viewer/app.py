"""
Flask proxy for LM Studio OpenAI-compatible API.
  pip install flask requests
  set LM_STUDIO_URL=http://10.212.228.25:1234/v1
  set LM_STUDIO_MODEL=qwen/qwen3.5-9b
  python app.py
  open http://127.0.0.1:5173
  Or omit set … and use lm_studio.json in this folder.
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


def _read_json_object(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def resolve_lm_studio_settings() -> tuple[str, str]:
    """
    lm_studio.json + lm_studio.local.json override LM_STUDIO_* environment variables
    so a stale shell `set LM_STUDIO_MODEL=...` cannot stick after you change defaults here.
    """
    default_url = "http://10.212.228.25:1234/v1"
    default_model = "qwen/qwen3.5-9b"
    cfg: dict = {}
    cfg.update(_read_json_object(ROOT_DIR / "lm_studio.json"))
    cfg.update(_read_json_object(ROOT_DIR / "lm_studio.local.json"))

    def pick(json_key: str, env_key: str, default: str) -> str:
        v = cfg.get(json_key)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
        ev = os.environ.get(env_key, "").strip()
        if ev:
            return ev
        return default

    return pick("lm_studio_url", "LM_STUDIO_URL", default_url).rstrip("/"), pick(
        "lm_studio_model", "LM_STUDIO_MODEL", default_model
    )


LM_BASE, MODEL = resolve_lm_studio_settings()


def _load_env_file() -> None:
    env_path = ROOT_DIR / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ[key] = value


_load_env_file()

GEMINI_KEY = (
    os.environ.get("GEMINI_API_KEY", "").strip()
    or os.environ.get("VITE_GEMINI_API_KEY", "").strip()
)
GEMINI_MODEL = (
    os.environ.get("VITE_GEMINI_MODEL", "").strip()
    or os.environ.get("GEMINI_MODEL", "").strip()
    or "gemini-3-flash-preview"
)

KIMI_KEY = (
    os.environ.get("KIMI_API_KEY", "").strip()
    or os.environ.get("VITE_KIMI_API_KEY", "").strip()
    or os.environ.get("FIREWORKS_API_KEY", "").strip()
    or os.environ.get("VITE_FIREWORKS_API_KEY", "").strip()
)
KIMI_MODEL = (
    os.environ.get("VITE_KIMI_MODEL", "").strip()
    or os.environ.get("KIMI_MODEL", "").strip()
    or "accounts/fireworks/models/kimi-k2p5"
)
FIREWORKS_BASE = (
    os.environ.get("FIREWORKS_BASE_URL", "").strip()
    or os.environ.get("VITE_FIREWORKS_BASE_URL", "").strip()
    or "https://api.fireworks.ai/inference/v1"
).rstrip("/")

SYSTEM_PROMPT = """You analyze architectural floor plan images for a premium architectural SVG renderer.

Return exactly one valid JSON object. Extract enough normalized geometry to redraw the plan as vector SVG: room floor materials, wall runs, door swings/openings, labels, and visible furniture.

Rules:
- analysisVersion must be the string "1.0".
- All rooms, walls, doors, labels, and furniture use the same normalized 0-1 coordinate space: x across image width, y down image height, origin top-left of the bitmap (not the letterboxed HTML box).
- rooms: array of { id, name, type, flooring, polygon, labelPoint, dimensionsText?, areaSqFt? }.
- rooms[].flooring must be one of "wood", "tile", "stone", "carpet", or "plain". Use wood for living/dining/bedrooms/halls, tile for bathrooms, warm tile/plain for kitchens, and stone for balcony/patio/outdoor areas.
- rooms[].polygon must be a list of {x,y} points tracing the inner wall boundary. Prefer 4+ points, but include every visible corner for L-shaped rooms.
- rooms[].labelPoint must be {x,y} near the visual center of the room.
- walls: array of { id?, points:[{x,y},...], thickness } for outer shell and partition walls. Use 5+ points for major wall runs when possible.
- doors: array of { id?, type:"door", position:{x,y}, width, swing?, connects?, polygon? }. Include door swing/opening geometry when visible. Coordinates and width are normalized.
- furniture_catalog: optional array of { id, name, shape?, width_mm?, depth_mm?, height_mm?, image_2d_url?, model_3d_url? }.
- furniture: array of { id?, type, catalogId?, x, y, width?, height?, rotationDeg?, scale?, zIndex? } for all visible furniture and fixtures. x/y are centers and width/height are normalized.
- Optional windows may be { id?, position:{x,y}, width, height? }.

Reply with ONLY valid JSON, no markdown. Example shape:
{"analysisVersion":"1.0","rooms":[{"id":"kitchen","name":"Kitchen","type":"kitchen","flooring":"tile","labelPoint":{"x":0.38,"y":0.4},"dimensionsText":"12 ft x 18 ft","polygon":[{"x":0.1,"y":0.2},{"x":0.5,"y":0.2},{"x":0.5,"y":0.6},{"x":0.1,"y":0.6}]}],"walls":[{"id":"outer-wall-1","points":[{"x":0.12,"y":0.18},{"x":0.86,"y":0.18},{"x":0.86,"y":0.74},{"x":0.32,"y":0.74},{"x":0.32,"y":0.92},{"x":0.12,"y":0.92}],"thickness":0.008}],"doors":[{"id":"door-1","type":"door","position":{"x":0.5,"y":0.6},"width":0.04,"swing":"right"}],"furniture":[{"id":"bed-1","type":"bed","x":0.7,"y":0.45,"width":0.12,"height":0.18,"rotationDeg":0}],"furniture_catalog":[]}"""


def strip_fence(s: str) -> str:
    t = s.strip()
    if t.startswith("\ufeff"):
        t = t[1:]
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.I)
        t = re.sub(r"\s*```$", "", t)
    t = re.sub(r"<think>[\s\S]*?</redacted_thinking>", "", t, flags=re.I)
    t = re.sub(r"<think[\s\S]*?</think>", "", t, flags=re.I)
    t = re.sub(r"<thinking>[\s\S]*?</thinking>", "", t, flags=re.I)
    return t.strip()


def _strip_trailing_commas(s: str) -> str:
    return re.sub(r",\s*([}\]])", r"\1", s)


def _extract_balanced_json(text: str) -> str | None:
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _openai_content_to_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and part.get("text"):
                parts.append(str(part["text"]))
            elif isinstance(part, str):
                parts.append(part)
        return "".join(parts)
    if isinstance(content, dict) and content.get("text"):
        return str(content["text"])
    return ""


def _message_text_candidates(message: dict) -> list[str]:
    if not isinstance(message, dict):
        return []
    candidates: list[str] = []
    main = _openai_content_to_text(message.get("content"))
    if main.strip():
        candidates.append(main)
    reasoning = message.get("reasoning_content") or message.get("reasoning")
    if isinstance(reasoning, str) and reasoning.strip() and reasoning != main:
        candidates.append(reasoning)
    return candidates


def parse_model_json(text: str) -> dict:
    cleaned = strip_fence(text)
    brace = cleaned.find("{")
    if brace > 0:
        cleaned = cleaned[brace:]
    attempts = [cleaned]
    balanced = _extract_balanced_json(cleaned)
    if balanced and balanced != cleaned:
        attempts.append(balanced)
    last_err: json.JSONDecodeError | None = None
    for candidate in attempts:
        candidate = _strip_trailing_commas(candidate)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as err:
            last_err = err
    if last_err:
        raise last_err
    raise json.JSONDecodeError("No JSON object in model text", text, 0)


def parse_openai_message(
    message: dict, finish_reason: str | None = None, label: str = "model"
) -> dict:
    candidates = _message_text_candidates(message)
    if not candidates:
        raise RuntimeError(f"No message content from {label}")
    last_err: Exception | None = None
    for text in candidates:
        try:
            return parse_model_json(text)
        except (json.JSONDecodeError, ValueError) as err:
            last_err = err
    if finish_reason == "length":
        raise RuntimeError(
            f"{label} response was truncated (token limit). Try a smaller image or re-run."
        )
    if last_err:
        raise last_err
    raise RuntimeError(f"Could not parse JSON from {label}")


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
    out["thickness"] = _clamp(wall.get("thickness"), lo=0.001, hi=0.05, default=0.008)
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


def analyze_via_gemini(b64: str, mime: str) -> dict:
    if not GEMINI_KEY:
        raise ValueError("GEMINI_API_KEY or VITE_GEMINI_API_KEY not set")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{requests.utils.quote(GEMINI_MODEL, safe='')}:generateContent"
        f"?key={requests.utils.quote(GEMINI_KEY, safe='')}"
    )
    user_text = (
        "Extract rooms, flooring materials, walls, doors, windows, labels, dimensions, "
        "and furniture for a premium vector SVG redraw. Output JSON only."
    )
    body = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_PROMPT + "\n\n" + user_text},
                    {"inline_data": {"mime_type": mime, "data": b64}},
                ]
            }
        ],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 8192},
    }
    r = requests.post(url, json=body, timeout=(10, 3600))
    if not r.ok:
        raise RuntimeError(f"Gemini: {r.status_code} {r.text[:500]}")
    data = r.json()
    parts = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [])
    )
    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
    if not text:
        raise RuntimeError("No text from Gemini")
    return parse_response(text)


def analyze_via_kimi(b64: str, mime: str) -> dict:
    if not KIMI_KEY:
        raise ValueError("KIMI_API_KEY or VITE_KIMI_API_KEY not set")
    url = f"{FIREWORKS_BASE}/chat/completions"
    user_text = (
        "Extract rooms, flooring materials, walls, doors, windows, labels, dimensions, "
        "and furniture for a premium vector SVG redraw. Output JSON only."
    )
    body = {
        "model": KIMI_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            },
        ],
        "temperature": 0.2,
        "max_tokens": 8192,
        "response_format": {"type": "json_object"},
    }
    r = requests.post(
        url,
        json=body,
        headers={"Authorization": f"Bearer {KIMI_KEY}", "Content-Type": "application/json"},
        timeout=(10, 3600),
    )
    if not r.ok:
        raise RuntimeError(f"Fireworks ({KIMI_MODEL}): {r.status_code} {r.text[:500]}")
    data = r.json()
    choice = data["choices"][0]
    return normalize_analysis(
        parse_openai_message(
            choice.get("message") or {},
            finish_reason=choice.get("finish_reason"),
            label="Kimi",
        )
    )


def lm_models_url() -> str:
    base = re.sub(r"/v1$", "", LM_BASE)
    return f"{base}/v1/models"


def serve_index():
    index_path = DIST_DIR / "index.html"
    if not index_path.exists():
        return (
            "Built frontend not found. Run `npm install` and `npm run build`, then restart `python app.py`.",
            500,
        )

    html = index_path.read_text(encoding="utf-8")
    lines = ["  <script>"]
    lines.append("    window.__ANALYZE_API__ = window.location.origin;")
    lines.append(f"    window.__SERVER_LM_MODEL__ = {json.dumps(MODEL)};")
    lines.append(f"    window.__SERVER_LM_BASE__ = {json.dumps(LM_BASE)};")
    if KIMI_KEY:
        lines.append(f"    window.__SERVER_KIMI_MODEL__ = {json.dumps(KIMI_MODEL)};")
    if GEMINI_KEY:
        lines.append(f"    window.__SERVER_GEMINI_MODEL__ = {json.dumps(GEMINI_MODEL)};")
    lines.append("  </script>")
    config_script = "\n".join(lines)
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
    if KIMI_KEY:
        return jsonify(
            {
                "ok": True,
                "provider": "kimi",
                "model": KIMI_MODEL,
                "baseUrl": FIREWORKS_BASE,
            }
        )
    if GEMINI_KEY:
        return jsonify(
            {
                "ok": True,
                "provider": "gemini",
                "model": GEMINI_MODEL,
            }
        )
    try:
        r = requests.get(lm_models_url(), timeout=5)
        return jsonify(
            {
                "ok": r.ok,
                "provider": "lm_studio",
                "lmStudioUrl": LM_BASE,
                "model": MODEL,
                "status": r.status_code,
            }
        ), (200 if r.ok else 502)
    except requests.RequestException as e:
        return jsonify(
            {
                "ok": False,
                "provider": "lm_studio",
                "lmStudioUrl": LM_BASE,
                "model": MODEL,
                "error": f"LM Studio is not reachable: {e}",
            }
        ), 502


import base64
from io import BytesIO
from PIL import Image

def resize_image_b64(b64: str, max_size: int = 1024) -> str:
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

def _debug_log(location, message, data, hypothesis_id):
    import time

    try:
        entry = {
            "sessionId": "bde2f0",
            "location": location,
            "message": message,
            "data": data,
            "hypothesisId": hypothesis_id,
            "timestamp": int(time.time() * 1000),
            "runId": "pre-fix",
        }
        log_path = ROOT_DIR.parent / "debug-bde2f0.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        _debug_log(
            "app.py:analyze",
            "analyze request received",
            {"hasKimiKey": bool(KIMI_KEY), "hasGeminiKey": bool(GEMINI_KEY)},
            "H2",
        )
        payload = request.get_json(force=True, silent=True) or {}
        b64 = payload.get("imageBase64")
        if not b64:
            return jsonify({"error": "imageBase64 required"}), 400
        
        # Downscale the image to prevent context size errors in LM Studio
        b64 = resize_image_b64(b64, max_size=1024)
        
        mime = payload.get("mimeType") or "image/png"
        if KIMI_KEY:
            parsed = analyze_via_kimi(b64, mime)
            _debug_log(
                "app.py:analyze",
                "fireworks analyze ok",
                {"model": KIMI_MODEL, "roomCount": len(parsed.get("rooms") or [])},
                "H2",
            )
            return jsonify(parsed)
        if GEMINI_KEY:
            parsed = analyze_via_gemini(b64, mime)
            _debug_log("app.py:analyze", "gemini analyze ok", {"roomCount": len(parsed.get("rooms") or [])}, "H2")
            return jsonify(parsed)

        url = f"{LM_BASE}/chat/completions"
        body = {
            "model": MODEL or "local-model",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract rooms, flooring materials, walls, doors, windows, labels, dimensions, and furniture for a premium vector SVG redraw. Output JSON only.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{b64}"},
                        },
                    ],
                },
            ],
            "temperature": 0.2,
            "max_tokens": 8192,
        }
        
        r = requests.post(url, json=body, timeout=(10, 3600))

        if not r.ok:
            return jsonify({"error": f"LM Studio: {r.status_code} {r.text}"}), 502
        data = r.json()
        txt = data["choices"][0]["message"]["content"]
        parsed = parse_response(txt)
        return jsonify(parsed)
    except requests.RequestException as e:
        return jsonify({"error": f"LM Studio is not reachable at {LM_BASE}: {e}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_supabase_config():
    url = os.environ.get("VITE_SUPABASE_URL", "")
    key = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
    if not url or not key:
        env_path = Path(__file__).parent / ".env"
        if env_path.is_file():
            content = env_path.read_text(encoding="utf-8")
            url_match = re.search(r"VITE_SUPABASE_URL\s*=\s*(.+)", content)
            key_match = re.search(r"VITE_SUPABASE_ANON_KEY\s*=\s*(.+)", content)
            if url_match:
                url = url_match.group(1).strip().strip("'\"")
            if key_match:
                key = key_match.group(1).strip().strip("'\"")
    return url, key


def point_in_polygon(x, y, polygon):
    if not polygon or len(polygon) < 3:
        return False
    inside = False
    p1 = polygon[0]
    n = len(polygon)
    for i in range(1, n + 1):
        p2 = polygon[i % n]
        if y > min(p1.get('y', 0), p2.get('y', 0)):
            if y <= max(p1.get('y', 0), p2.get('y', 0)):
                if x <= max(p1.get('x', 0), p2.get('x', 0)):
                    if p1.get('y', 0) != p2.get('y', 0):
                        xints = (y - p1.get('y', 0)) * (p2.get('x', 0) - p1.get('x', 0)) / (p2.get('y', 0) - p1.get('y', 0)) + p1.get('x', 0)
                    if p1.get('x', 0) == p2.get('x', 0) or x <= xints:
                        inside = not inside
        p1 = p2
    return inside


@app.route("/api/projects/<project_id>", methods=["GET"])
def get_project(project_id):
    sb_url, sb_key = get_supabase_config()
    if not sb_url or not sb_key:
        return jsonify({"error": "Supabase credentials not configured in environment or .env"}), 500

    headers = {
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
        "Content-Type": "application/json"
    }

    try:
        # Fetch project
        proj_req = requests.get(f"{sb_url}/rest/v1/projects?id=eq.{project_id}", headers=headers)
        if not proj_req.ok:
            return jsonify({"error": f"Failed to fetch project: {proj_req.text}"}), proj_req.status_code
        proj_data = proj_req.json()
        if not proj_data:
            return jsonify({"error": "Project not found"}), 404
        project = proj_data[0]

        # Fetch rooms
        rooms_req = requests.get(f"{sb_url}/rest/v1/rooms?project_id=eq.{project_id}", headers=headers)
        rooms_data = rooms_req.json() if rooms_req.ok else []

        # Fetch structural elements
        struct_req = requests.get(f"{sb_url}/rest/v1/structural_elements?project_id=eq.{project_id}", headers=headers)
        struct_data = struct_req.json() if struct_req.ok else []

        # Fetch placed furniture
        furn_req = requests.get(f"{sb_url}/rest/v1/placed_furniture?project_id=eq.{project_id}", headers=headers)
        furn_data = furn_req.json() if furn_req.ok else []

        # Map back to client format
        rooms = []
        for r in rooms_data:
            rooms.append({
                "id": r.get("client_id") or r.get("id"),
                "name": r.get("name"),
                "type": r.get("type"),
                "flooring": r.get("flooring"),
                "polygon": r.get("polygon"),
                "labelPoint": r.get("label_point"),
                "dimensions": r.get("dimensions_text"),
                "area": r.get("area")
            })

        walls = []
        doors = []
        windows = []
        for s in struct_data:
            kind = s.get("kind")
            client_id = s.get("client_id") or s.get("id")
            if kind == "wall":
                walls.append({
                    "id": client_id,
                    "points": s.get("geometry"),
                    "thickness": s.get("thickness")
                })
            elif kind == "door":
                doors.append({
                    "id": client_id,
                    "polygon": s.get("geometry"),
                    "connects": s.get("connects")
                })
            elif kind == "window":
                windows.append({
                    "id": client_id,
                    "polygon": s.get("geometry")
                })

        furniture = []
        for f in furn_data:
            furniture.append({
                "id": f.get("client_id") or f.get("id"),
                "catalogId": f.get("catalog_id"),
                "x": float(f.get("x") or 0),
                "y": float(f.get("y") or 0),
                "z": float(f.get("z") or 0),
                "rotationDeg": float(f.get("rotation_deg") or 0),
                "sofaColorOverride": (f.get("overrides") or {}).get("sofaColorOverride") if f.get("overrides") else None,
                "sofaParams": (f.get("overrides") or {}).get("sofaParams") if f.get("overrides") else None
            })

        # Assemble viewer JSON
        assembled = {
            "label": project.get("name"),
            "calibration": project.get("calibration"),
            "rooms": rooms,
            "walls": walls,
            "doors": doors,
            "windows": windows,
            "furniture": furniture
        }
        return jsonify(assembled)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects/<project_id>", methods=["PUT"])
def save_project(project_id):
    sb_url, sb_key = get_supabase_config()
    if not sb_url or not sb_key:
        return jsonify({"error": "Supabase credentials not configured in environment or .env"}), 500

    payload = request.json or {}
    name = payload.get("label") or "Project"
    calibration = payload.get("calibration")

    headers = {
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    try:
        # Check if project exists
        proj_req = requests.get(f"{sb_url}/rest/v1/projects?id=eq.{project_id}", headers=headers)
        project_exists = proj_req.ok and len(proj_req.json()) > 0

        # Upsert project
        project_body = {
            "id": project_id,
            "name": name,
            "calibration": calibration
        }
        if project_exists:
            upsert_req = requests.patch(f"{sb_url}/rest/v1/projects?id=eq.{project_id}", json=project_body, headers=headers)
        else:
            upsert_req = requests.post(f"{sb_url}/rest/v1/projects", json=project_body, headers=headers)

        if not upsert_req.ok:
            return jsonify({"error": f"Failed to save project: {upsert_req.text}"}), upsert_req.status_code

        # Clear existing elements to replace them in a single transaction-like sequence
        requests.delete(f"{sb_url}/rest/v1/rooms?project_id=eq.{project_id}", headers=headers)
        requests.delete(f"{sb_url}/rest/v1/structural_elements?project_id=eq.{project_id}", headers=headers)
        requests.delete(f"{sb_url}/rest/v1/placed_furniture?project_id=eq.{project_id}", headers=headers)

        # Save rooms
        rooms_list = payload.get("rooms", [])
        room_client_to_uuid = {}
        if rooms_list:
            insert_rooms = []
            for r in rooms_list:
                insert_rooms.append({
                    "project_id": project_id,
                    "client_id": r.get("id"),
                    "name": r.get("name"),
                    "type": r.get("type"),
                    "flooring": r.get("flooring"),
                    "polygon": r.get("polygon"),
                    "label_point": r.get("labelPoint"),
                    "dimensions_text": r.get("dimensions"),
                    "area": r.get("area")
                })
            r_res = requests.post(f"{sb_url}/rest/v1/rooms", json=insert_rooms, headers=headers)
            if r_res.ok:
                for db_room in r_res.json():
                    client_id = db_room.get("client_id")
                    if client_id:
                        room_client_to_uuid[client_id] = db_room.get("id")

        # Save structural elements (walls, doors, windows)
        structs = []
        for w in payload.get("walls", []):
            structs.append({
                "project_id": project_id,
                "client_id": w.get("id"),
                "kind": "wall",
                "geometry": w.get("points"),
                "thickness": w.get("thickness")
            })
        for d in payload.get("doors", []):
            structs.append({
                "project_id": project_id,
                "client_id": d.get("id"),
                "kind": "door",
                "geometry": d.get("polygon"),
                "connects": d.get("connects")
            })
        for win in payload.get("windows", []):
            structs.append({
                "project_id": project_id,
                "client_id": win.get("id"),
                "kind": "window",
                "geometry": win.get("polygon")
            })
        if structs:
            requests.post(f"{sb_url}/rest/v1/structural_elements", json=structs, headers=headers)

        # Save furniture
        furnitures = []
        for f in payload.get("furniture", []):
            # Compute containing room
            fx = float(f.get("x") or 0)
            fy = float(f.get("y") or 0)
            room_uuid = None
            for r in rooms_list:
                if point_in_polygon(fx, fy, r.get("polygon", [])):
                    room_uuid = room_client_to_uuid.get(r.get("id"))
                    break
            
            overrides = {}
            if f.get("sofaColorOverride"):
                overrides["sofaColorOverride"] = f.get("sofaColorOverride")
            if f.get("sofaParams"):
                overrides["sofaParams"] = f.get("sofaParams")

            furnitures.append({
                "project_id": project_id,
                "room_id": room_uuid,
                "client_id": f.get("id"),
                "catalog_id": f.get("catalogId"),
                "x": fx,
                "y": fy,
                "z": float(f.get("z") or 0),
                "rotation_deg": float(f.get("rotationDeg") or 0),
                "overrides": overrides if overrides else None
            })
        if furnitures:
            requests.post(f"{sb_url}/rest/v1/placed_furniture", json=furnitures, headers=headers)

        return jsonify({"success": True, "projectId": project_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects/dataset-export", methods=["GET"])
def dataset_export():
    sb_url, sb_key = get_supabase_config()
    if not sb_url or not sb_key:
        return jsonify({"error": "Supabase credentials not configured in environment or .env"}), 500

    headers = {
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
        "Content-Type": "application/json"
    }

    try:
        # Fetch all projects
        proj_req = requests.get(f"{sb_url}/rest/v1/projects", headers=headers)
        if not proj_req.ok:
            return jsonify({"error": proj_req.text}), proj_req.status_code
        projects = proj_req.json()

        export_rows = []
        for proj in projects:
            p_id = proj.get("id")
            
            # Fetch rooms
            rooms_req = requests.get(f"{sb_url}/rest/v1/rooms?project_id=eq.{p_id}", headers=headers)
            rooms = rooms_req.json() if rooms_req.ok else []

            # Fetch furniture
            furn_req = requests.get(f"{sb_url}/rest/v1/placed_furniture?project_id=eq.{p_id}", headers=headers)
            furniture = furn_req.json() if furn_req.ok else []

            for room in rooms:
                poly = room.get("polygon")
                if not poly:
                    continue
                
                placed_inside = []
                for f in furniture:
                    fx = float(f.get("x") or 0)
                    fy = float(f.get("y") or 0)
                    if point_in_polygon(fx, fy, poly):
                        placed_inside.append({
                            "catalog_id": f.get("catalog_id"),
                            "x": fx,
                            "y": fy,
                            "z": float(f.get("z") or 0),
                            "rotation_deg": float(f.get("rotation_deg") or 0),
                            "overrides": f.get("overrides")
                        })
                
                export_rows.append({
                    "project_id": p_id,
                    "project_name": proj.get("name"),
                    "room_id": room.get("id"),
                    "room_name": room.get("name"),
                    "room_type": room.get("type"),
                    "room_polygon": poly,
                    "furniture_placements": placed_inside
                })

        return jsonify(export_rows)
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


@app.route("/models/<path:filename>", methods=["GET"])
def models(filename):
    return send_from_directory(DIST_DIR / "models", filename)


@app.route("/<path:_path>", methods=["GET"])
def spa_fallback(_path):
    return serve_index()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5173"))
    print(f"Floor plan viewer http://127.0.0.1:{port}")
    if KIMI_KEY:
        print(f"Analyze API http://127.0.0.1:{port}/api/analyze -> Kimi {KIMI_MODEL}")
    elif GEMINI_KEY:
        print(f"Analyze API http://127.0.0.1:{port}/api/analyze -> Gemini {GEMINI_MODEL}")
    else:
        print(f"Analyze API http://127.0.0.1:{port}/api/analyze -> LM {LM_BASE}")
        print(f"LM Studio model: {MODEL} (edit lm_studio.json to change; overrides shell env)")
    app.run(host="127.0.0.1", port=port, debug=False)
