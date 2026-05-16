# IIDA

Floor plan viewer and analysis workspace.

## Projects

- **`floor-plan-viewer/`** — Vite + Flask app: upload architectural floor plans, analyze with Gemini vision, render interactive SVG with rooms, walls, windows, and movable furniture.

## Quick start

```bash
cd floor-plan-viewer
npm install
npm run build
cp .env.example .env   # add GEMINI_API_KEY
python app.py
```

Open http://127.0.0.1:5173

## Structure

- `floor-plan-viewer/src/` — viewer UI and SVG renderer
- `floor-plan-viewer/public/fixtures/` — sample plans for offline testing
- `docs/` — additional documentation
- `tests/` — tests
