# Fix Plan

Last updated: 2026-01-17
Targets reference: `targets.md` (one task at a time)

> Run `.ralph/ralph-plan.sh` to analyze the codebase and update this list.

> Move all completed tasks to the "## Completed" section after they are marked done to keep things clean.

> Keep code simple, don't overengineer. Also keep the UI simple for the user, don't complicate things. Keep the UI concise. Refactor as needed. Keep files separated, and avoid putting all code into one file.

> Run 'pnpm typecheck' to ensure all types are correct and proper.

## Critical

## High Priority
- [ ] Warn when shader compile time exceeds 100ms and surface the warning in preview/status UI to align with performance target. (Targets: performance, UX feedback)

## Medium Priority

## Low Priority

## Completed

<!-- Move completed items here with date -->
- [x] Add explicit compile error state in the preview panel header and disable GLSL export actions while compilation errors exist so failures are unmistakable (Targets: reliability, UX feedback). - 2026-01-17
- [x] Audit `targets.md` feature target checkboxes against implemented functionality and mark completed items to keep targets in sync. (Targets: feature targets alignment, documentation) - 2026-01-17
- [x] Allow graph imports to load valid nodes even if some nodes are invalid, and surface warnings instead of failing. (Targets: save/load graph as JSON, UX feedback) - 2026-01-17

- [x] Align math operation ids/ports between `math-ops.ts` and GLSL compilation (e.g., mod-trunc/mod-floor/pingpong/less-than/greater-than/hyperbolic ops) so supported UI operations compile correctly. - 2026-01-17

- [x] Allow vec3 <-> color port compatibility with explicit GLSL conversion (vec3 -> color adds alpha 1.0, color -> vec3 uses rgb) and update connection validation/conversion hints. (Targets: type validation, UX) - 2026-01-17

- [x] Add GLSL compilation tests covering conversion nodes, input node variants (checkbox/text/select), and a representative set of math trig ops to improve GLSL reliability coverage. - 2026-01-17

- [x] Node execution visualization: Add Debug Mode that highlights active execution path in graph (dim non-executing nodes, brighten active path); show data flow animation with particles moving along connections during compilation; display intermediate values on connection hover during debug; implement breakpoint system where execution pauses at marked nodes; add step-through debugging controls (step into node, step over, continue); show execution timing per node to identify bottlenecks. - 2026-01-17

- [x] Connection display options: Add connection style dropdown in settings (Curved Bezier, Straight Lines, Step Lines, Orthogonal) to match user preference; implement connection emphasis mode that only shows connections to/from selected nodes (others dimmed to 20% opacity); support connection bundling where parallel wires between same two nodes are visually combined with number badge; add distance-based LOD where far-away connections render as straight lines for performance; include connection labeling option that shows data type inline on wire. - 2026-01-17

- [x] Compilation and performance indicators: Display compile status in bottom toolbar (Idle, Compiling, Success, Failed states with color coding and icon); show compile time and last compile timestamp; add shader complexity meter (vertex/fragment instruction count, texture sample count) in right sidebar; implement warning badges on nodes that contribute to performance issues (excessive texture samples, complex math); include Optimize Shader button that suggests simplifications; show real-time FPS counter when preview active (if debug view) - 2026-01-17

- [x] Multi-node operations and presets: Add Create Node Group from Selection action that bundles selected nodes into collapsible group with auto-generated input/output sockets; implement template/preset system where common node combinations can be saved and inserted as single action (PBR Setup, Basic Lighting, etc.); support copy/paste across different shader projects with automatic type adaptation; add Replace Node action that swaps node type while preserving compatible connections; include Explode Group action to unpack group back to individual nodes. - 2026-01-17

- [x] Quick duplication and alignment: Implement Alt+Drag to instantly duplicate nodes while dragging (show ghost preview during drag); add right-click context menu options for Align Left, Align Right, Align Top, Align Bottom, Align Horizontal Center, Align Vertical Center when multiple nodes selected; include Distribute Horizontally and Distribute Vertically options; add Straighten Connection option on wire right-click that auto-routes through reroute nodes for cleaner layout - 2026-01-17

