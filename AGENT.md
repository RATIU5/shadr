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
  - Search Effect codebase as needed at 'node_modules/.pnpm/effect@3.19.12/node_modules/effect'

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
# Enable pinned package manager via Corepack
corepack enable

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

- **Indentation**: Spaces (2)
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

- **Best Practices**:
  - Favor simplicity over complexity
  - Favor minimalism over noise

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

- Playwright smoke tests run from `tests/e2e` and load `packages/app-web/index.html` directly for a lightweight UI boot check.
- TypeScript project references build declarations only (`emitDeclarationOnly`) to satisfy `allowImportingTsExtensions`; package scripts use `tsc -b`.
- Graph-core operations now return `Effect` results; tests use `Effect.either` with `Effect.runSync`.
- Exec engine now records missing required inputs as node error state in `ExecState.nodeErrors` and returns `null` outputs instead of failing evaluation.
- Kobalte primitives are pulled directly from `@kobalte/core` in `app-web` (no local shim package).
- IndexedDB persistence lives in `@shadr/storage-idb` (stores `GraphDocumentV1`, settings, and UI state); `EditorShell` loads on mount and uses a debounced autosave.
- Effect diagnostics treat `Effect.gen` adapter usage and try/catch inside generators as errors; prefer `Effect.gen(function* () { ... })` and wrap helper effects with `Effect.fnUntraced` when needed.
- Wire rendering is batched in `ui-canvas` using shared Graphics layers for normal/selected wires to reduce per-wire allocations at 1000-node scale.
- Kobalte primitives should be imported from their subpaths (e.g. `@kobalte/core/number-field`) to avoid SSR "Comp is not a function" errors from namespace exports.
- Subpath Kobalte modules should be imported as namespaces (e.g. `import * as NumberField from "@kobalte/core/number-field"`) to access `Root`/`Input` without SSR runtime errors.
- `app-web` runs Effectful work through `runAppEffect*` helpers and service Layers (`GraphService`, `ExecService`, `StorageService`, `UiEventService`) instead of calling Effect runners directly in components.
- Selection-driven control surfaces should batch history mutations so undo/redo stays consistent while keeping the overlay UI hidden when nothing is selected.
- Pixi-based canvas components should be loaded with `clientOnly` to avoid SSR evaluation and ensure the canvas mounts on the client.
- Subgraph evaluation enforces max depth and node-count budgets; UI prevents nesting beyond limits with user-facing toasts.
- Subgraph instances are synchronized by shared `graphId`; updating subgraph definitions or wrapper I/O propagates to all nodes referencing that `graphId`.

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
