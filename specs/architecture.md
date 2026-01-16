# Shadr Architecture

> **Note**: Update this file when making structural changes to the project.

## Overview

WebGPU-based shader/graphics editor.

## Stack

| Layer | Technology |
|-------|------------|
| UI | Solid.js / SolidStart |
| GPU | WebGPU via TypeGPU |
| Build | pnpm + Vinxi + tsup |
| Quality | Biome + TypeScript strict |

## Packages

### @shadr/app (app/)

Main application.
- `app.tsx` - Root, lazy loads editor
- `components/editor.client.tsx` - WebGPU editor (client-only)

### @shadr/lib-editor (packages/editor/)

Shared library.
- WebGPU initialization
- TypeGPU integration

## Data Flow

1. Server renders HTML shell
2. Client hydrates, lazy loads editor
3. Editor initializes WebGPU on canvas
4. (future) User edits shaders, GPU renders

## Constraints

- WebGPU required (Chrome 113+, Edge 113+)
- Node 22.x minimum
- No WebGL fallback

## Changelog

<!-- Document major changes here -->
- Initial architecture with SolidStart + TypeGPU