- [x] Reroute and annotation nodes: Create lightweight reroute/junction nodes (small dot, no UI, just redirects connection) insertable via Alt+Click on existing wire or from Add menu; implement Frame nodes (colored rectangle backgrounds with title) to group related nodes visually without affecting execution, supporting nested frames and custom colors - 2026-01-17

- [x] Grid and canvas improvements: Reduce grid line opacity to 0.05 for subtle background guidance instead of prominent lines; add adaptive grid that shows finer subdivisions when zoomed in beyond 150%; implement snap-to-grid with visual snap indicators (highlight grid intersections when node nearby); - 2026-01-17

- [x] Connection line improvements: Implement gradient coloring on connection lines that matches socket type colors at each end (fading from output color to input color); add thickness variation where selected connections are 2-3px and unselected are 1px; show animated flow indicators (subtle moving dashes or gradient pulse) during shader compilation or when Preview Mode active; display connection validation feedback with red highlight when hovering incompatible socket types before dropping; add bezier curve smoothing with improved control points for cleaner routing around nodes. - 2026-01-17

- [x] Shader preview panel integration: Create dedicated preview renderer that auto-updates when selected node changes or upstream graph modifies; display preview in right sidebar's preview section with configurable resolution dropdown; implement zoom controls (fit, 100%, 200%) and pan with middle-mouse drag within preview; show checkerboard pattern background for alpha channel visualization; handle error states with "No Preview Available" message when non-renderable node selected or shader compilation fails; add "Preview at Output" toggle to switch between selected node output and final shader result; support exporting preview as PNG; update preview at throttled rate (max 30fps) to avoid performance impact during rapid parameter changes. - 2026-01-17

