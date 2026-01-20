# Fix Plan

Last updated: 2026-01-19
Features reference: `FEATURES.md` (for what to work on after all tasks are complete)

> Move completed tasks to the 'Completed' section at the bottom of this file when completed

> Split code into multiple files when possible, to keep file sizes smaller and more managable/maintainable

> Keep ALL CODE simple, readable, and maintainable. Don't be smart or overengineer. Favor simplicity over complexity. When working with UI/UX, focus on simplicity and situational-aware UI updates.

> Break up large tasks or add context to tasks by adding new tasks to this list. Don't modify existing tasks.

## Critical

- [ ] Type error: No overload matches this call. The last overload gave the following error. Object literal may only specify known properties, and inline does not exist in type DepsOptions. (ts 2769) (vitest.config.ts)
- [ ] Test failure: `packages/ui-overlay/test/exports.test.ts` cannot resolve `@shadr/ui-overlay`
- [ ] Test failure: `packages/graph-core/test/topo-sort.test.ts` throws `SocketConnectionLimitExceeded` during setup
- [ ] Test failure: `vitest` jsdom workers fail to start (missing `jsdom`) for `packages/app-web/test/command-palette.test.tsx` and `packages/app-web/test/keybinding-settings-panel.test.tsx`
- [ ] Test run 2026-01-19: `packages/ui-overlay/test/exports.test.ts` cannot resolve `@shadr/ui-overlay`
- [ ] Test run 2026-01-19: `packages/graph-core/test/topo-sort.test.ts` throws `SocketConnectionLimitExceeded`
- [ ] Test run 2026-01-19: Vitest jsdom workers fail to start (missing `jsdom`) for `packages/app-web/test/command-palette.test.tsx` and `packages/app-web/test/keybinding-settings-panel.test.tsx`
- [ ] Test run 2026-01-19: `packages/app-web/test/command-palette.test.tsx` throws "Client-only API called on the server side" (lucide-solid icon render)
- [ ] Test run 2026-01-19: `packages/app-web/test/keybinding-settings-panel.test.tsx` throws "Client-only API called on the server side"

## High Priority

