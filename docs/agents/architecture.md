# Architecture and Repo Layout

## Overview

Single-user, offline-first node-based editor for deterministic data, shader, and code generation.

## Core Stack

- SolidJS
  - App shell, panels, inspectors, dialogs, context menus
  - Fine-grained reactivity
  - No canvas rendering in Solid components
  - Node input elements use SolidJS form controls from Kobalte (positioned at the node)
  - TailwindCSS classes for component styles

- PixiJS
  - Nodes, sockets, wires, grid, selection, hit-testing
  - Imperative rendering
  - Viewport and world transforms
  - DOM overlays only when Pixi is unsuitable

- Effect (effect-ts)
  - Graph operations
  - Execution orchestration
  - Storage access
  - Event bus
  - Error modeling
  - Service boundaries (Layers)
  - Search Effect codebase as needed at `node_modules/.pnpm/effect@3.19.12/node_modules/effect`

- TypeScript
  - Strict mode enabled
  - No `any`
  - Branded ID types
  - Deterministic data models

## Repository Structure (Monorepo)

- pnpm workspaces
- Turborepo for orchestration

Typical packages:

- `graph-core` - graph data model and validation
- `exec-engine` - execution, caching, dirty propagation
- `ui-canvas` - PixiJS rendering and interactions
- `ui-overlay` - SolidJS UI components
- `plugin-system` - internal plugin registry
- `storage-idb` - IndexedDB persistence
- `shared` - types, schemas, utilities
- `app-web` - application entry point
