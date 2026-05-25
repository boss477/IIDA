# IIDA

Interactive floor plan analysis and **realistic 3D room viewing** from AI-generated plan JSON.

## What it does

- Upload or load a floor plan image
- Run vision analysis (LM Studio, Gemini, or Fireworks Kimi) → structured JSON (`rooms`, `walls`, `furniture`, `calibration`)
- Edit in **2D**: rooms, scale, furniture placement, catalog replace
- View in **Realistic 3D**: textured floors/walls, lighting, dollhouse/top cameras, per-room side elevations, drag furniture on the floor plane

## Repository layout

| Path | Description |
|------|-------------|
| [`floor-plan-viewer/`](floor-plan-viewer/) | Main app (Vite + vanilla JS + Three.js + optional Flask API) |
| [`floor-plan-viewer/README.md`](floor-plan-viewer/README.md) | Setup, env vars, 3D features, architecture |
| `docs/` | Extra notes |
| `tests/` | Tests |

## Quick start

```bash
cd floor-plan-viewer
npm install
cp .env.example .env
npm start
```

Open http://127.0.0.1:5173

Load **sample JSON** for offline demo without an API key.

## 3D viewer (high level)

Driven by the same analysis JSON as 2D — not a fixed rectangle room.

- **Materials** — canvas wood/tile/fabric textures (`plan3dMaterials.js`)
- **Lighting** — sun + fill + per-room spot lights (`plan3dLighting.js`)
- **Camera** — dollhouse, top, 3 side views per selected room (`plan3dCamera.js`)
- **Interaction** — move furniture with wall snap; room pick + dimension tooltip (`plan3dInteraction.js`, `plan3dMove.js`)

Post-processing (Bloom / real-time SSAO) is not used; baked `aoMap` on floors is the planned cheap depth polish.

## Data & backend

- Optional **Supabase** (`shearling_catalog`, plan storage) — see app README for `xcel` project and env
- Catalog SKUs with mm dimensions; 3D uses procedural meshes today (GLB/`image_url` wiring is planned)

## Status

| Area | State |
|------|--------|
| 2D viewer + edit tools | Working |
| Vision → JSON | Working (provider-dependent) |
| Realistic 3D MVP | Working |
| Budget / price filter UI | Planned |
| GLB catalog models in 3D | Planned |
| Supabase migration `003` (projects / placed_furniture) | Not applied on remote yet |

## License

Private / project use — see repository owner for terms.
