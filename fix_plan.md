# Fix Plan (Core)

Last updated: 2026-01-18
Features reference: `FEATURES.md` (for what to work on after all tasks are complete)

> Move completed tasks to the 'Completed' section at the bottom of this file when completed

> Split code into multiple files when possible, to keep file sizes smaller and more managable/maintainable

> Keep ALL CODE simple, readable, and maintainable. Don't be smart or overengineer. Favor simplicity over complexity. When working with UI/UX, focus on simplicity and situational-aware UI updates.

## Critical

- [ ] Read current UI overlay/canvas code to understand existing structure and then delete/reset the UI layer to restart cleanly, while keeping Solid.js reactivity, Kobalte UI components, Lucide icons, and TailwindCSS-only styling; keep text minimal, show only when essential, use color to indicate state (valid/invalid/warning/info/primary), keep UI minimal and dynamic. **YOU MUST DELETE THE CURRENT UI AND RESTART WITH THESE THINGS IN MIND**
- [ ] Rebuild the base layout: full-screen canvas plus minimal overlay containers, using Solid.js signals/stores, Kobalte primitives, Lucide icons, and Tailwind; text only when needed, state colors only, no extra UI, keep minimal always.
- [ ] Implement the bottom Figma-like control menu that changes per selected node and resets on deselect, with max-height + internal scroll (if needed); Solid.js/Kobalte/Lucide/Tailwind only, minimal text, state colors.
- [ ] Add a context-driven side panel that is hidden by default and appears only when a node or other canvas element is selected; max-height + scroll; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only.
- [ ] Add a minimal context menu over the canvas (right-click/long-press), context-aware; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only.
- [ ] Add a Raycast-style command palette with fuzzy search for commands/nodes/controls; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only.
- [ ] Implement undo/redo UI affordance + keyboard shortcuts and hook to history; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only.
- [ ] Implement IndexedDB persistence for all editor state (graph, settings, UI layout, recent/last doc), including autosave feedback; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only.
- [ ] Add essential minimal status/notifications (errors, autosave, compile/result), touch/mouse/keyboard parity, and light/dark themes tied to system settings; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only.

## High Priority

_None._

## Medium Priority

- [ ] Add import/export graph from file (JSON) with schema version + migration hook

## Low Priority

- [ ] Add wire hover labels (type/value) with debounce; keep off by default for perf
- [ ] Add wire animated “data flow” visualization (very easy to make expensive; only if perf budget allows)
- [ ] Add network boxes/frames: basic rectangle + title; grouping behavior can wait
- [ ] Add z-ordering controls (bring to front/back) if you end up needing it for overlapping nodes
- [ ] Add icon pack integration (Lucide) for node types (purely cosmetic)
- [ ] Add breadcrumb plumbing placeholders for future subgraphs (no real subgraphs in MVP)

## Completed

