# IIDA

Floor plan viewer and analysis workspace.

## Projects

- **`floor-plan-viewer/`** — Vite + Flask app: upload architectural floor plans, analyze with **Fireworks Kimi** vision, render interactive SVG with rooms, walls, furniture, and manual editing tools (scale, measure, draw rooms, undo).

See **[floor-plan-viewer/README.md](floor-plan-viewer/README.md)** for full feature list and setup.

## Quick start

```bash
cd floor-plan-viewer
npm install
cp .env.example .env   # add FIREWORKS_API_KEY
npm start
```

Open http://127.0.0.1:5173

## Structure

- `floor-plan-viewer/src/` — viewer UI and SVG renderer
- `floor-plan-viewer/public/fixtures/` — sample plans for offline testing
- `docs/` — additional documentation
- `tests/` — tests
