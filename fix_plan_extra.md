# Fix Plan (Extra)

Last updated: 2026-01-17
Features reference: `FEATURES.md`

## Critical

- [ ] Implement full **subgraph system**: collapse selection into subgraph, generate internal graph document, and create a parent “Subgraph Node” wrapper with defined I/O
- [ ] Implement **subgraph I/O authoring**: user-defined input/output sockets, renaming, reordering, type constraints, defaults, required flags
- [ ] Implement **dive in/out navigation** for subgraphs with breadcrumbs, back/forward history, and focus restore
- [ ] Implement **nested subgraphs** (up to 10 levels) with guardrails: recursion prevention, max depth enforcement, performance caps
- [ ] Implement **node instances** (reference semantics): multiple instances share the same source definition, updating source updates all instances deterministically
- [ ] Implement **per-instance overrides** for params with clear diff UI and reset-to-default actions
- [ ] Implement **asset/library system** for subgraphs (“digital assets”): save/load, metadata, previews, dependency tracking, versioning, and upgrade workflows
- [ ] Implement **HDA-style packaging**: bundle node packs + subgraphs + resources into a distributable internal artifact; include compatibility checks and migration hooks
- [ ] Implement **async/background execution lane** (even if nodes remain sync): offload heavy graphs to a worker, keep UI responsive, and support cancelation + progress
- [ ] Implement **execution flow visualization suite**: animated wires, execution order badges, per-node timing bars, and timeline view (must be toggleable for perf)
- [ ] Implement comprehensive **state management modes**: mute, solo, lock, freeze (cache pinning) with correct dirty/invalidation semantics and UX clarity
- [ ] Implement **graph-level compile pipeline**: explicit compile triggers, compile targets, incremental compile caching, and compile output artifact registry (image/code/etc)

## High Priority

- [ ] Implement **network boxes/frames** fully: create, resize, drag, custom title/color/description, collapse/expand showing only exposed I/O
- [ ] Implement **nested network boxes** with correct hit-testing, z-order interactions, and parent/child move semantics
- [ ] Implement **promoted parameters**: expose internal node params externally from groups/subgraphs, including mapping UI + socket exposure controls
- [ ] Implement **group/ungroup** with robust semantics: move/duplicate/copy-paste groups, preserve connections, and support “frame by group/category”
- [ ] Implement **delete with wire reconnection options**: bridge compatible sockets, remove all, or prompt-based reconnection mapping
- [ ] Implement **copy/paste cross-app compatibility**: canonical JSON format, stable schema docs, and import validation with migration support
- [ ] Implement **export selection as template** and **template library**: save templates, browse/search, apply at cursor, resolve missing node types
- [ ] Implement **import from file/URL** with safety constraints, schema versioning, node pack dependency resolution, and user-facing validation reports
- [ ] Implement **favorites/recent nodes** and **custom node templates** in node library with sync to IndexedDB
- [ ] Implement **situational-aware dynamic context menu**: options depend on hover target (wire/node/empty), selection set, and type constraints
- [ ] Implement **wire tap insertion**: click wire to open compatible node list and auto-insert with correct type mapping and reconnection
- [ ] Implement **conversion node authoring tooling**: manage conversion registry, compatibility table, and test suite ensuring no accidental implicit casting
- [ ] Implement **type compatibility matrix management** (code-only): define allowed connections rules beyond exact match (if desired), keep UI strict
- [ ] Implement **data cloning vs reference passing policy** per type: define copy-on-write rules, structural sharing, and memory/perf tradeoffs
- [ ] Implement **null/undefined propagation policy** as a first-class configurable rule set with per-node overrides (if needed)

## Medium Priority

- [ ] Implement **wire label system**: show type/value/custom text on hover with layout collision avoidance and perf-friendly caching
- [ ] Implement advanced **wire states**: highlighted/dimmed paths, error animation, “data flow” animation with throttle and user toggle
- [ ] Implement **detached wire dragging** UX refinements: drag from either end, snap previews, auto-scroll at viewport edges while dragging
- [ ] Implement **socket label positioning controls** (show/hide, custom positions) and improved socket metadata (units, ranges, formatting)
- [ ] Implement **socket shapes by type** (circle/triangle/square) as an additional visual channel with accessibility-safe defaults
- [ ] Implement **one-to-many vs one-to-one enforcement** per socket definition with clear inline UI feedback
- [ ] Implement **unused node detection** and **missing connection warnings** with a dedicated diagnostics panel and quick-fix actions
- [ ] Implement **validation warnings suite**: type mismatch attempts, circular dependency attempt history, unreachable outputs, redundant conversions
- [ ] Implement improved **error handling UX**: severity-coded badges, expandable tooltips, stack/context display (dev-only), and error filtering
- [ ] Implement **debug console node** (or debug panel) that can print node outputs, watch sockets, and stream evaluation logs
- [ ] Implement **execution profiling tools**: per-node stats over time, cache hit heatmap, slow path detection, and exportable performance report
- [ ] Implement **frame by group/category** and enhanced framing controls (breadcrumbs-aware) for deep graphs
- [ ] Implement **breadcrumb navigation for subgroups/subgraphs** with keyboard support and “jump to parent” quick actions
- [ ] Implement **z-order controls**: bring to front/send to back for nodes and boxes, including selection-based ordering operations
- [ ] Implement robust **DOM overlay layer management**: focus traps, pointer-event pass-through, accessibility for overlays, and consistent layering

## Low Priority

- [ ] Implement full **visual customization/themes**: dark/light schemes, palette editor, user presets, and theme import/export
- [ ] Implement **font controls**: font size/family (Google Fonts), caching strategy, and fallback handling
- [ ] Implement **behavior settings** expansion: autosave frequency controls, undo stack depth controls, and advanced pan/zoom curves
- [ ] Implement **full keyboard navigation** across canvas: node-to-node traversal, socket navigation, wire navigation, and action palette parity
- [ ] Implement **keyboard shortcut customization** UI: keybinding editor, conflict detection, profiles, and export/import
- [ ] Implement **accessibility pass**: ARIA labels for overlays, reduced motion mode, high-contrast mode, and non-color-dependent type cues
- [ ] Implement **icon customization** within Lucide constraints: icon picker for node categories/types and per-theme overrides
- [ ] Implement **infinite canvas soft boundaries system**: smarter “no elements in view” detection, minimap option, and guided jump actions

## Completed

- [x] Completed tasks (none should be here now)
