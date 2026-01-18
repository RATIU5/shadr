# Fix Plan (Core)

Last updated: 2026-01-17
Features reference: `FEATURES.md` (for what to work on after all tasks are complete)

> Move completed tasks to the 'Completed' section at the bottom of this file when completed

> Split code into multiple files when possible, to keep file sizes smaller and more managable/maintainable

## Critical

- [ ] Ensure Effect-ts (see root package.json for catalog versions) is installed and used correctly in all packages that will need Effect, anything with layers or services or composability in the core packages
- [ ] Add “bundle/perf guardrails”: build output size report and a simple perf benchmark for 1000-node render (dev script, not CI required yet)
- [ ] Define shared identity types in `shared`: `NodeId`, `SocketId`, `WireId`, `GraphId`, branded types, plus `NonEmptyArray`, `Result`/`Either` helpers (prefer Effect types)
- [ ] Define versioned graph JSON schema in `shared`: `GraphDocumentV1` with explicit `schemaVersion`, migrations interface, stable IDs, and deterministic ordering rules for serialization
- [ ] Implement core Graph data model in `graph-core` (no UI): `Node`, `Socket`, `Wire`, `Graph` as immutable-ish state transitions (Effect-friendly reducers), plus adjacency indexes (incoming/outgoing) optimized for 1000 nodes
- [ ] Implement graph operations API (pure) with validation results: `addNode`, `removeNode`, `moveNode(s)`, `addWire`, `removeWire`, `updateParam`, `addRerouteNode` (optional for MVP), each returning `Effect` success or typed domain errors
- [ ] Implement traversal utilities for 1000-node scale: upstream/downstream dependency closure, connected components, and “execution subgraph” derivation by requested output sockets
- [ ] Implement cycle detection on connect (fast): incremental cycle check using DFS from target → source via adjacency before committing the wire; return structured cycle path for UI feedback
- [ ] Implement socket type system in `shared`: primitives enum + metadata; “exact match only” compatibility; explicit conversion nodes only (no implicit casting)
- [ ] Implement `plugin-system` (internal-only): registry for node definitions + socket types + UI parameter schema; lifecycle hooks `init/destroy` with access to message bus + graph API
- [ ] Implement synchronous message bus/event system (Effect-based): typed event map, sync dispatch by default, explicit “deferred” channel for expensive listeners (still sync compute engine)
- [ ] Implement node definition contract (pure functions): `compute(inputs, params, ctx) -> outputs` with typed input/output sockets; enforce purity by convention (no IO APIs exposed in ctx)
- [ ] Build execution engine in `exec-engine` (pull-based): `evaluateSocket(socketId)` computes upstream lazily; compute only the requested closure
- [ ] Add memoization + dirty propagation (node-level cache): maintain `dirty` flags, cache outputs by node+socket, invalidate downstream on param change / wiring change / upstream invalidation
- [ ] Define null/undefined propagation rules: required missing input yields typed error state + output `null` (or “no value”) consistently; ensure UI can render these states
- [ ] Add deterministic topological order generation for the requested subgraph (stable sorting by id/creation index to avoid flicker in debug/preview)
- [ ] Implement error model end-to-end: domain errors for validation/execution; node runtime errors captured and surfaced as node error state without crashing the app
- [ ] Create Pixi rendering layer in `ui-canvas`: scene graph structure (layers: grid, wires, nodes, overlays) with stable object mapping by IDs (no full re-create per tick)
- [ ] Implement viewport/camera: world↔screen transforms, pan + zoom, pixel ratio handling, and frustum culling (only render visible nodes/wires) tuned for ~1000 nodes
- [ ] Implement hit testing in Pixi: node body, socket hotspots (larger than visible), wire selection hit area; integrate with Solid state for selection + hover
- [ ] Implement core editor interactions (must-have): create node, drag node(s), marquee select, connect wire (drag from output → input), disconnect wire, delete node(s), delete wire(s)
- [ ] Implement connection attempt UX feedback: hover target validation (type mismatch, cycle, max connections), “ghost wire” preview, commit only when valid
- [ ] Implement minimal overlay UI shell in `app-web` (Solid + Kobalte): app layout, left node library panel placeholder, right inspector placeholder, top bar (open/save status), notifications/toasts
- [ ] Implement parameter editing (DOM overlay, not Pixi): for basic params (float/int/bool/vec) using Kobalte controls; edits emit events → dirty propagation
- [ ] Implement output request pipeline: “Output node selected” triggers evaluation; do not auto-execute whole graph continuously—only on explicit preview/output request or param changes affecting previewed output
- [ ] Implement value preview: socket hover tooltip shows cached value; optionally compute-on-hover behind a debounce only for already-selected output path
- [ ] Implement persistence in `storage-idb`: IndexedDB store for `GraphDocumentV1`, settings, UI state; debounced autosave on graph mutations; crash-safe load on startup
- [ ] Implement undo/redo (graph-aware): command log for node add/remove, wire connect/disconnect, move, param change; include batching for drags and marquee operations
- [ ] Add “graph executed” instrumentation: timing per node compute, total evaluation time, cache hit/miss counts (for later perf tuning, visible in devtools)

