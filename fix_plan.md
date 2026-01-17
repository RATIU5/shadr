# Fix Plan

Last updated: 2026-01-16
Targets reference: `targets.md` (one task at a time)

> Run `.ralph/ralph-plan.sh` to analyze the codebase and update this list.

> Move all completed tasks to the "## Completed" section after they are marked done to keep things clean.

> Keep code simple, don't overengineer. Also keep the UI simple for the user, don't complicate things. Keep the UI concise.

## Critical

- [ ] Double-clicking the container of a group of nodes will toggle the collapse/un-collapsed mode, not when double clicking on the nodes themselves
- [ ] After un-collapsing a collapsed group, some of the collapsed group UI for the group node remains after the group was un-collapsed. Fix this so the UI doesn't overlap, or be visible at all.
- [ ] Allow nesting of groups of nodes up to 10 levels max
- [ ] For modals, remove the opaque backdrop color, keep it fully transparent
- [ ] For connected connectors/wires, clicking and dragging on a connector point should disconnect the connector/wire, but keep the connection line at the mouse, so when the mouse moves over the same or any other connector point and is let go (dropped), it will connect to that connection point.
- [ ] Simplify the side panel for selected nodes/connectors. There is duplicated information, and the information displayed (text) is not concise.

## High Priority

## Medium Priority

## Low Priority

## Completed

<!-- Move completed items here with date -->

- [x] From the active element (node or connector) side panel, extract the details of node (id, family, from, to, type) and condense the dynamic information to be in a bottom floating text in the dom in a status bar. The status bar will display this info on hover/active elements. Make sure this component is in a separate file. The active element side panel should no longer have this information at the end. - 2026-01-16
- [x] Hide the inspector panel, it's not important or needed now. - 2026-01-16
- [x] Refactor the node definition system so templates become rich, per-node schemas (not just family stubs) that describe ports, parameters, UI widgets, defaults, validation, and behavior: introduce a NodeDefinition registry keyed by node type with typed parameter
      specs (e.g., float w/ min/max/step, enum for ops, color, vector, image/texture, boolean, string), provide per-node UI layout metadata for an inline inspector panel and compact node-body controls, store per-instance state in a structured NodeState (parameters +
      cached UI state + versioning), and replace the current node-families.ts dropdown/const-editor special cases with a unified property editor (in node body + side panel) that renders controls from schema, supports dynamic ports/labels, and cleanly serializes;
      update shader compilation to use per-node codegen functions (or templates) attached to each definition, allow custom preview labels and error messaging, and add a plugin-friendly API to register new nodes at runtime; ensure UX mirrors Blender’s clarity—clear
      defaults, inline edits without modal friction, searchable categories/tags, and consistent parameter affordances—while keeping performant rendering in packages/editor/src/nodes.ts and stable serialization/migration paths. - 2026-01-16

- [x] Add a new “inputs” node family (or multiple templates under an existing family) that mirrors the current node patterns in packages/editor/src/node-families.ts, packages/editor/src/types.ts, and packages/editor/src/nodes.ts: define templates for several HTML
      input types (e.g., number, range, checkbox, text, color, and select), give each a single output port with the correct PortType, and store the user-entered value in NodeData so it serializes and renders similarly to constants; implement an input editor flow
      modeled after the const editor (packages/editor/src/const-editor.ts + app/src/components/editor/const-editor-overlay.tsx) that opens on node interaction, renders the appropriate HTML form control for the node’s input type, commits updates back to NodeView.data,
      and updates the node’s label/value display; finally, update shader compilation in packages/editor/src/shader.ts to emit the stored values (or an agreed representation) for these input nodes and make sure dropdowns/selection panel behavior stays consistent with
      existing node UI conventions. - 2026-01-16
- [x] Add shader compilation tests covering the Time input node so GLSL emits `u_time` uniforms when used (Targets: GLSL reliability, node library coverage). - 2026-01-16

- [x] Add a performance warning when graphs exceed 100 nodes, surfacing node counts in the shader preview status to track the 60fps target. (Targets: performance, UX feedback) - 2026-01-16

