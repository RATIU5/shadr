# Targets

Last updated: 2026-01-16

**FOCUS ON ONE TASK OR FEATURE AT A TIME**

## Goals

- [ ] Goal: Node-Based Visual Shader Editor: Browser-based graphical editor using Pixi.js that enables visual shader programming through an interactive node graph system—users create nodes representing shader operations (math, textures, vertex/fragment operations) with typed input/output ports, connect them via directed edges to define data flow, and manipulate the graph with pan/zoom/drag interactions on an infinite canvas. The editor compiles the node graph into GLSL WebGL shader code, translating the visual connections into shader program output that can be executed on the GPU. Similar to Blender's Shader Editor, Unreal's Material Editor, or Unity's Shader Graph, the tool renders nodes and connections using WebGL, provides context menus for spawning shader nodes (operations, inputs, outputs), and offers click-drag interactions for wiring ports together, allowing users to build complex shader programs by connecting functional blocks instead of writing raw GLSL code.

## Feature Targets

- [ ] User can navigate around an infinite grid in WebGL (zoom, pan, drag)
- [ ] Editor supports creating/deleting nodes (WebGL rendered, not DOM nodes) via context menu or hotkeys
- [ ] Nodes have typed input/output ports (float, vec2/3/4, texture, color)
- [ ] User can connect/disconnect ports by click-dragging between compatible types
- [ ] Real-time shader preview window showing compiled output on test geometry
- [ ] Node library with common operations (math, texture sampling, vertex/fragment inputs/outputs, constants)
- [ ] Graph compiles to valid GLSL vertex/fragment shader code
- [ ] Save/load graph as JSON
- [ ] Undo/redo for all graph operations
- [ ] Node selection (single/multi) and batch operations (delete, move)
- [ ] Type validation prevents invalid connections
- [ ] Export compiled GLSL code

## Quality Targets

- [ ] Performance: 60fps canvas interaction with 100+ nodes; shader recompilation <100ms
- [ ] Reliability: Generated GLSL always compiles; graceful error display for cyclic graphs or missing connections
- [ ] UX: Visual feedback on hover/drag; connection curves smooth; node search/fuzzy find; clear type color coding; immediate preview updates

## Non-Goals

- [ ] 3D mesh editing or modeling tools
- [ ] Multi-pass rendering or render pipeline configuration
- [ ] Advanced GLSL debugger or profiler
- [ ] Asset management system (textures, meshes live externally)
- [ ] Animation or timeline features
- [ ] Collaborative/multiplayer editing
- [ ] Mobile touch interface (desktop/mouse primary target)

## Notes

- Keep targets in sync with `fix_plan.md` priorities.
