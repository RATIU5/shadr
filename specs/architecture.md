# Shadr Architecture

> **Note**: Update this file when making structural changes to the project.

## Overview

Pixi.js-based shader/graphics editor.

## Stack

| Layer     | Technology                    |
| --------- | ----------------------------- |
| UI        | Solid.js / SolidStart         |
| Rendering | Pixi.js (WebGL/WebGPU/Canvas) |
| Build     | pnpm + Vinxi + tsup           |
| Quality   | Biome + TypeScript strict     |

## Packages

### @shadr/app (app/)

Main application.

- `app.tsx` - Root, lazy loads editor
- `components/editor.client.tsx` - Pixi.js editor (client-only)
- `components/editor/*` - UI subcomponents (overlays, modals, action bar, preview)

### @shadr/lib-editor (packages/editor/)

Shared library.

- Node-based editor on infinite grid
- Pixi.js initialization
- Editor helpers split into modules (`src/types.ts`, `src/visual-settings.ts`, `src/templates.ts`, `src/node-families.ts`, `src/math-ops.ts`, `src/serialization.ts`, `src/shader.ts`, `src/grid.ts`, `src/search.ts`, `src/const-editor.ts`, `src/dropdown-editor.ts`, `src/editor-state.ts`, `src/nodes.ts`, `src/groups.ts`, `src/connections.ts`, `src/history.ts`, `src/debug.ts`)

## Data Flow

1. Server renders HTML shell
2. Client hydrates, lazy loads editor
3. Editor initializes Pixi.js on canvas
4. (future) User edits shaders, GPU renders

## Constraints

- WebGL/WebGPU-capable browser required
- No Canvas 2D fallback

## Changelog

<!-- Document major changes here -->

- Initial architecture with SolidStart + Pixi.js
