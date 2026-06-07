# PBR Pipeline Visualizer

**Live Demo:** https://jason9075.github.io/PBR-Pipeline/

An interactive, browser-based tool for exploring the **Physically Based Rendering (PBR)** texture pipeline. Inspect how each texture channel (Albedo, Normal, Roughness, Metalness, AO, Displacement) contributes to the final shaded result — in real time, with live controls.

## Features

- **Three render modes** — Wireframe, Solid, and full PBR Render
- **Three PBR materials** — Brick Wall, Metal Plate, Rock Surface
- **Per-channel toggle & isolate** — enable/disable or solo any texture channel to see its isolated effect
- **Texture preview strip** — thumbnail view of all six maps for the active material
- **Live scene controls** — adjust light azimuth, intensity, and environment (None / Studio / Outdoor)
- **Math modal** — inline explanation of the PBR reflectance equation with KaTeX-rendered formulas, togglable between English and Chinese
- **Performance overlay** — real-time FPS, draw call count, and triangle count

## Tech Stack

| Layer | Library/Tool |
|---|---|
| 3D rendering | [Three.js](https://threejs.org/) v0.163 |
| Build tool | [Vite](https://vitejs.dev/) v5 |
| Math rendering | [KaTeX](https://katex.org/) v0.16 |
| Syntax highlight | [PrismJS](https://prismjs.com/) v1.29 |
| Dev environment | [Nix Flakes](https://nixos.wiki/wiki/Flakes) |
| Task runner | [just](https://github.com/casey/just) |

## Getting Started

### Prerequisites

- [Nix](https://nixos.org/) with flakes enabled, **or** Node.js 20+ with `npm`

### With Nix (recommended)

```sh
nix develop        # enter the dev shell
just dev           # start the dev server on :8080
```

### Without Nix

```sh
npm install
npm run dev
```

Then open `http://localhost:8080` in your browser.

## Available Commands

```sh
just dev       # start Vite dev server (HMR, port 8080)
just build     # production build → dist/
just preview   # serve the production build locally
```

## Project Structure

```
PBR-Pipeline/
├── assets/          # PBR texture maps (brick, metal, rock)
├── public/          # Static assets served as-is
├── src/
│   ├── main.js      # App entry point, Three.js scene setup
│   └── style.css    # UI styles
├── index.html       # Shell HTML with UI layout
├── flake.nix        # Nix dev environment
├── Justfile         # Task automation
└── vite.config.js   # Vite configuration
```

## Credits

PBR textures from [ambientCG](https://ambientcg.com/), licensed under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## License

[MIT](./LICENSE) © 2026 Jason Kuan (jason9075)
