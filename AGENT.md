# Shadr Agent Instructions

> **Operational instructions only.**  
> Status updates, progress, and task tracking belong in `fix_plan.md`.

This document is intended for **LLM agents** working in this repository.  
If information here conflicts with the codebase or other canonical docs, **update this file to match the correct architecture** rather than following outdated assumptions.

---

## Overview

Single-user, offline-first **node-based editor** for deterministic data / shader / code generation.

- **Execution model**: pull-based, lazy, pure functions only
- **Rendering**: PixiJS (WebGL) for canvas
- **UI framework**: SolidJS with Kobalte
- **Composition & services**: Effect (effect-ts)
- **Persistence**: IndexedDB
- **Target scale**: ~1000 nodes
- **Plugins**: internal-only (node packs, socket types)

This is **not** a collaborative app, **not** async-first, and **not** WebGPU-based at the core.

---

## Architecture Summary (Authoritative)

### Core Stack

- **SolidJS**
  - App shell, panels, inspectors, dialogs, context menus
  - Fine-grained reactivity
  - No canvas rendering in Solid components
  - Node input elements use SolidJS form controls from UI library Kobalte (positioned where node is absolutely)
  - TailwindCSS classes for component styles

- **PixiJS**
  - Nodes, sockets, wires, grid, selection, hit-testing
  - Imperative rendering
  - Viewport + world transforms
  - DOM overlays only when Pixi is unsuitable

- **Effect (effect-ts)**
  - Graph operations
  - Execution orchestration
  - Storage access
  - Event bus
  - Error modeling
  - Service boundaries (Layers)

- **TypeScript**
  - Strict mode enabled
  - No `any`
  - Branded ID types
  - Deterministic data models

---

## Execution Model

- **Pull-based / lazy**
  - Nothing executes unless an output is requested
- **Pure nodes only**
  - Node output depends _only_ on inputs + params
  - No side effects, IO, timers, or async
- **Memoized**
  - Per-node caching with dirty propagation
- **Topologically sorted**
  - Only upstream dependencies of requested output execute
- **Deterministic**
  - Same graph + inputs = same outputs

---

## Graph Model

- Adjacency-list based
- Stable IDs for nodes, sockets, wires
- Strictly typed sockets
- No implicit type casting
- Explicit conversion nodes only
- Cycles prevented at connection time
- Validation before mutation

---

## Repository Structure (Monorepo)

- **pnpm workspaces**
- **Turborepo** for orchestration

Typical packages:

- `graph-core` – graph data model & validation
- `exec-engine` – execution, caching, dirty propagation
- `ui-canvas` – PixiJS rendering + interactions
- `ui-overlay` – SolidJS UI components
- `plugin-system` – internal plugin registry
- `storage-idb` – IndexedDB persistence
- `shared` – types, schemas, utilities
- `app-web` – application entry point

---

## Commands

```bash
# Install dependencies
pnpm install

# Validation (run before committing)
pnpm typecheck        # TypeScript project references
pnpm lint             # ESLint (type-aware)
pnpm format           # Prettier
pnpm test             # Unit tests (core packages)
```

If a command is missing or fails, **update this section** to reflect the real workflow.

---

## Code Patterns & Conventions

- **Indentation**: Tabs
- **Quotes**: Double quotes
- **Modules**: ESM
- **Types**:
  - Strict TypeScript
  - No `any`
  - Prefer `unknown` + refinement

- **Exports**:
  - Prefer named exports
  - Avoid default exports in libraries

- **IDs**:
  - Use branded types (`NodeId`, `SocketId`, etc.)

- **Errors**:
  - Modeled as domain errors, not thrown arbitrarily

- **Effects**:
  - Graph, execution, storage, and events are accessed via Effect services
  - UI components call Effects through adapters/helpers
  - Do not embed business logic directly in components

---

## Rendering Rules (Important)

- PixiJS objects are **imperative**
- Do **not** make Pixi objects reactive
- Solid state drives _intent_, not frame-by-frame rendering
- Execution loop and render loop are **separate**
- Culling is required for performance
- Hit areas must be larger than visible geometry

---

## Persistence & History

- IndexedDB for:
  - Graph documents
  - Settings
  - UI state

- Versioned JSON schemas
- Autosave on meaningful mutations
- Undo/redo is graph-aware and command-based

---

## Plugin System (Internal)

- Used for:
  - Node types
  - Socket types
  - UI widgets

- No third-party plugins
- Plugins register behavior; they do not mutate core state directly
- Node compute functions must remain pure

---

## What This App Is **Not**

- Not multi-user
- Not collaborative
- Not async-node-based
- Not WebGPU-first
- Not DOM-canvas-based
- Not permissively typed

If you see patterns suggesting otherwise, **they are wrong** and should be corrected.

---

## Learnings

> Add discoveries here that help future iterations avoid mistakes.

<!-- Example:
- Pixi hit testing must account for world transforms
- Dirty propagation must be downstream-only
- Avoid reactive bindings between Solid state and Pixi objects
-->

---

## Guardrails

> Add recurring mistakes here so future agents avoid them.

<!-- Example:
- DO NOT introduce async into node execution
- DO NOT use implicit type casting between sockets
- DO NOT trigger execution on every UI change
- ALWAYS validate graph mutations before committing
- ALWAYS run pnpm typecheck before committing
-->

---

## Agent Directive

If you (the LLM) encounter **conflicting assumptions**:

1. Trust the **codebase**
2. Update **this document**
3. Update **fix_plan.md** if work is required

Do **not** silently work around incorrect architecture assumptions.