- [x] Add “graph diagnostics” view (dev-only): counts, memory estimates, perf stats
- [x] Add execution debug console: a panel that logs evaluations, cache hits, and node errors (dev-only)
- [x] Add node header UI details: title, collapse toggle (collapse can simply hide params), small status badges for error/bypass
- [x] Add selection rectangle visuals + multi-node drag bounding logic, snap-to-grid for moves
- [x] Add grid rendering polish: major/minor lines, fade by zoom; keep it cheap on GPU
- [x] Add soft canvas boundaries notification when nothing in view (overlay toast)
- [x] Add “select connected” utilities (upstream/downstream/all) for productivity
- [x] Add wire insertion helper (tap wire / context action “insert node on wire”) limited to conversion nodes and a few common nodes
- [x] Add reroute/dot nodes (optional): create, drag, delete; treat as pass-through nodes in graph-core to keep wiring simple
- [x] Create initial built-in node pack (MVP-realistic): constants (float/int/bool/vec), math ops, compose vec, swizzle, clamp, lerp, simple color node, preview/output nodes (image + code/text) (preview window only calulated on button click, not automatically)
- [x] Add deterministic “compile/export” pipeline for Output nodes: output node type decides artifact (image/code/text); can render to a panel or download blob
- [x] Adjust the canvas grid to render the grid lines dynamically: as you zoom in, more subdivided lines appear through opacity changes, and as you zoom out, the subdivided lines dissapear via opacity to get a smooth effect
- [x] Establish Effect-based app services: `GraphService`, `ExecService`, `StorageService`, `UiEventService` as Layers; keep UI components calling Effects via adapters (avoid Effects directly in components except via helpers)
- [x] Add settings (stored in IndexedDB): zoom/pan sensitivity, grid show/hide, snap-to-grid toggle (snap can be simple)
- [x] Add frame/zoom helpers: frame selected, zoom-to-fit all nodes (keybinds)
- [x] Add duplicate (Ctrl+D) with offset and preserved connections among duplicated nodes
- [x] Add clipboard copy/paste (in-app): serialize selection to JSON, paste creates new ids and preserves internal connections (cross-app compatibility can be later)
- [x] Add minimal “inspector” panel: selected node type, params editor, list of sockets with last cached values + type
- [x] Implement graph validation warnings: missing required inputs, incompatible connections (should be prevented), unused nodes (optional but helpful)
- [x] Implement max connection constraints: input 1, outputs many; allow node definition to override min/max; enforce in validation + UI feedback
- [x] Add a clean application font family for the UI interface
- [x] Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'canvas') at get view (pixi\_\_js.js?v=d11e9b6f:1151:131) at setupPixi (EditorCanvas.tsx:589:33)
- [x] Deprecation issues: Application.view is deprecated, please use Application.canvas instead.Deprecated since v8.0.0 & Application constructor options are deprecated, please use Application.init() instead.Deprecated since v8.0.0
- [x] Implement wire styles: bezier curves, type color coding, hover highlight, selected state; keep wire labels optional until later
- [x] Implement right-click context menu on canvas: add node here, delete, disconnect wire, basic actions; position correctly under camera transform
- [x] Fix frontend "Comp is not a function" error in `ParamEditor` by importing Kobalte subpath modules as namespaces (SSR-safe components).
- [x] Implement quick-add (space/Tab): opens palette (Kobalte dialog/popover), fuzzy search, creates node at cursor world position
- [x] TypeError: Comp is not a function at createComponent (./node_modules/.pnpm/solid-js@1.9.10/node_modules/solid-js/dist/server.js:398:15) at renderNumberField (./packages/app-web/src/components/ParamEditor.tsx:63:433) at eval (./packages/app-web/src/components/ParamEditor.tsx:118:16) at Array.map (<anonymous>) at ParamEditor (./packages/app-web/src/components/ParamEditor.tsx:114:147) at createComponent (./node_modules/.pnpm/solid-js@1.9.10/node_modules/solid-js/dist/server.js:398:15) at ParamMeasureItem (./packages/app-web/src/components/NodeParamMeasure.tsx:49:288)
- [x] Implement basic node library: searchable list (fuzzy) of registered nodes, click/drag to add; favorites/recent can be deferred
- [x] TypeError: Comp is not a function at createComponent server.js
- [x] Get the web-app to render correctly: defer Pixi initialization to client-only dynamic import to avoid SSR/runtime issues and tighten app-web semantics.
- [x] TypeError (0 , **vite_ssr_import_5**.createToaster) is not a function or its return value is not iterable EditorShell.tsx if (!node) { return null; } return getNodeCatalogEntry(node.type) ?? null; }); const inspectorRows = createMemo(() => { const node = selectedNode(); if (!node) { return [ { label: "Node", value: "None selected" }, { label: "Inputs", value: "0" }, { label: "Outputs", value: "0" }, { label: "Status", value: "Idle" }, ]; } const status = isDirty(store.dirtyState(), node.id) ? "Dirty" : "Clean";
- [x] Implement node states rendering: selected, error, bypassed (keep only bypass for MVP state management), plus hover states; ensure visual hierarchy is clear
- [x] Implement node auto-sizing: measure DOM param panels and communicate layout to Pixi nodes; cache measurements and update only when content changes
- [x] Add viewport culling for wires (render only wires whose endpoints or bounding boxes intersect viewport) (implemented in `ui-canvas` scene wire bounds checks against camera world bounds)
- [x] Performance pass for 1000 nodes: wire rendering strategy (batched geometry or simplified segments), avoid per-frame allocations, avoid Solid reactive churn for Pixi objects (keep Pixi state imperative)
- [x] Frontend error: [plugin:vite:import-analysis] Failed to resolve entry for package "@shadr/ui-canvas". The package may have incorrect main/module/exports specified in its package.json. Double check all exports in packages to make sure they are all correct.
- [x] Convert all CSS on frontend app to use TailwindCSS
- [x] Fix type errors and lint errors, also fix this client error: ([plugin:vite:import-analysis] Failed to resolve entry for package "@shadr/storage-idb". The package may have incorrect main/module/exports specified in its package.json.
      ./packages/app-web/src/components/EditorShell.tsx:4:53)
- [x] Implement undo/redo (graph-aware): command log for node add/remove, wire connect/disconnect, move, param change; include batching for drags and marquee operations
- [x] Implement error model end-to-end: domain errors for validation/execution; node runtime errors captured and surfaced as node error state without crashing the app
- [x] Implement value preview: socket hover tooltip shows cached value; optionally compute-on-hover behind a debounce only for already-selected output path
- [x] Implement persistence in `storage-idb`: IndexedDB store for `GraphDocumentV1`, settings, UI state; debounced autosave on graph mutations; crash-safe load on startup
- [x] Implement connection attempt UX feedback: hover target validation (type mismatch, cycle, max connections), “ghost wire” preview, commit only when valid
- [x] Implement minimal overlay UI shell in `app-web` (Solid + Kobalte): app layout, left node library panel placeholder, right inspector placeholder, top bar (open/save status), notifications/toasts
- [x] Implement core editor interactions (must-have): create node, drag node(s), marquee select, connect wire (drag from output → input), disconnect wire, delete node(s), delete wire(s)
- [x] Implement hit testing in Pixi: node body, socket hotspots (larger than visible), wire selection hit area; integrate with Solid state for selection + hover
- [x] Create Pixi rendering layer in `ui-canvas`: scene graph structure (layers: grid, wires, nodes, overlays) with stable object mapping by IDs (no full re-create per tick)
- [x] Build execution engine in `exec-engine` (pull-based): `evaluateSocket(socketId)` computes upstream lazily; compute only the requested closure (use Effect when applicable)
- [x] Define null/undefined propagation rules: required missing input yields typed error state + output `null` (or “no value”) consistently; ensure UI can render these states (use Effect when applicable)
- [x] Implement node definition contract (pure functions): `compute(inputs, params, ctx) -> outputs` with typed input/output sockets; enforce purity by convention (no IO APIs exposed in ctx) (use Effect when applicable)
- [x] Implement synchronous message bus/event system (Effect-based): typed event map, sync dispatch by default, explicit “deferred” channel for expensive listeners (still sync compute engine) (use Effect when applicable)
- [x] Implement `plugin-system` (internal-only): registry for node definitions + socket types + UI parameter schema; lifecycle hooks `init/destroy` with access to message bus + graph API (use Effect when applicable)
- [x] Implement cycle detection on connect (fast): incremental cycle check using DFS from target → source via adjacency before committing the wire; return structured cycle path for UI feedback (use Effect when applicable)
- [x] Implement socket type system in `shared`: primitives enum + metadata, exact-match compatibility, and wire validation so connections require explicit conversion nodes rather than implicit casting.
- [x] Implement traversal utilities for 1000-node scale: upstream/downstream dependency closure, connected components, and “execution subgraph” derivation by requested output sockets (use Effect when applicable) — enables consistent dependency queries and execution scoping for large graphs
- [x] Implement graph operations API (pure) with validation results: `addNode`, `removeNode`, `moveNode(s)`, `addWire`, `removeWire`, `updateParam` returning `Effect` success or typed domain errors (reroute helper deferred for now)
- [x] Define shared identity types in `shared`: `NodeId`, `SocketId`, `WireId`, `GraphId`, branded types, plus `NonEmptyArray`, `Result`/`Either` helpers (prefer Effect types)
- [x] Implement core Graph data model in `graph-core` (no UI): `Node`, `Socket`, `Wire`, `Graph` as immutable-ish state transitions (Effect-friendly reducers), plus adjacency indexes (incoming/outgoing) optimized for 1000 nodes (use Effect when applicable)
- [x] Add “bundle/perf guardrails”: build output size report and a simple perf benchmark for 1000-node render (dev script, not CI required yet)
- [x] Ensure Effect-ts (see root package.json for catalog versions) is installed and used correctly in all packages that will need Effect, anything with layers or services or composability in the core packages
- [x] Add Playwright smoke test for app boot + basic node creation/connect (one test is enough for MVP confidence)
- [x] Add `pnpm -r` scripts and Turbo pipelines: `build`, `dev`, `typecheck`, `lint`, `test` with correct dependency graph
- [x] Add `vitest` + `@vitest/coverage-v8` for core packages; add unit tests for graph validation, topo sort, cycle detect, dirty propagation (added `vitest.config.ts`, graph-core/exec-engine test suites, and lightweight graph/dirty helpers to support coverage)
- [x] Add `eslint` type-aware config that uses package `tsconfig.json` references (avoid “project: true” pitfalls by scoping configs per package) (done via per-package `parserOptions.project` in `eslint.config.js` to keep type-aware linting scoped and fast)
- [x] Establish strict TypeScript foundation (repo-wide): `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, project references enabled
- [x] Set up lint/format policy: ESLint flat config (type-aware) + Prettier + import ordering; enforce “no default export” in libraries (except Solid components if you prefer), and ban `any` in core packages
- [x] GitHub Actions: `ci.yml` running on PR + main: install (pnpm), typecheck (tsc -b), lint, tests, build (turbo) with caching to block regressions early and speed repeats
- [x] Add `changesets` for versioning packages (even if private) to keep releases clean; or keep a single app version if you prefer
- [x] Add “quality gates”: block merge if typecheck/lint fails; enforce formatting via CI
- [x] Create monorepo skeleton (pnpm workspaces + Turborepo) with packages: `app-web`, `graph-core`, `exec-engine`, `ui-canvas`, `ui-overlay`, `plugin-system`, `storage-idb`, `shared`, `devtools` (optional)
- [x] Add repo-wide tooling baseline: Node LTS via `.nvmrc` + `.node-version`, `corepack` enabled, pinned pnpm version in `packageManager`, consistent ESM strategy (pick ESM-only unless you have a hard reason not to)
- [x] Define versioned graph JSON schema in `shared`: `GraphDocumentV1` with explicit `schemaVersion`, migrations interface, stable IDs, and deterministic ordering rules for serialization (enables deterministic storage and future migrations)
- [x] Add memoization + dirty propagation (node-level cache): maintain `dirty` flags, cache outputs by node+socket, invalidate downstream on param change / wiring change / upstream invalidation (use Effect when applicable)
- [x] Add deterministic topological order generation for the requested subgraph (stable sorting by id/creation index to avoid flicker in debug/preview)
- [x] Implement viewport/camera: world↔screen transforms, pan + zoom, pixel ratio handling, and frustum culling (only render visible nodes/wires) tuned for ~1000 nodes
- [x] Implement parameter editing (DOM overlay, not Pixi): for basic params (float/int/bool/vec) using Kobalte controls; edits emit events → dirty propagation
- [x] Implement output request pipeline: “Output node selected” triggers evaluation; do not auto-execute whole graph continuously—only on explicit preview/output request or param changes affecting previewed output
- [x] Add “graph executed” instrumentation: timing per node compute, total evaluation time, cache hit/miss counts (for later perf tuning, visible in devtools)
