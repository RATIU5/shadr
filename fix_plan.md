# Fix Plan

Last updated: 2026-01-16
Targets reference: `targets.md` (one task at a time)

> Run `.ralph/ralph-plan.sh` to analyze the codebase and update this list.
> Move all completed tasks to the "## Completed" section after they are marked done to keep things clean.

## Critical

- [ ] Refactor for a more composable/modular approach, consider the benefits of implementing Effect-ts (research recommended) for composability with the pros and cons and overall decision to use it or not for this project. For final decision, ensure code is cleanly broken up into managable files, try to keep files under 1000 lines of code, create additional packages to separate concerns appropriately, ensure code is easily readable and maintainable by humans (break this step into multiple steps and tasks, after evaluating options and final decision)

## High Priority

- [ ] Implement TailwindCSS for all DOM UI, and replace the existing CSS with TailwindCSS classes
- [ ] Refactor and determine what UI elements should be apart of the DOM, and what should be apart of the Canvas (webgl/webgpu). For example: overlays, alerts, toasts, modals, context menus -> DOM. Node blocks, grid, webgl output, node block text -> Canvas.
- [ ] Improve keyboard controls, allow "Space + Left Mouse" to drag around canvas, OR "Middle Mouse" to drag around canvas too. Research and use best practices and commonly used shortcuts from the likes of Figma, Blender, Unreal to give users an easier time to transition to this.
- [ ] Simplify context menu to controls, not node blocks to add to the canvas. Keep delete, copy selected, cut selected, reset zoom, etc... and other useful tools
- [ ] Add global control nav (like Figma) for different tools, selecting nodes to add, etc... Placement is at the bottom, fixed, with a clean UI
- [ ] Add transformation nodes (vec3 -> vec4 or vec4 -> vec3, float -> int) and other nodes as you see fit (research the likes of Blender, Unreal Engine, etc... for best practices and recommendations like other math functions)
- [ ] Node blocks have the ability to have dropdown menus inside (capture mouse click on canvas, a dynamic dropdown menu is generated at the spot (via DOM) if a dropdown activation area was selected). Also keep in mind how scaling (zoom) will affect the DOM dropdown so it looks consistent at any zoom value. Or another approach, clicking on a node opens a form of controls to control the node process (how it runs, transforms, etc... it runs)
- [ ] Click/select area for node wires is larger than the defined colored circle for improved UX, where the select/drag area may go outside the node box
- [ ] The ability to group nodes together (like Blender) and then to collapse/show the node group, where custom input values may be created for the group of nodes, and optional output may be apart of the group (may require architecture change)
- [ ] Introduce a flexible interface: ability to resize sections/panels, local storage to save preferences, settings menu or tab, take inspiration from other local-first CSR apps like Figma with a modern clean and minimal feel
- [ ] Setup a debug view for canvas and console: highlight and show additional information on nodes, positions, scale, FPS, errors, warnings, info, etc... as an overlay on Canvas for developers.

## Medium Priority

- [ ] Split the code into more files, organized by best practices
- [ ] Ensure rendering is optimized for large nodes
- [ ] Round corners slightly on node blocks
- [ ] Ensure most visual properties can be controlled via a settings form (DOM), saves preferences to local storage or IndexedDB. Break this into multiple elaborated steps. Properties like node blocks roundness, curved or straight node lines/pipes/connectors, show/render enhanced visuals or animations, debug mode, grid line colors, grid subcategories (when zooming in and out) value, background colors, node colors, etc...
- [ ] Show enhanced visuals (lines/pipes/connectors show small animation of data "flowing" through the wire to from one node to another)
- [ ] UI should appear seamless, clean, cohesive, as if it all were apart of a theme.
- [ ] Improve text rendering quality in Canvas, it appears blurry on high-resolution displays when zoomed in
- [ ] Smooth curved lines, so they don't appear pixelated for all canvas rendered elements

## Low Priority

## Completed

<!-- Move completed items here with date -->

- [x] Add tests for pan/zoom transform logic to prevent regressions once camera controls land (new test file under `packages/editor/`) - 2026-01-16
- [x] Ensure `initCanvas` uses Pixi.js and is exported from `@shadr/lib-editor` (`packages/editor/src/index.ts:1`, `app/src/components/editor.client.tsx:1`) - 2026-01-16
- [x] Remove WebGPU/TypeGPU dependencies and update editor initialization to Pixi.js (`packages/editor/package.json`, `packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Update documentation to reflect Pixi.js renderer (`AGENT.md`, `specs/architecture.md`) - 2026-01-16
- [x] Add Pixi.js canvas lifecycle cleanup on unmount (`app/src/components/editor.client.tsx:1`) - 2026-01-16
- [x] Implement infinite grid rendering and camera container setup in Pixi app init (`packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Update root typecheck to target app/editor configs and add local Pixi type shim for workspace checks (`package.json`, `app/tsconfig.json`, `packages/editor/src/types/pixi.d.ts`) - 2026-01-16
- [x] Remove stale `@webgpu/types` reference from editor tsconfig to restore `pnpm typecheck` in Pixi-only setup (`packages/editor/tsconfig.json`) - 2026-01-16
- [ ] - [x] Add shader compilation smoke tests to guard GLSL generation for fragment output so GLSL export stays valid as templates evolve (`packages/editor/src/__tests__/shader.test.ts`) - 2026-01-16
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
- [x] Context menu should be using Solid.js, not Webgl. - 2026-01-16
- [x] Fix blurred text and shapes for retina and high quality screens - 2026-01-16 (set Pixi renderer resolution/autoDensity to match device pixel ratio for crisp output)
- [x] Break apart index.ts inside the editor package to sub modules for a more modular and simple architecture - 2026-01-16
- [x] Grid lines need to be visible no matter the scale (zoom) - 2026-01-16
- [x] Fix `pnpm typecheck` failing due to invalid CLI flag (`package.json:12` uses `tsc --no-emit`, should be `--noEmit`) - 2026-01-16
- [x] Fix root `pnpm typecheck` JSX errors by aligning root `tsconfig.json` with app settings or using project references (`app/src/*` requires `jsx` and `jsxImportSource`) - 2026-01-16
- [x] Fix root `pnpm typecheck` module resolution for `pixi.js` when checking `packages/editor/src/index.ts` (ensure workspace deps resolve during root typecheck) - 2026-01-16
