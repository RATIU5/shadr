# Learnings

Add discoveries here that help future iterations avoid mistakes.

- Playwright smoke tests run from `tests/e2e` and load `packages/app-web/index.html` directly for a lightweight UI boot check.
- TypeScript project references build declarations only (`emitDeclarationOnly`) to satisfy `allowImportingTsExtensions`; package scripts use `tsc -b`.
- Graph-core operations now return `Effect` results; tests use `Effect.either` with `Effect.runSync`.
- Exec engine now records missing required inputs as node error state in `ExecState.nodeErrors` and returns `null` outputs instead of failing evaluation.
- Kobalte primitives are pulled directly from `@kobalte/core` in `app-web` (no local shim package).
- IndexedDB persistence lives in `@shadr/storage-idb` (stores `GraphDocumentV1`, settings, and UI state); `EditorShell` loads on mount and uses a debounced autosave.
- Effect diagnostics treat `Effect.gen` adapter usage and try/catch inside generators as errors; prefer `Effect.gen(function* () { ... })` and wrap helper effects with `Effect.fnUntraced` when needed.
- Wire rendering is batched in `ui-canvas` using shared Graphics layers for normal/selected wires to reduce per-wire allocations at 1000-node scale.
- Kobalte primitives should be imported from their subpaths (for example, `@kobalte/core/number-field`) to avoid SSR "Comp is not a function" errors from namespace exports.
- Subpath Kobalte modules should be imported as namespaces (for example, `import * as NumberField from "@kobalte/core/number-field"`) to access `Root` and `Input` without SSR runtime errors.
- `app-web` runs Effectful work through `runAppEffect*` helpers and service Layers (`GraphService`, `ExecService`, `StorageService`, `UiEventService`) instead of calling Effect runners directly in components.
- Selection-driven control surfaces should batch history mutations so undo/redo stays consistent while keeping the overlay UI hidden when nothing is selected.
- Pixi-based canvas components should be loaded with `clientOnly` to avoid SSR evaluation and ensure the canvas mounts on the client.
- Subgraph evaluation enforces max depth and node-count budgets; UI prevents nesting beyond limits with user-facing toasts.
- Subgraph instances are synchronized by shared `graphId`; updating subgraph definitions or wrapper I/O propagates to all nodes referencing that `graphId`.
- Background output evaluation runs in a web worker via `app-web`'s exec worker client to keep UI responsive; canceling terminates the worker and reports `ExecutionCanceled`.
- Subgraph promoted params are stored in `SubgraphNodeParams.promotedParams` and synced across instances via `replace-node-io` when sockets are added or removed.
- DOM overlay layering uses CSS z-index tokens in `app.css` (`--layer-*`) with pointer-events pass-through; panels use `z-[var(--layer-panel)]` and the toast region is `pointer-events-none` with clickable children.