- [x] Add a "Copy Graph JSON" action in the File menu to copy the current graph to the clipboard without downloading a file (Targets: save/load graph as JSON, UX). - 2026-01-16

- [x] Add "Paste Graph JSON" to the File menu so users can load saved graphs from the clipboard without the file picker (Targets: save/load graph as JSON, UX). - 2026-01-16

- [x] Drop incompatible connections when node port types change (family/op updates) and warn users about removed links. (Targets: type validation, reliability, UX feedback) - 2026-01-16

- [x] Add shader compilation test coverage for the Vertex Output unconnected-input warning to reinforce GLSL reliability feedback. (Targets: GLSL reliability, UX feedback) - 2026-01-16
- [x] Add shader compilation tests for logic nodes (and/or/not/select variants) to keep GLSL output coverage aligned with the node library (Targets: GLSL reliability, node library coverage). - 2026-01-16
- [x] Warn when no Fragment Output node exists during GLSL compilation so users understand the preview output is undefined (Targets: GLSL reliability, UX feedback). - 2026-01-16

- [x] Add GLSL compilation tests for vector operation nodes (dot/cross/normalize/length/reflect/refract) to keep node library coverage aligned with GLSL reliability target. - 2026-01-16

- [x] Add shader compilation tests for texture/UV and conversion nodes to keep GLSL output coverage aligned with the node library (Targets: GLSL reliability, node library coverage). - 2026-01-16

- [x] Add drag-and-drop JSON import on the editor canvas so users can load saved graphs without using the menu (Targets: save/load graph as JSON, UX). - 2026-01-16

- [x] Ensure undo/redo captures node property edits (rename, dropdown changes, constant values) so changes can be reverted (Targets: undo/redo, UX reliability). - 2026-01-16

- [x] Add a GLSL export modal that lets users download vertex/fragment/both shaders as files (Targets: export compiled GLSL code, UX). - 2026-01-16

- [x] Add a "Copy GLSL" action that copies the compiled vertex/fragment shader text to the clipboard for quick sharing. (Targets: export compiled GLSL code, UX) - 2026-01-16

- [x] Surface graph import validation errors in the UI so invalid JSON or schema issues are clearly communicated (Targets: save/load reliability, UX feedback). - 2026-01-16

- [x] Surface a performance warning when shader compilation exceeds 100ms so users can spot slow graphs (Targets: performance, UX feedback). - 2026-01-16

- [x] Add a "Frame Selection" view action to center/zoom the camera on selected nodes or groups for faster navigation. (Targets: navigation UX, selection workflow) - 2026-01-16

- [x] Prevent exporting stale/invalid GLSL by disabling export when compilation errors exist and showing a clear error state in the preview panel. (Targets: reliability, UX feedback) - 2026-01-16

- [x] Support touchpad support: pinch to zoom in/out, two fingers to drag the viewport around. Touch and drag to select/move selected items around. Mouse and keyboard controls should remain the same. - 2026-01-16

- [x] The border highlight/selection over a node block is incorrect, it's positioned inside and at a smaller size. The border/highlight should only show if the node or connection is selected, otherwise it should be invisible. - 2026-01-16

- [x] Node connections should never connect to themselves. Ensure that action is blocked (don't show a dialog or toast, just prevent that behavior internally if it's not already happening) - 2026-01-16

- [x] Some of the text on the nodes clashes with other text on the node blocks. How about we ensure all the inputs are at the bottom left side of the node (above the footer part of the node block), after space for regular text, and then keep the outputs are at the top right side of the node (below the header part of the node block). All text items on nodes need appropriate space, and shouldn't overlap over other text. Add max width constraints. - 2026-01-16
- [x] Each input or output connection should have the ability to be renamed for each node, but there is an optional reset to revert back to the original/automatic name. This should appear in the node block side panel in it's on IO tab. - 2026-01-16
- [x] When selecting a node, a side panel should appear. It currently does not appear. Inside the side panel, there should be sections with inputs in each section. The inputs control the node properties, such as functions or processes used, transform functions, or other capabilities. These properties should be in an appropriately named tab. - 2026-01-16
- [x] Create a new Solidjs component on the frontend. It will be a side panel, that's rendered dynamically. The dynamic properties go as follows: separated by tabs, each tab has an array of types, like section headings and form input types. Paragraphs can also be an option. The ui to build this dynamic form looks clean with TailwindCSS following the current theme used in the rest of the UI. The user can navigate between tabs in the side panel, and each tab re-renders the contents for each tab in the tab content portion. The input/data state for items in each tab need to persist when navigating between tabs. - 2026-01-16