## High Priority

- [ ] Performance pass for 1000 nodes: wire rendering strategy (batched geometry or simplified segments), avoid per-frame allocations, avoid Solid reactive churn for Pixi objects (keep Pixi state imperative)
- [ ] Add viewport culling for wires (render only wires whose endpoints or bounding boxes intersect viewport)
- [ ] Implement node auto-sizing: measure DOM param panels and communicate layout to Pixi nodes; cache measurements and update only when content changes
- [ ] Implement node states rendering: selected, error, bypassed (keep only bypass for MVP state management), plus hover states; ensure visual hierarchy is clear
- [ ] Implement basic node library: searchable list (fuzzy) of registered nodes, click/drag to add; favorites/recent can be deferred
- [ ] Implement quick-add (space/Tab): opens palette (Kobalte dialog/popover), fuzzy search, creates node at cursor world position
- [ ] Implement right-click context menu on canvas: add node here, delete, disconnect wire, basic actions; position correctly under camera transform
- [ ] Implement wire styles: bezier curves, type color coding, hover highlight, selected state; keep wire labels optional until later
- [ ] Implement max connection constraints: input 1, outputs many; allow node definition to override min/max; enforce in validation + UI feedback
- [ ] Implement graph validation warnings: missing required inputs, incompatible connections (should be prevented), unused nodes (optional but helpful)
- [ ] Add minimal “inspector” panel: selected node type, params editor, list of sockets with last cached values + type
- [ ] Add clipboard copy/paste (in-app): serialize selection to JSON, paste creates new ids and preserves internal connections (cross-app compatibility can be later)
- [ ] Add duplicate (Ctrl+D) with offset and preserved connections among duplicated nodes
- [ ] Add frame/zoom helpers: frame selected, zoom-to-fit all nodes (keybinds)
- [ ] Add settings (stored in IndexedDB): zoom/pan sensitivity, grid show/hide, snap-to-grid toggle (snap can be simple)
- [ ] Establish Effect-based app services: `GraphService`, `ExecService`, `StorageService`, `UiEventService` as Layers; keep UI components calling Effects via adapters (avoid Effects directly in components except via helpers)
- [ ] Add deterministic “compile/export” pipeline for Output nodes: output node type decides artifact (image/code/text); can render to a panel or download blob
- [ ] Create initial built-in node pack (MVP-realistic): constants (float/int/bool/vec), math ops, compose vec, swizzle, clamp, lerp, simple color node, preview/output nodes (image + code/text) (preview window only calulated on button click, not automatically)

## Medium Priority

- [ ] Add reroute/dot nodes (optional): create, drag, delete; treat as pass-through nodes in graph-core to keep wiring simple
- [ ] Add wire insertion helper (tap wire / context action “insert node on wire”) limited to conversion nodes and a few common nodes
- [ ] Add “select connected” utilities (upstream/downstream/all) for productivity
- [ ] Add soft canvas boundaries notification when nothing in view (overlay toast)
- [ ] Add grid rendering polish: major/minor lines, fade by zoom; keep it cheap on GPU
- [ ] Add selection rectangle visuals + multi-node drag bounding logic, snap-to-grid for moves
- [ ] Add node header UI details: title, collapse toggle (collapse can simply hide params), small status badges for error/bypass
- [ ] Add execution debug console: a panel that logs evaluations, cache hits, and node errors (dev-only)
- [ ] Add “graph diagnostics” view (dev-only): counts, memory estimates, perf stats
- [ ] Add import/export graph from file (JSON) with schema version + migration hook

## Low Priority

- [ ] Add wire hover labels (type/value) with debounce; keep off by default for perf
- [ ] Add wire animated “data flow” visualization (very easy to make expensive; only if perf budget allows)
- [ ] Add network boxes/frames: basic rectangle + title; grouping behavior can wait
- [ ] Add z-ordering controls (bring to front/back) if you end up needing it for overlapping nodes
- [ ] Add icon pack integration (Lucide) for node types (purely cosmetic)
- [ ] Add breadcrumb plumbing placeholders for future subgraphs (no real subgraphs in MVP)

## Completed

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
