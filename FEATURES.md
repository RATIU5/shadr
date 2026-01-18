# Shadr Features

## **CORE ARCHITECTURE**

**Execution Model:**

- Pull-based (lazy evaluation): compute only when output requested
- Memoization/caching per node (dirty flagging)
- Execution triggered by: output request, preview update, explicit compile

**Graph Data Structure:**

- Adjacency list representation
- Topological sort for execution order
- Circular dependency detection (validation on wire connect)
- Efficient traversal methods (upstream, downstream, all connected)

**Event System:**

- Message bus architecture for plugin communication
- Core events: node.created, node.deleted, wire.connected, wire.disconnected, graph.executed, socket.valueChanged
- Sync event dispatch (async for heavy operations flagged separately)
- Plugin lifecycle hooks: init, destroy, enable, disable

**Socket Type System:**

- Typed values (primitives: float, vec2, vec3, vec4, mat3, mat4, sampler2D, bool, int)
- Type validation on connection attempt
- Explicit conversion nodes (no implicit casting)
- Custom types extensible via plugin registration (string, time, etc...)

**Rendering Pipeline (PixiJS):**

- Graph as source of truth (PIXI objects reflect data model)
- Viewport culling (render only visible nodes, defer until needed)
- Coordinate space conversion (screen ↔ world transforms)
- Hit detection via PIXI's interaction system
- Separate render loop from execution loop

## **CORE GRAPH PRIMITIVES**

**Nodes:**

- Customizable node types (Input, Processing, Transformations, Type Conversions, Export + any custom categories)
- Plugin architecture: any class extending NodeData flows through
- Node anatomy configurable per type:
  - Header: title, icons, collapse button, bypass toggle, lock indicator
  - Body: params, custom UI (sliders, dropdowns, color pickers, code editors), socket columns
  - Footer: status text, error/warning badges, value preview, execution time
- Node states: normal, selected, bypassed, locked, error
- Node shapes: rounded
- Auto-sized nodes based on content
- Node metadata: descriptions/tooltips (inline help), custom

**Sockets:**

- Input/output types with color coding
- Socket shapes (circle, triangle, square) for additional type distinction
- Optional vs required (visual indicator)
- Socket constraints: min/max connections, validation rules
- Socket labels (show/hide, custom positioning)
- Default or null values when unconnected
- Socket metadata: hover tooltips, units, ranges, custom
- Socket drag/drop area larger than visible area and shape

**Wires:**

- Type-safe connections with color coding
- Visual styles: straight, bezier
- Wire states: normal, highlighted, dimmed, animated (data flow), error
- Wire labels (data type, values, custom text) visible on hover
- Reroute/dot nodes: create, drag to reposition, drag over open area to delete
- Detached wire dragging (from end only)
- Wire select/drag area larger/thicker than visible area and shape

---

## **CANVAS & NAVIGATION**

**Viewport:**

- Infinite canvas with soft boundaries (notification when no elements in view)
- Pan: middle mouse, spacebar+drag, two-finger trackpad
- Zoom: scroll wheel, pinch, keyboard (+/-), zoom to fit, zoom to selection
- Grid: show/hide, snap-to-grid toggle

**Frame & Focus:**

- Frame all nodes (F key)
- Frame selected
- Frame by group/category
- Breadcrumb navigation (when diving into subgraphs/subgroups)

**Visual Hierarchy:**

- Background layers: grid, network boxes, nodes, wires, overlays
- Z-ordering: bring to front/send to back
- DOM overlay elements (HTML/CSS UI on top of canvas)

---

## **SELECTION & MANIPULATION**

**Selection:**

- Click, marquee box
- Additive (Shift), subtractive (Alt)
- Select connected (upstream/downstream/all)

**Editing:**

- Multi-node drag
- Auto-layout: manual
- Copy/paste with connection preservation
- Duplicate (Ctrl+D) with offset
- Delete with wire reconnection options (bridge, remove all)
- Group/ungroup operations, add/remove from group

**Network Boxes/Frames:**

- Custom title, color, description
- Collapse/expand (show only I/O sockets)
- Resize, drag (moves contents)
- Nested boxes allowed
- Promoted parameters (expose internal node params externally, allow user to specify what input/output sockets to show)

---

## **DATA & TYPE SYSTEM**

**Type Handling:**

- Strict typing
- Conversion nodes (explicit type casts, internal optional custom type conversion functions)
- Type compatibility (define which types can connect (in code only, not in interface)

**Data Flow:**

- Push evaluation models
- Lazy evaluation (only compute when needed)
- Caching (dirty/clean propagation)
- Passthrough nodes (no-op when data unchanged)
- Data cloning vs reference passing
- Null/undefined propagation rules

**Data Inspection:**

- Socket value preview (hover tooltip)
- Data inspector panel (detailed view of selected socket/node, minimal ui)

---

## **EXECUTION & DEBUGGING**

**Execution Model:**

- Execution flow visualization: animated wires, execution order badges, timing bars
- Async/background execution (non-blocking UI)

**Debugging:**

- Validation warnings (unused nodes, missing connections, circular deps)
- Debug console (print node outputs)

**State Management:**

- Bypass (skip node, pass input to output)
- Mute (disconnect but preserve wires)
- Solo (execute only this path)
- Lock (prevent editing)
- Freeze (cache output, don't recompute)

---

## **WORKFLOW & PRODUCTIVITY**

**Node Library:**

- Search with fuzzy matching, tags, categories
- Favorites/recent nodes
- Custom node templates
- Drag & drop from library

**Creation & Editing:**

- Situational-aware dynamic context menu
- Right-click menu: add node here, cut wire, insert node on wire
- Quick-add (spacebar/Tab): search, create
- Wire tap (click wire to insert node)

**Clipboard & Transfer:**

- Copy/paste (JSON format for cross-app compatibility)
- Export selection as template
- Import from file/URL

**Storage:**

- Settings, nodes, groups, values all stored in IndexedDB

**History:**

- Undo/redo (graph-aware, not just parameter changes)
- Auto-save

---

## **SUBGRAPHS & MODULARITY**

**Encapsulation:**

- Collapse to subgraph (create reusable module)
- Expose custom parameters (user connects input/output sockets to group/subgraph IO)
- Custom I/O sockets for subgraph
- Nested subgraphs (10 levels in depth)
- Dive in/out navigation (breadcrumbs)

**Reusability:**

- Node instances (reference same source, update all)
- Local overrides (per-instance param changes)
- Library system (save/load subgraphs)
- Asset management (versioning, dependencies)
- HDA/Digital Asset style workflow (Houdini-inspired)

---

## **VALIDATION & ERRORS**

**Connection Validation:**

- Prevent invalid type connections (visual feedback)
- Required input warnings
- Circular dependency detection
- Max connection limits (by code in node class)
- One-to-many vs one-to-one enforcement (by code in node class)

**Error Handling:**

- Error badges on nodes (color-coded severity)
- Error tooltips (detailed messages)

---

## **CUSTOMIZATION & THEMES**

**Visual Customization:**

- Color schemes (dark/light)
- Font size, family (Google Fonts)
- Icon pack (Lucide only)

**Behavior Settings:**

- Auto-save frequency
- Undo stack depth
- Zoom/pan sensitivity

---

## **ACCESSIBILITY**

- Full keyboard navigation
- Keyboard shortcuts customization

---

## **INTEGRATION & EXTENSIBILITY**

**Plugin API (code internal):**

- Custom node types (register new node classes)
- Custom socket types
- Custom UI widgets
- Event hooks (node created, wire connected, graph executed)

**Data Bridges:**

- Export formats (JSON, XML, custom, all as output Node block types)
