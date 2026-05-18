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
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.I)
        t = re.sub(r"\s*```$", "", t)
    t = re.sub(r"<think>[\s\S]*?</redacted_thinking>", "", t, flags=re.I)
    t = re.sub(r"<think[\s\S]*?</think>", "", t, flags=re.I)
    t = re.sub(r"<thinking>[\s\S]*?</thinking>", "", t, flags=re.I)
    return t.strip()


def parse_model_json(text: str) -> dict:
    cleaned = strip_fence(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            raise
        return json.loads(match.group(0))


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
    config_script = f"""
  <script>
    window.__ANALYZE_API__ = window.location.origin;
    window.__SERVER_LM_MODEL__ = {json.dumps(MODEL)};
    window.__SERVER_LM_BASE__ = {json.dumps(LM_BASE)};
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
    try:
        r = requests.get(lm_models_url(), timeout=5)
        return jsonify(
            {
                "ok": r.ok,
                "lmStudioUrl": LM_BASE,
                "model": MODEL,
                "status": r.status_code,
            }
        ), (200 if r.ok else 502)
    except requests.RequestException as e:
        return jsonify(
            {
                "ok": False,
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

@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        payload = request.get_json(force=True, silent=True) or {}
        b64 = payload.get("imageBase64")
        if not b64:
            return jsonify({"error": "imageBase64 required"}), 400
        
        # Downscale the image to prevent context size errors in LM Studio
        b64 = resize_image_b64(b64, max_size=1024)
        
        mime = payload.get("mimeType") or "image/png"
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
    print(f"Analyze API http://127.0.0.1:{port}/api/analyze -> LM {LM_BASE}")
    print(f"LM Studio model: {MODEL} (edit lm_studio.json to change; overrides shell env)")
    app.run(host="127.0.0.1", port=port, debug=False)