- [x] Warn when no Vertex Output node exists during GLSL compile so users understand the default vertex position is used (Targets: GLSL reliability, UX feedback). - 2026-01-16

- [x] Add unit tests for port type compatibility/connection validation to enforce type safety rules (including color <-> vec4) and prevent invalid graph links. (Targets: type validation, reliability) - 2026-01-16

- [x] Add shader compilation tests that cover cyclic graph detection so GLSL reliability stays enforced as node families evolve. - 2026-01-16

- [x] Track shader compile duration and surface it in the debug overlay + preview panel to monitor the <100ms performance target. - 2026-01-16
- [x] consolidate the node system into a small set of dynamic “node families” so the palette exposes only core families (Math, Vector, Color, Conversion,
      Logic, Texture/UV, Output, Constants) and node behavior is driven by registries instead of static templates; use packages/editor/src/templates.ts and packages/
      editor/src/math-ops.ts as starting points to move per-operation/per-variant data into registries describing inputs, types, outputs, labels, and UI metadata, then
      update packages/editor/src/nodes.ts to create/render dynamic ports/labels based on NodeData (op/type/mode), extend packages/editor/src/dropdown-editor.ts to
      configure these family settings and trigger port reflow, refactor packages/editor/src/shader.ts to emit GLSL from registry + node data rather than enumerating each
      template id, adjust defaults and compatibility in packages/editor/src/editor-state.ts, and update packages/editor/src/serialization.ts to persist family id + data
      while migrating legacy template ids; add or update tests in packages/editor/src/**tests** for migration, port regeneration on op/type changes, and shader compilation
      for key families, so the refactor reduces node count, enables in-node operation changes, and preserves existing graphs. - 2026-01-16
- [x] Left mouse drag still drags the viewport/grid layer around. Dragging the viewport should only happen when space is held with left mouse, or when middle mouse is down. - 2026-01-16
- [x] Selecting a node, connection, etc... will open a new side panel, generated new for each new node type. After selecting the active node (note this does not work when multiple things are selected) will open the settings box for that node or connection or thing. It will then allow the user to control the settings and properties of that node. For example, the user could rename the node in a section in that side panel, they could change the math function used (sum, cos, sub, divide, etc...) if it's a math transformation node block, or if it's a color input block, then the user may select the color that the node block will use as the input. The same goes for all inputs and their types: a ui will appear and allow the user to select the specific input value. This means that nodes will first need to be combined into one node block, with different options available in a select dropdown in the side panel. Like a user with the Vec2 Math node can select the Add value in the operation field. Then the math node will add two vec2 values together. - 2026-01-16

- [x] Error: Failed to load url ./editor/selection-panel (resolved id: ./editor/selection-panel) in ./app/src/components/editor.client.tsx. Does the file exist? - 2026-01-16

- [x] Re-design the visual layer of node blocks in the canvas. The node blocks should have a whole rectangular container, separated by a header (different color depending on the internal type of node block), with the name of the node on in the header only. Then the body of the node block: contains all inputs and outputs, different colors for different types. Keep the circles for the connection points. No shadows anywhere, use a flat clean design. Then there should be a footer. Optional text will be in the footer. No different coloring from the body and the footer of the node block. The text in the footer will be smaller and lighter colored in text. By default, certain nodes will show the computed value (if number) in there. It could show the color computed there too if the color was the output. - 2026-01-16

- [x] The grid should always show all sublevel lines. The only difference is that they will automatically fade in an out with transparency depending how close or how far the zoom level will be. - 2026-01-16

- [x] Break apart the UI in the frontend into modular components (overlays, modals, action bar, preview) for maintainability. - 2026-01-16

- [x] Remove the side menu. The settings button should be apart of the menu bar at the bottom, then opens the settings modal. I don't need to see the port types, texture, or export button in the side menu. Only put the export in the menu bar in the bottom. - 2026-01-16

- [x] Left mouse selecting should NOT drag the canvas around, but should grow/shrink a selection box. Anything in this box should be selected elements. - 2026-01-16

- [x] Every selectable element (nodes, connectors, connector points, etc...) need to have two layers: interactive layer and the visual layer. The interactive layer is the same as the visual layer, except it's invisible and is slightly larger than the visual layer. The ineractive layer is larger so users can select parts from a larger area, especially when the editor is zoomed out. The visual (rendering colors and shapes) part should not be the same size as the interactive layer, it should remain the same size now. - 2026-01-16

- [x] Remove non-customizable settings, keep only essential canvas/grid/connection controls, and drop node/layout tuning from settings. - 2026-01-16

- [x] Shorten the list of bottom floating DOM nav/menu items, use submenu items (Edit/View/File), remove shortcut hints, and center the bar for a cleaner bottom control strip. - 2026-01-16

- [x] Group math nodes into a single per-type math node with dropdown-selected operations to shorten the node list while keeping full operation coverage. - 2026-01-16

- [x] Add graph schema versioning + migration on load to keep JSON saves forward-compatible (targets: save/load reliability). - 2026-01-16

- [x] Avoid unnecessary shader recompiles when only node positions or titles change by hashing a minimal shader-affecting snapshot (performance target). - 2026-01-16

- [x] Add shader compilation smoke tests to guard GLSL generation for fragment output so GLSL export stays valid as templates evolve (`packages/editor/src/__tests__/shader.test.ts`) - 2026-01-16

- [x] Modals, panels, context menus all need to have a scrollable area once the content exceeds the height. Only do this in TailwindCSS. Make things scrollable that need to me. - 2026-01-16

- [x] Add UI warning when users drop a connection on incompatible ports (type mismatch or same direction) to reinforce type validation UX. - 2026-01-16

- [x] Improve text rendering quality in Canvas, it appears blurry on high-resolution displays when zoomed in - 2026-01-16

- [x] UI should appear seamless, clean, cohesive, as if it all were apart of a theme. - 2026-01-16

- [x] Smooth curved lines, so they don't appear pixelated for all canvas rendered elements - 2026-01-16

- [x] Round corners slightly on node blocks - 2026-01-16

- [x] Ensure rendering is optimized for large nodes - 2026-01-16 (reduce per-port redraws to only update hovered/dragged ports)

- [x] Refactor user events (shortcuts) to a large array ot object with descriptions and shortcut names to be toggled from a button or something or shortcut to show all shortcuts for this app. Don't leave any out. Some events are dependent on different modes, keep this in mind when displaying them. - 2026-01-16

- [x] Ability to select wires/pipes/connections and delete them via shortcut - 2026-01-16 (supports direct wire cleanup without deleting nodes)

- [x] Ability to rename node blocks - 2026-01-16

- [x] Zooming in via browser crashes the editor solid.js app, this needs to be fixed - 2026-01-16

- [x] Node Blocks should grow in size to fit input/outputs appropriately, among other data - 2026-01-16

- [x] Setup a debug view for canvas and console: highlight and show additional information on nodes, positions, scale, FPS, errors, warnings, info, etc... as an overlay on Canvas for developers. - 2026-01-16

- [x] The ability to group nodes together (like Blender) and then to collapse/show the node group, where custom input values may be created for the group of nodes, and optional output may be apart of the group (may require architecture change) - 2026-01-16

- [x] Click/select area for node wires is larger than the defined colored circle for improved UX, where the select/drag area may go outside the node box - 2026-01-16

- [x] Update the UI node picker to contain all nodes that the user can search and pick from, sorted by groups or categories, list all if no search filter is active - 2026-01-16

- [x] Read ./advanced-nodes.md and implement node block types/functions across math, vector, color, texture, and logic operations - 2026-01-16

- [x] Add other input types, like text, number input, vec input, in a clean SolidJS ui like the dropdown, considering scale, position, etc... - 2026-01-16

- [x] Node blocks have the ability to have dropdown menus inside (capture mouse click on canvas, a dynamic dropdown menu is generated at the spot (via DOM) if a dropdown activation area was selected). Also keep in mind how scaling (zoom) will affect the DOM dropdown so it looks consistent at any zoom value. Or another approach, clicking on a node opens a form of controls to control the node process (how it runs, transforms, etc... it runs) - 2026-01-16

- [x] Add transformation nodes (vec3 -> vec4, vec4 -> vec3, float -> int) so graphs can resize vectors and cast to ints during shader assembly - 2026-01-16

- [x] Add global control nav (like Figma) for different tools, selecting nodes to add, etc... Placement is at the bottom, fixed, with a clean UI - 2026-01-16

- [x] Simplify context menu to controls, not node blocks to add to the canvas. Keep delete, copy selected, cut selected, reset zoom, etc... and other useful tools - 2026-01-16

- [x] You appear to have multiple instances of Solid. This can lead to unexpected behavior. Fix this. - 2026-01-16

- [x] Refactor UI elements so alerts/toasts render in the DOM (Solid overlay) while nodes/grid remain on canvas, replacing blocking browser alerts. - 2026-01-16

- [x] Implement TailwindCSS for all DOM UI, and replace the existing CSS with TailwindCSS classes. Use TailwindCSS from here on out. - 2026-01-16

- [x] Attempt to create tests for complex processes, after making things more modular. Tests should be for anything that interacts with unknown or user controlled input. Create a package test script. Use Vitest. Don't test UI, just functions, classes, and processes. All packages (not apps) need tests. - 2026-01-16

- [x] Refactor editor core into modular helpers (state, nodes, connections, history), keep files under 1k lines, and defer Effect-ts adoption after review (removed unused dependency) - 2026-01-16

- [x] Add tests for pan/zoom transform logic to prevent regressions once camera controls land (new test file under `packages/editor/`) - 2026-01-16
- [x] Ensure `initCanvas` uses Pixi.js and is exported from `@shadr/lib-editor` (`packages/editor/src/index.ts:1`, `app/src/components/editor.client.tsx:1`) - 2026-01-16
- [x] Remove WebGPU/TypeGPU dependencies and update editor initialization to Pixi.js (`packages/editor/package.json`, `packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Update documentation to reflect Pixi.js renderer (`AGENT.md`, `specs/architecture.md`) - 2026-01-16
- [x] Add Pixi.js canvas lifecycle cleanup on unmount (`app/src/components/editor.client.tsx:1`) - 2026-01-16
- [x] Implement infinite grid rendering and camera container setup in Pixi app init (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Update root typecheck to target app/editor configs and add local Pixi type shim for workspace checks (`package.json`, `app/tsconfig.json`, `packages/editor/src/types/pixi.d.ts`) - 2026-01-16
- [x] Remove stale `@webgpu/types` reference from editor tsconfig to restore `pnpm typecheck` in Pixi-only setup (`packages/editor/tsconfig.json`) - 2026-01-16
- [x] Add shader compilation tests covering Vertex Output wiring so vertex GLSL generation stays valid as templates evolve (`packages/editor/src/__tests__/shader.test.ts`) - 2026-01-16
- [x] Surface shader compile errors/warnings as a list in the preview panel for clearer feedback (app preview UI) - 2026-01-16
- [x] Add serialization parse/validation tests to ensure saved graphs load safely (targets save/load JSON reliability) - 2026-01-16
- [x] Debounce shader compilation during rapid edits so preview/export stays responsive under heavy graphs (performance target) - 2026-01-16
- [x] Show invalid connection feedback (ghost line/port highlight) when dragging between incompatible port types to reinforce type validation UX (`packages/editor/src/index.ts`) - 2026-01-16
- [x] Add node search/fuzzy find palette for quick node creation (keyboard driven) (`packages/editor/src/index.ts`, `app/src/app.css`) - 2026-01-16
- [x] PixiJS Deprecation Warning: use new Text({ text: "hi!", style }) instead Deprecated since v8.0.0 - 2026-01-16
- [x] Graphics#beginFill is no longer needed. Use Graphics#fill to fill the shape with the desired style. Deprecated since v8.0.0 - 2026-01-16
- [x] Graphics#drawRoundedRect has been renamed to Graphics#roundRect Deprecated since v8.0.0 - 2026-01-16
- [x] Graphics#endFill is no longer needed. Use Graphics#fill to fill the shape with the desired style. Deprecated since v8.0.0 - 2026-01-16
- [x] Graphics#lineStyle is no longer needed. Use Graphics#setStrokeStyle to set the stroke style. Deprecated since v8.0.0 - 2026-01-16
- [x] Graphics#drawRect has been renamed to Graphics#rect Deprecated since v8.0.0 - 2026-01-16
- [x] Graphics#drawCircle has been renamed to Graphics#circle Deprecated since v8.0.0 - 2026-01-16
- [x] Add connection hover highlight to improve graph visual feedback (`packages/editor/src/index.ts`) - 2026-01-16
- [x] Warn when output nodes have unconnected inputs so preview surfaces missing connections (`packages/editor/src/shader.ts`) - 2026-01-16
- [x] Add a port type color legend in the preview panel using shared port type colors so the type color coding is discoverable (`app/src/components/editor.client.tsx`, `packages/editor/src/index.ts`) - 2026-01-16
- [x] Surface a warning when loading a graph drops invalid connections so users know why links disappeared (`packages/editor/src/index.ts`) - 2026-01-16
- [x] Clean up `packages/editor/package.json` exports order so `import`/`types` conditions are reachable (build warning during `tsup`) - 2026-01-16
- [x] Add Clamp (min/max) math nodes for float/vec2/vec3/vec4 with GLSL support to expand the math node library (`packages/editor/src/templates.ts`, `packages/editor/src/shader.ts`) - 2026-01-16
- [x] Add an Export GLSL button in the preview panel so compiled shaders can be downloaded without relying on hotkeys (app/editor integration) - 2026-01-16
- [x] Add Sine/Cosine math nodes (float/vec2/vec3/vec4) with GLSL support to expand the node library (`packages/editor/src/templates.ts`, `packages/editor/src/shader.ts`) - 2026-01-16
- [x] Add preview texture upload/selection so Input Texture nodes sample a real image in the shader preview (`app/src/components/editor.client.tsx`) - 2026-01-16
- [x] Add Lerp (mix) nodes for float/vec2/vec3/vec4 with GLSL support to expand the math node library (`packages/editor/src/templates.ts`, `packages/editor/src/shader.ts`) - 2026-01-16
- [x] Add float/vec2/vec3/vec4 subtract + divide nodes with GLSL support to round out the math node library (`packages/editor/src/templates.ts`, `packages/editor/src/shader.ts`) - 2026-01-16
- [x] Add Texture Input node (outputs texture uniform) with GLSL support so texture sampling can be wired (`packages/editor/src/templates.ts`, `packages/editor/src/shader.ts`) - 2026-01-16
- [x] Add localStorage autosave/load for the current graph so users can resume work without exporting/importing files. (Targets: save/load graph as JSON) - 2026-01-16
- [x] Introduce a flexible interface: ability to resize sections/panels, local storage to save preferences, settings menu or tab, take inspiration from other local-first CSR apps like Figma with a modern clean and minimal feel - 2026-01-16
- [x] Visual settings panel for canvas/grid/node/connection styling (roundness, colors, grid spacing, curved vs straight, flow animation, debug toggle) with localStorage persistence and live renderer updates - 2026-01-16
- [x] Enhanced connection visuals with animated flow dots (toggleable in settings) - 2026-01-16
- [x] Add Constant Vec2/Vec3/Vec4 nodes with editable values, serialization, and GLSL support to expand the node library for vector math (`packages/editor/src/templates.ts`, `packages/editor/src/const-editor.ts`, `packages/editor/src/serialization.ts`, `packages/editor/src/shader.ts`) - 2026-01-16
- [x] Differentiate GLSL compile errors vs warnings and surface errors in preview/export UI so failures aren't shown as warnings (app/editor integration) - 2026-01-16
- [x] Warn when any connected node has unconnected input ports so shader preview/export highlights missing inputs (`packages/editor/src/shader.ts`) - 2026-01-16
- [x] Allow connecting `color` ports to `vec4` ports (treat color as vec4-compatible) so Constant Color can feed Fragment Output (`packages/editor/src/index.ts`) - 2026-01-16
- [x] Detect cyclic graph dependencies during GLSL compilation and surface a warning/error to prevent invalid shaders (`packages/editor/src/shader.ts`) - 2026-01-16 (already implemented)
- [x] Add vec2/vec3/vec4 add + multiply nodes with GLSL support to expand the node library (`packages/editor/src/templates.ts`, `packages/editor/src/shader.ts`) - 2026-01-16
- [x] Add Vertex Output node and GLSL compiler support so vertex stage can be driven from the graph (`packages/editor/src/templates.ts`, `packages/editor/src/shader.ts`) - 2026-01-16
- [x] Add multi-select node selection with batch move/delete support (shift/click behavior) to match graph editor UX (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add pan (pointer drag) and zoom (wheel) interactions for the grid/camera (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add node creation/deletion via hotkeys with Pixi-rendered selection (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add node dragging to reposition nodes on the canvas while keeping pan/zoom intact (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add typed input/output port rendering on nodes with type color mapping (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add port connection drag (click-drag between ports) with rendered connection lines and type validation (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Allow disconnecting input port connections by dragging to empty space to satisfy connect/disconnect UX (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add save/load graph as JSON with file download/upload and keyboard shortcuts (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add right-click context menu to spawn/delete nodes on the canvas (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add a node library of common templates (math ops, texture sample, inputs/outputs, constants) and expose them in the context menu (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Export compiled GLSL shader code from the graph via hotkey, covering core node templates (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add undo/redo for node, connection, and camera operations with standard hotkeys (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Add a real-time shader preview panel that renders the compiled GLSL on a test quad (`app/src/components/editor.client.tsx:1`, `packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Refactor to split large files into smaller files/modules for maintainability (e.g., separate node logic, rendering, input handling) - 2026-01-16
- [x] Add smooth connection curves and hover feedback for nodes/ports to improve graph readability and UX (`packages/editor/src/`) - 2026-01-16
- [x] Add editable values for Constant Float/Color nodes, persist them in graph serialization, and emit them in GLSL compilation (`packages/editor/src/index.ts`, `packages/editor/src/types.ts`, `packages/editor/src/serialization.ts`, `packages/editor/src/shader.ts`) - 2026-01-16 (already implemented: const editor writes node data, serialization persists it, GLSL uses node data)
- [x] Improve keyboard controls, allow "Space + Left Mouse" to drag around canvas, OR "Middle Mouse" to drag around canvas too. Research and use best practices and commonly used shortcuts from the likes of Figma, Blender, Unreal to give users an easier time to transition to this. - 2026-01-16
- [x] Context menu should be using Solid.js, not Webgl. - 2026-01-16
- [x] Fix blurred text and shapes for retina and high quality screens - 2026-01-16 (set Pixi renderer resolution/autoDensity to match device pixel ratio for crisp output)
- [x] Break apart index.ts inside the editor package to sub modules for a more modular and simple architecture - 2026-01-16
- [x] Grid lines need to be visible no matter the scale (zoom) - 2026-01-16
- [x] Fix `pnpm typecheck` failing due to invalid CLI flag (`package.json:12` uses `tsc --no-emit`, should be `--noEmit`) - 2026-01-16
- [x] Fix root `pnpm typecheck` JSX errors by aligning root `tsconfig.json` with app settings or using project references (`app/src/*` requires `jsx` and `jsxImportSource`) - 2026-01-16
- [x] Fix root `pnpm typecheck` module resolution for `pixi.js` when checking `packages/editor/src/index.ts` (ensure workspace deps resolve during root typecheck) - 2026-01-16
