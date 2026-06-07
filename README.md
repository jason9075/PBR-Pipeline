# PBR Pipeline Visualizer

**Live Demo:** https://jason9075.github.io/PBR-Pipeline/

An interactive, browser-based tool for exploring the **Physically Based Rendering (PBR)** texture pipeline. Inspect how each texture channel (Albedo, Normal, Roughness, Metalness, AO, Displacement) contributes to the final shaded result — in real time, with live controls.

## Features

- **Three render modes** — Wireframe, Render, and Mix (wireframe overlay on full PBR)
- **Four PBR materials** — Brick Wall, Metal Plate, Rock Surface, Rusty Metal
- **Per-channel toggle & isolate** — enable/disable or solo any texture channel to see its isolated effect
- **Displacement map** with adjustable scale slider; wireframe mode accurately traces the displaced surface using a custom ShaderMaterial
- **Texture preview strip** — thumbnail view of all maps for the active material
- **Camera focus** — animate to Overview or any individual material with cubic ease-out
- **Live scene controls** — light azimuth (with 3D position indicator), intensity, environment (None / Studio / Outdoor), displacement scale
- **Math modal** — inline Cook-Torrance BRDF equations rendered with KaTeX + GLSL code, togglable between English and Traditional Chinese
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
just install   # npm install + create public/assets symlink
just dev       # start Vite dev server (HMR, port 8080)
just build     # production build → dist/
just preview   # serve the production build locally
just clean     # remove dist/ and node_modules/
```

## Project Structure

```
PBR-Pipeline/
├── assets/
│   ├── brick/        # Brick Wall PBR maps
│   ├── metal/        # Metal Plate PBR maps
│   ├── rock/         # Rock Surface PBR maps
│   └── rusty_metal/  # Rusty Metal PBR maps
├── public/
│   └── assets -> ../assets   # symlink (created by just install)
├── src/
│   ├── main.js       # Three.js scene, materials, UI logic
│   └── style.css     # Nord-themed UI styles
├── index.html        # Shell HTML with UI layout
├── flake.nix         # Nix dev environment (nodejs_22 + just)
├── Justfile          # Task automation
└── vite.config.js    # Vite configuration (base path for GitHub Pages)
```

## Texture Channel Availability

| Material | Albedo | Normal | Roughness | AO | Metalness | Displacement |
|---|---|---|---|---|---|---|
| Brick Wall | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Metal Plate | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Rock Surface | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Rusty Metal | ✓ | ✓ | ✓ | — | ✓ | ✓ |

## Credits

PBR textures from [ambientCG](https://ambientcg.com/), licensed under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

## License

[MIT](./LICENSE) © 2026 Jason Kuan (jason9075)