- [ ] Remove the double click functionality to create a new node (double click is reserved for only entering subgraphs and renaming text on the canvas, these features will be implemented later)
- [ ] Change the CMD + K command palette shortcut to be the space bar (shortcut not active when text input is active anywhere in the app)
- [ ] Allow search by tag type in command menu (cmd/command, control/ctrl/ctl, node)
- [ ] The group frame needs to have a larger hit area at the corners to resize
- [ ] Double-clicking text rendered on the canvas should open a text input to allow for renaming (form with text input and clear/reset button on the same row as icons)
- [ ] Subgraphs should change the command menu at the bottom, provide options like forms to create inputs/outputs, uncollapse, etc...
- [ ] Labels for sockets need to appear inside the node box, and have "smart" width: too long of text is condensed to "..." in the middle, leaving the letters on each end visible
- [ ] Reloading the app breaks the subgraphs and renames the "main" graph layer, while removing the inner subgraph. Ensure the functionality for subgraphs is robust
- [ ] The settings dialog needs to have a max height with scrollable contents
- [ ] Smart keyboard shortcut setting: global key down listener, list each key stroke in the disabled input box, and a complex layer for parsing/processing key strokes matching them up with valid/stored shortcuts and pass that event through the event bus
- [ ] In the UI, prefer icons over text for buttons when possible
- [ ] Re-create the rendering for the node box in Pixi.js. Sockets need to be rendered on top of the box on the edge/border of the box, the border needs to remain the same size throughout the box on all sides (currently it's incosistent: thicker and thinner in some areas, prefer thinner border), use icons (svg) over text whne possible (convert the "v" collapse letter to an actual cheveron icon)
- [ ] The sub grid items disappear as you zoom out, leaving only the middle y and x lines visible. The grid lines adjust dynamically: as you zoom in, more subdivided lines appear through opacity changes, and as you zoom out, the subdivided lines dissapear via opacity to get a smooth effect. This happens dynamically at every zoom level, so at every zoom level there are three types: minor, major, and middle x/y.
- [ ] Re-create the side panel: taller in size, max height and scrollable container, content tabs. The tabs can adjust dynamically: when debug is enabled, then a new debug tab appears. Prefer smart icons for tab names, not text. The side panel is visible only when one tab is enabled or visible: when debug is enabled, then the side panel is always visible. When the debug is disabled, and no node is selected, then the panel is not visible. When an active node or wire is selected, then the panel appears. More tabs may appear in certain contexts.
- [ ] Transform the bottom command menu bar to: a text input (condensed when not active to make room for more commands. When active, the text input takes control and covers all other actions and buttons, as well as extending in height to show results while text input is at the bottom), export and import icon with proper tooltips, move the settings to the top left container of the window, remove the workspace text too. Make this bottom command menu the command palette/center. When the shortcut to activate the control palette is pressed, the text input is activated and the whole command menu container expands for the results
- [ ] When loading any graph file or json, or on load, make sure the "main" graph layer is selected and active, not any subgraphs

## Medium Priority

- [ ] Setup playright testing for the UI frontend web app, test common things like modals, sidebars, etc...
- [ ] Add tests for worker execution plumbing (protocol + worker lifecycle) in `packages/app-web/src/workers/exec-worker-protocol.ts` and `packages/app-web/src/workers/exec-worker.ts`
- [ ] Add UI canvas coverage for camera transforms and wire geometry/layout invariants in `packages/ui-canvas/src/camera.ts`, `packages/ui-canvas/src/wire-geometry.ts`, `packages/ui-canvas/src/layout.ts`

## Low Priority

## Completed

- [x] Test failure: `packages/devtools/test/exports.test.ts` cannot resolve `@shadr/devtools`
- [x] Test run 2026-01-19: `packages/devtools/test/exports.test.ts` cannot resolve `@shadr/devtools`
- [x] Test failure: `packages/app-web/test/store.test.ts` cannot resolve `~/editor/conversion-registry` from `packages/app-web/src/editor/store.ts`
- [x] Test run 2026-01-19: `packages/app-web/test/store.test.ts` cannot resolve `~/editor/conversion-registry` from `packages/app-web/src/editor/store.ts`
- [x] Fix Vitest jsdom dependency resolution for app-web jsdom tests (`packages/app-web/test/command-palette.test.tsx`, `packages/app-web/test/keybinding-settings-panel.test.tsx`)
- [x] Fix `packages/exec-engine/test/subgraph.test.ts` depth limit case not emitting expected `NodeComputeFailed` error
- [x] Test failure: `packages/exec-engine/test/subgraph.test.ts` depth limit case missing `NodeComputeFailed` error
- [x] Test run 2026-01-19: `packages/exec-engine/test/subgraph.test.ts` depth limit case missing `NodeComputeFailed` error
- [x] Fix `packages/graph-core/test/cycle-detect.test.ts` failure where `CycleDetected` error escapes instead of returning a cycle path
- [x] Test failure: `packages/graph-core/test/cycle-detect.test.ts` throws `CycleDetected` instead of returning a cycle path
- [x] Test run 2026-01-19: `packages/graph-core/test/cycle-detect.test.ts` throws `CycleDetected` instead of returning a cycle path
- [x] Fix `packages/graph-core/test/topo-sort.test.ts` failures due to `SocketConnectionLimitExceeded` during setup
- [x] Fix `packages/ui-canvas/test/scene.test.ts` failing to resolve `effect` (add missing dependency or adjust test resolution)
- [x] Test failure: `packages/ui-canvas/test/scene.test.ts` cannot resolve `effect`
- [x] Test run 2026-01-19: `packages/ui-canvas/test/scene.test.ts` cannot resolve `effect`
- [x] Fix package entry resolution for export tests: `@shadr/devtools` and `@shadr/ui-overlay` not found in `packages/devtools/test/exports.test.ts` and `packages/ui-overlay/test/exports.test.ts`
- [x] Fix Vitest resolving `~/editor/conversion-registry` during app-web tests (`packages/app-web/src/editor/store.ts` import alias failure in `packages/app-web/test/store.test.ts`)
- [x] Ensure all tests pass, if not, list each test failure as a new todo task and complete them the next iteration
- [x] Fix `pnpm -r test` failing to resolve `vitest.config.ts` (resolves to `/Users/john.memmott/vitest.config.ts`); adjust package test scripts or root config usage. Files: `packages/app-web/package.json:10`, `packages/devtools/package.json:11`, `packages/exec-engine/package.json:11`, `packages/graph-core/package.json:11`, `packages/plugin-system/package.json:11`, `packages/shared/package.json:11`, `packages/storage-idb/package.json:11`, `packages/ui-canvas/package.json:11`, `packages/ui-overlay/package.json:11`
- [x] Ensure app-web tests run in `pnpm -r test` by adding a test script and wiring `packages/app-web/test/services.test.ts` into the Vitest config or per-package script in `packages/app-web/package.json:5`
- [x] Add component-level tests for command palette and settings panels to lock keyboard navigation behavior in `packages/app-web/src/components/CommandPalette.tsx:1` and `packages/app-web/src/components/KeybindingSettingsPanel.tsx:1`
- [x] Add unit tests for editor state management (history, selection, keybindings) in `packages/app-web/src/editor/history.ts:1`, `packages/app-web/src/editor/store.ts:1`, `packages/app-web/src/editor/keybindings.ts:1`
- [x] Add Playwright coverage for core editor flows beyond smoke (create/drag/connect/delete nodes, context menu actions) in `packages/app-web/src/components/EditorCanvas.tsx:1` and `tests/e2e/app-smoke.spec.ts:1`
- [x] Error on client: `index.jsx:17 TypeError: Cannot read properties of null (reading 'connectionLabel')     at EditorCanvas.tsx:4751:26     at Object.fn (chunk-Q2H4LCBP.js?v=f7b339c5:107:35)     at runComputation (chunk-ECXJ2U5I.js?v=f7b339c5:741:22)     at updateComputation (chunk-ECXJ2U5I.js?v=f7b339c5:723:3)     at runTop (chunk-ECXJ2U5I.js?v=f7b339c5:832:7)     at runQueue (chunk-ECXJ2U5I.js?v=f7b339c5:903:42)     at completeUpdates (chunk-ECXJ2U5I.js?v=f7b339c5:859:84)     at runUpdates (chunk-ECXJ2U5I.js?v=f7b339c5:849:5)     at writeSignal (chunk-ECXJ2U5I.js?v=f7b339c5:698:7)     at setter (chunk-ECXJ2U5I.js?v=f7b339c5:229:12) pushError @ index.jsx:17 index.jsx:17 TypeError: Cannot read properties of null (reading 'hitTest')     at HTMLCanvasElement.onPointerDown (EditorCanvas.tsx:3443:27) pushError @ index.jsx:17 EditorCanvas.tsx:3443 Uncaught TypeError: Cannot read properties of null (reading 'hitTest')     at HTMLCanvasElement.onPointerDown (EditorCanvas.tsx:3443:27)` when clicking on sockets
- [x] Fix `pnpm test` failure: Vitest v4 rejects `--include` CLI flag; update test scripts to rely on `vitest.config.ts` include or new CLI option in `packages/devtools/package.json:11`, `packages/exec-engine/package.json:11`, `packages/graph-core/package.json:11`, `packages/plugin-system/package.json:11`, `packages/shared/package.json:11`, `packages/storage-idb/package.json:11`, `packages/ui-canvas/package.json:11`, `packages/ui-overlay/package.json:11`
- [x] Add devtools smoke test to validate entrypoint wiring. `packages/devtools/src/index.ts:1`
- [x] Add lightweight tests for UI overlay exports to lock API surface. `packages/ui-overlay/src/index.ts:1`
- [x] Add app-web service tests for `graph-service` and `exec-service` effect wiring. `packages/app-web/src/services/graph-service.ts:1`
- [x] Add UI canvas unit tests for scene syncing, hit testing, and viewport culling. `packages/ui-canvas/src/scene.ts:1`
- [x] The frontend `routes` directory should only contain client-facing file-name routes, not normal ts files and other assortments of files. This will require lots of refactoring.
- [x] [plugin:vite:import-analysis] Failed to resolve import "~/editor/delete-selection" from "src/components/EditorShell.tsx". Does the file exist? Fix this error
- [x] Add unit tests for IndexedDB storage validation/error mapping (graph/settings/ui) to protect persistence. `packages/storage-idb/src/index.ts:1`
- [x] Add `typecheck` script for `app-web` so `pnpm -r typecheck` covers UI code. `packages/app-web/package.json:5`
- [x] Change command palette tag names: Command -> CMD, Control -> CTRL
- [x] Implement **keyboard shortcut customization** UI: keybinding editor, conflict detection, profiles, and export/import
- [x] Implement **full keyboard navigation** across canvas: node-to-node traversal, socket navigation, wire navigation, and action palette parity
- Notes: Keyboard focus now supports node cycling, directional traversal, socket/wire navigation, and keyboard-opened action menus.
- [x] Implement **behavior settings** expansion: autosave frequency controls, undo stack depth controls, and advanced pan/zoom curves
- Notes: Behavior settings now let users tune autosave cadence, undo history retention, and navigation feel.
- [x] Implement global settings dialog modal, add all settings in tabs inside the modal
- [x] Implement robust **DOM overlay layer management**: focus traps, pointer-event pass-through, accessibility for overlays, and consistent layering
- [x] Implement toggleable **debug panel** that can print node outputs, watch sockets, and stream evaluation logs, streams useful events
- [x] Implement improved **error handling UX**: severity-coded badges, expandable tooltips, stack/context display (debug-only mode), and error filtering
- [x] Implement **validation warnings suite**: type mismatch attempts, circular dependency attempt history, unreachable outputs, redundant conversions
- [x] Implement **one-to-many vs one-to-one enforcement** per socket definition with clear inline UI feedback
- [x] Implement **socket shapes by type** (circle/triangle/square) as an additional visual channel with accessibility-safe defaults
- [x] Implement **socket label positioning controls** (show/hide, custom positions) and improved socket metadata (units, ranges, formatting)
- [x] Implement **detached wire dragging** UX refinements: drag from either end, snap previews, auto-scroll at viewport edges while dragging
- [x] Implement **type compatibility matrix management** (code-only): define allowed connections rules beyond exact match (if desired), keep UI strict and simple
- [x] Implement **conversion node authoring tooling**: manage conversion registry, compatibility table, and test suite ensuring no accidental implicit casting
- [x] Implement **wire tap insertion**: click wire to open compatible node list and auto-insert with correct type mapping and reconnection
- [x] Implement **delete with wire reconnection options**: bridge compatible sockets, remove all, etc...
- [x] Implement **group/ungroup** with robust semantics: move/duplicate/copy-paste groups, preserve connections, and support “frame by group/category”
- [x] Implement **promoted parameters**: expose internal node params externally from groups/subgraphs, including mapping UI + socket exposure controls
- [x] Implement **nested network boxes** with correct hit-testing, z-order interactions, and parent/child move semantics
- [x] Implement **network boxes/frames** fully: create, resize, drag, custom title/color/description, collapse/expand showing only exposed I/O
- [x] Dragging a connected wire from a socket, letting go of it over open canvas area will delete the wire, unless it's connected to a new socket (Like Blender)
- [x] Implement **execution flow visualization suite**: animated wires, execution order badges, per-node timing bars, and timeline view (must be toggleable for perf)
- [x] Implement **async/background execution lane** (even if nodes remain sync): offload heavy graphs to a worker, keep UI responsive, and support cancelation + progress
- [x] Implement **per-instance overrides** for params with clear diff UI and reset-to-default actions
- [x] Implement **node instances** (reference semantics): multiple instances share the same source definition, updating source updates all instances deterministically (especially useful for collapsed subgraphs used in multiple places, edit the subgraph in one to edit all or edit per instance)
- [x] Implement option to create subgraph, either from command menu or in context menu when nodes are selected
- [x] Implement **nested subgraphs** (up to 10 levels) with guardrails: recursion prevention, max depth enforcement, performance caps
- [x] Fix this client side error: store.ts:246 TypeError: Cannot read properties of undefined (reading 'parent') at \_Container.addChild (chunk-5P6HJJH3.js?v=f7b339c5:6941:15) at CanvasScene.updateNodeOrder (scene.ts:409:16) at CanvasScene.syncGraph (scene.ts:298:10) at syncScene (EditorCanvas.tsx:1009:12) at Object.fn (EditorCanvas.tsx:2925:5)
- [x] Implement **dive in/out navigation** for subgraphs with breadcrumbs, back/forward history, and focus restore
- [x] Implement **subgraph I/O authoring**: user-defined input/output sockets, renaming, reordering, type constraints, defaults, required flags
- [x] Implement full **subgraph system**: collapse selection into subgraph, generate internal graph document, and create a parent “Subgraph Node” wrapper with defined I/O. Subgraphs don't show outer graphs, helps with perf.
- [x] Dragging wire from input socket grabs wire, not deletes it, allowing user to re-position or move wire without creating a new one
- [x] Add breadcrumb plumbing placeholders for future subgraphs (no real subgraphs yet)
- [x] Add z-ordering controls (bring to front/back) if you end up needing it for overlapping nodes (automatic show selected node first) - ensure selected nodes render above overlaps for clarity
- [x] Add network boxes/frames: basic rectangle + title; grouping behavior can wait
- [x] Add wire animated “data flow” visualization when zoomed in only (very easy to make expensive; only if perf budget allows)
- [x] Add wire hover labels (type/value) with debounce; keep off by default for perf
- [x] Nothing in view shows on page/app load when it shouldn't, even if nodes are in view
- [x] The context menu hides when the mouse moves. The context menu whould remain open until the overlay is clicked or when the context menu is clicked, not on mouse move
- [x] The selection square to select nodes will highlight the nodes as soon as the selection box touches the nodes, not after the size of selection box is defined and the mouse let go.
- [x] Move the number of selected Nodes text component (as well as the dirty component) to be in the bottom left. The bottom left corner will be only for status information. This content will be dynamic, so it can have "1 Selected" and "Dirty" and "Saved" in the same container
- [x] Simplify the content in the side panel and control menu bar. Remove repeating or redundant information. It's obvious when a node has inputs or outputs in the canvas, not needed in the side panel too. Consider this for other areas and aspects of these components. Keep them simple.
- [x] Show the bottom control menu at all times, just the contents change based on context. Keep the selection menu, but when no items are selected, the control bar has other options for importing, exporting, settings, etc...
- [x] Add import/export graph from file (JSON) with schema version + migration hook
- [x] Add essential minimal status/notifications (errors, autosave, compile/result), touch/mouse/keyboard parity, and light/dark themes tied to system settings; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only.
- [x] Implement IndexedDB persistence for all editor state (graph, settings, UI layout, recent/last doc), including autosave feedback; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only. Use Effect when you see fit.
- [x] Implement undo/redo UI affordance + keyboard shortcuts and hook to history; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only. Use Effect when you see fit.
- [x] Uncaught (in promise) SyntaxError: The requested module '/\_build/@fs/Users/john.memmott/Developer/shadr/packages/ui-canvas/src/index.ts' does not provide an export named 'getSocketPosition' (at EditorCanvas.tsx:23:3) needs to be fixed
- [x] Add a Raycast-style command palette with fuzzy search for commands/nodes/controls; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only. Use Effect when you see fit.
- [x] Add a minimal context menu over the canvas (right-click/long-press), context-aware; minimal text; Solid.js/Kobalte/Lucide/Tailwind only.
- [x] Render the canvas with the pixijs scene (grid + nodes) in the SolidJS UI in a component (it doesn't render now)
- [x] Add a context-driven side panel that is hidden by default and appears only when a node or other canvas element is selected; max-height + scroll; minimal text; state colors; Solid.js/Kobalte/Lucide/Tailwind only. Use Effect when you see fit.
- [x] Implement the bottom Figma-like control menu that changes per selected node and resets on deselect, with max-height + internal scroll (if needed); Solid.js/Kobalte/Lucide/Tailwind only, minimal text, state colors.
- [x] Rebuild the base layout: full-screen canvas plus minimal overlay containers, using Solid.js signals/stores, Kobalte primitives, Lucide icons, and Tailwind; text only when needed, state colors only, no extra UI, keep minimal always.
- [x] Read current UI overlay/canvas code to understand existing structure and then delete/reset the UI layer to restart cleanly, while keeping Solid.js reactivity, Kobalte UI components, Lucide icons, and TailwindCSS-only styling; keep text minimal, show only when essential, use color to indicate state (valid/invalid/warning/info/primary), keep UI minimal and dynamic. **YOU MUST DELETE THE CURRENT UI AND RESTART WITH THESE THINGS IN MIND**

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
