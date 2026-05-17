# Floor plan viewer

Web app to open architectural floor plans, extract room geometry with **AI vision**, and edit the result interactively with **real-world measurements**.

**Stack:** Vite + vanilla JS, SVG overlay, Flask API, [Fireworks AI](https://fireworks.ai/) (Kimi K2.6 vision).

## Quick start

```bash
cd floor-plan-viewer
npm install
cp .env.example .env   # add FIREWORKS_API_KEY
npm start
```

Open **http://127.0.0.1:5173**

- **Open image** — load a floor plan (PNG/JPG)
- **Analyze LLM** — extract rooms, walls, furniture (requires API key)
- **Load sample JSON** — demo data without calling the API

## Features

### AI floor plan analysis
- Upload an image → **Fireworks Kimi K2.6** returns structured JSON (rooms, walls, windows, furniture, calibration hints)
- Re-run with **Analyze LLM** without re-uploading
- Configurable timeout (`FIREWORKS_READ_TIMEOUT`, default **3600s**)

### View & navigate
- SVG overlay aligned to the raster image (normalized `0–1` coordinates)
- Zoom, pan, fullscreen, **geometry-only** mode (hide background image)
- Room hover highlight + tooltip (name, dimensions, calibrated area)

### Measurements & scale
- **Set scale** — click two points on a known dimension, enter length in **meters**, **Apply scale**
- **Measure** — click two points; readout in **m** (or pixels if scale not set)
- **Room** readout — area and approximate **W × H** for the selected room
- On-plan measurement badge on selected rooms

### Edit rooms & floors
- **Floor** picker — wood, bathroom/tile, kitchen, balcony/stone, plain (per selected room)
- **Add room** — choose preset (bedroom, hall, utility, bathroom, living, kitchen, other), click corners, **Finish room** or close on first point; live **m²** while drawing
- **Edit vertices** — drag corners; click edge to **add vertex**; **Delete vertex** or Backspace
- **Undo** / **Ctrl+Z** — undo **add room** and **delete vertex**

### Furniture
- Click to select, drag to move, keyboard nudge/rotate
- Replace from catalog dropdown
- **Export JSON** / **Export corrected JSON**

### Optional integrations
- **Supabase** — upload plan raster (set `VITE_SUPABASE_*` in `.env`)
- Health check: `GET /api/health`

## Configuration (`.env`)

```env
FIREWORKS_API_KEY=your_key
FIREWORKS_API_KEY_FALLBACK=optional_fallback_key
FIREWORKS_MODEL=accounts/fireworks/models/kimi-k2p6
FIREWORKS_READ_TIMEOUT=3600
```

Never commit `.env` (gitignored).

## How to set scale (important)

1. Click **Set scale**
2. Click **start** and **end** of a known distance on the plan (e.g. a labeled wall)
3. Enter the real length in **Length (m)** → **Apply scale**
4. Confirm the green **Scale:** line shows `1 px ≈ … mm`
5. Use **Measure** and **Add room** for distances and areas in meters

## Project layout

| Path | Role |
|------|------|
| `app.py` | Flask server + `/api/analyze` (Fireworks vision) |
| `src/viewer/floorPlanViewer.js` | Main UI, tools, undo, pan/zoom |
| `src/viewer/planTools.js` | Scale, measure, room presets, area math |
| `src/viewer/svgRenderer.js` | SVG rooms, walls, furniture, overlays |
| `src/viewer/toolbar.js` | Toolbar controls |
| `src/lib/calibration.js` | Meters per pixel, area in m² |
| `src/lib/undoStack.js` | Undo for add room / delete vertex |
| `public/fixtures/` | Sample plans and JSON |

## Build

```bash
npm run build
python app.py
```

## License

See repository root.