- [x] Visual hierarchy and consistency: Establish consistent 8px vertical spacing between inline socket controls; implement color-coded socket circles matching Blender conventions (gray=#808080 for float, yellow=#FFEB3B for color, blue=#2196F3 for vector, green=#4CAF50 for shader); show connection state visually with hollow circles when unconnected and filled circles when connected; hide redundant socket labels for obviously-connected sockets to reduce noise; add subtle node header background color variations by category (Math=blue tint, Vector=purple tint, Texture=orange tint, Output=green tint); ensure proper contrast ratios for text on all backgrounds; use consistent border radius (4px for inputs, 6px for nodes, 8px for panels). - 2026-01-17

- [x] Accessibility and input improvements: Ensure all numeric inputs support keyboard entry, click-and-drag to scrub values, and scroll wheel adjustment; implement color pickers with hex input field, RGB sliders, HSV mode, and eyedropper tool; add keyboard navigation to all dropdown menus with type-to-filter; support multi-select with Shift-click for range selection and Ctrl/Cmd-click for individual toggle; implement comprehensive undo/redo for all parameter changes, connections, node creation/deletion, and transforms; add visible keyboard focus indicators with outline styling for all interactive elements; support Tab key navigation between node parameters in selection order. - 2026-01-17
- [x] Canvas interaction enhancements: Implement double-click on node header to enable inline rename with text input that commits on Enter/blur; add hover tooltips on connected sockets showing upstream computed value and data type; support right-click on socket for quick disconnect action; implement click-outside-to-commit for active inline inputs; add keyboard shortcuts for common actions (Delete selected, Duplicate, Frame selection, Toggle preview mode); enable box selection by click-dragging on empty canvas area; show selection rectangle during drag and select all nodes within bounds on release. - 2026-01-17

- [x] Search-first node creation: Replace current Add Node flow with centered search overlay activated by Add Node button or keyboard hotkey; implement fuzzy matching that filters nodes instantly as user types; search across node names, categories, descriptions, and common aliases; show recently-used nodes at top of results; support arrow key navigation through filtered results and Enter to create selected node at mouse position or canvas center; include category labels in search results; dismiss overlay on Escape or click-outside. - 2026-01-17

- [x] Floating selection toolbar: Implement context-sensitive floating toolbar that appears centered above selected node(s) bounding box; show quick actions including Change Color Tag, Copy, Create Group, Delete, Bypass Node, and Convert to Group; display different action sets based on selection count (single node vs multiple nodes); auto-hide toolbar when selection cleared or user clicks elsewhere; position toolbar with offset to avoid obscuring selected nodes; ensure toolbar follows selection if dragged. - 2026-01-17

- [x] Left sidebar creation: Add new collapsible left sidebar with two main sections—top Shader Library section showing saved shaders in expandable folder tree with thumbnails; bottom Node Palette section showing categorized node types (Math, Vector, Color, Texture, Output, etc.) with category expansion, search filter input, and drag-to-canvas functionality for quick node insertion; enable dragging nodes from palette directly onto canvas at drop position; include recently-used nodes section at top of palette; support keyboard navigation and type-to-filter in both library and palette. - 2026-01-17

- [x] Bottom toolbar consolidation: Reorganized bottom toolbar into three horizontal zones with Add Node + search field on the left, Edit/Preview/Debug mode toggles in the center, and Compile/Export/Settings actions plus consolidated dropdown menus on the right; added compile + mode shortcuts to speed workflows. - 2026-01-17

- [x] Right sidebar reorganization: Transform sidebar from parameter editor to contextual metadata panel; display selected node name, type, and category in compact header at top; add integrated shader preview panel with live render output, resolution controls (128/256/512/1024), zoom/pan, and checkerboard alpha background; include collapsible Advanced Options section for output clamping, precision mode, custom node labels, and color tags; add Output Information section showing socket data types, connection count, and current computed preview values; never duplicate inline node controls in this sidebar, only show metadata and advanced settings. - 2026-01-17
- [x] Drag-to-reconnect connectors: Allow grabbing an existing wire endpoint to "pull" it off its socket, immediately detach, keep the wire following the cursor, and on drop either connect to a valid compatible socket (with type conversion if allowed) or cancel/restore if dropped on empty space; this should feel identical to creating a new connection from that endpoint. - 2026-01-17

- [x] Modal backdrop transparency: Remove the dark overlay entirely; keep click-outside to dismiss, but ensure background remains visible and interaction behind the modal is blocked using a transparent blocker layer rather than dimming. - 2026-01-17

- [x] Nested groups up to 10 levels: Support recursive group membership with a hard depth cap; enforce in group creation and drag-drop (block nesting beyond 10 with a clear UI message), and ensure selection/move/drag operations respect group ancestry (dragging a parent moves descendants, collapsing parent hides all descendants). - 2026-01-17
- [x] Collapse/uncollapse UI cleanup: On expand, fully tear down collapsed-mode visuals (collapsed proxy node, compact labels, placeholder ports) before restoring child node render; ensure reflow happens once to avoid overlapping frames and stale hit areas. - 2026-01-16
- [x] Double-click behavior: Bind double-click only on the group container background (its hit area), ignore double-clicks that originate on node headers/ports/controls; add a small padding hit zone so double-clicking empty space inside the group is reliable and doesn't conflict with node interactions. - 2026-01-16
- [x] Update the rendering and interaction flow so input sockets display inline controls when unconnected but hide them when connected, mirroring Blender's socket-as-parameter UX; implement a DOM-overlay input system for socket editing (spawn `<input>`/`<select>` at socket screen position on interaction, sync to socket value, destroy on blur/submit, render static value text in Pixi when not editing), keep a single active editor at a time, and ensure pointer-event handling and IME/mobile compatibility. Refactor connectors to use socket-driven types and conversion hints, redraw ports automatically when a node's socket layout changes, and update selection/inspector panels to reflect socket-level values and state, prioritizing a clean, low-friction editing experience with consistent affordances (clear labels, value previews, minimal clicks). - 2026-01-16
- [x] Replace the current split between NodeState.params and ports with a socket-as-parameter model that makes each input socket the single source of truth for its value when unconnected; introduce a NodeSocket type (id, label, direction, dataType, value, uiSpec, isConnected, defaultValue, visibilityRules, conversionRules) and store socketValues per node (or inline in sockets) while keeping nodeState only for operational mode knobs (e.g., Math operation, vector mode) that drive socket layout and type inference. Provide a declarative buildSockets(state) builder for every node definition that returns the full socket list (including conditional visibility and dynamic type changes), and update serialization to persist {nodeState, socketValues} so sockets are rebuilt on load and values re-applied; add a typed conversion map so compatible sockets auto-convert on connect, and enforce type coloring/labels based on PortType. - 2026-01-16
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
