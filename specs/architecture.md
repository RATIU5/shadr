# Core Architecture Overview

_Last updated: 2026-01-17_

This document summarizes the **core architectural patterns, technology choices, and design principles** for the application. It is intentionally concise and general, serving as a shared reference for long-term system coherence.

---

## Architectural Goals

- **Offline-first, single-user** by design
- **Deterministic, pure computation** (all nodes are pure functions)
- **Lazy, pull-based execution** (compute only what is requested)
- **Strict typing & correctness over convenience**
- **High performance at ~1000 nodes** without premature optimization
- **Clear separation of concerns** (data, execution, rendering, UI)
- **Composable systems** using Effect-based services and boundaries
- **Extensible internally** via plugin architecture (no third-party API yet)

---

## High-Level Architecture

The system is split into **four primary layers**, each with explicit responsibilities:

```

┌──────────────────────────┐
│ UI Layer │ SolidJS + Kobalte (DOM)
│ (Panels, menus, forms) │
└────────────┬─────────────┘
│
┌────────────▼─────────────┐
│ Canvas / View │ PixiJS (WebGL)
│ (Nodes, wires, grid) │
└────────────┬─────────────┘
│
┌────────────▼─────────────┐
│ Execution & Graph │ Pure TS + Effect
│ (Graph, typing, exec) │
└────────────┬─────────────┘
│
┌────────────▼─────────────┐
│ Storage & Services │ IndexedDB + Effect
│ (Persistence, events) │
└──────────────────────────┘

```

---

## Core Technology Choices

### SolidJS (Application UI)

**Role**

- Application shell
- Panels (node library, inspector)
- Context menus, modals, notifications
- Parameter editing controls

**Why SolidJS**

- Fine-grained reactivity (minimal re-renders)
- Predictable performance with large state graphs
- Clean separation between reactive state and imperative systems
- Pairs well with PixiJS when canvas state is kept imperative

**Guiding Rules**

- Solid manages **UI state**, not canvas rendering
- Pixi objects are **not reactive**
- Effects are invoked through services, not embedded deeply in components
- Kobalte primitives are currently provided via a local shim package (`packages/kobalte-core`) for offline development; swap to upstream `@kobalte/core` when available

---

### PixiJS (Rendering & Interaction)

**Role**

- Render nodes, sockets, wires, grid, and selection
- Handle hit testing and pointer interactions
- Manage world ↔ screen coordinate transforms

**Why PixiJS**

- High-performance WebGL rendering
- Stable interaction system
- Well-suited for large, dynamic scenes (~1000 nodes)
- Imperative rendering avoids virtual-DOM overhead

**Patterns**

- Scene graph mirrors graph data model (ID-stable mapping)
- Viewport culling and batched rendering
- Render loop decoupled from execution loop
- DOM overlays used only where Pixi is inappropriate

---

### Effect (effect-ts) – Core Composition Layer

**Role**

- Service boundaries (Graph, Execution, Storage, Events)
- Typed error handling and domain modeling
- Deterministic side-effect management
- Composability without shared mutable state

**Why Effect**

- Enforces explicit dependencies
- Makes execution order and failure modes visible
- Ideal for graph operations, validation, and execution pipelines
- Prevents “action at a distance” in complex systems

**Usage Principles**

- Graph operations return `Effect<Result>`
- UI triggers Effects via thin adapters
- No implicit global state
- Effects orchestrate side-effects (storage, logging, notifications)

---

## Graph & Execution Architecture

### Graph Model

- Adjacency-list based
- Nodes, sockets, and wires identified by stable IDs
- Strictly typed sockets (no implicit casting)
- Validation occurs **before** graph mutation

### Execution Model

- **Pull-based (lazy)**: compute only when output requested
- **Pure functions only**: no IO or side effects in nodes
- **Topological execution order** per requested output
- **Memoized per node** with dirty-flag propagation
- **Deterministic**: same inputs always produce same outputs

### Error Handling

- Invalid graphs do not crash execution
- Node errors are localized and surfaced in UI
- Missing required inputs yield explicit error states
- Circular dependencies prevented at connection time

---

## Plugin & Extensibility Model

**Scope**

- Internal-only for MVP
- Used for node packs, socket types, UI widgets

**Capabilities**

- Register node definitions
- Register socket types
- Subscribe to graph/execution events

**Design Principles**

- Plugins declare, never mutate
- No access to unsafe APIs from node compute functions
- Plugins extend behavior without modifying core

---

## State & Data Management

### Persistence

- IndexedDB for:
  - Graph documents
  - Settings
  - UI state
- Versioned schemas with forward migrations
- Autosave on graph mutations

### History

- Graph-aware undo/redo
- Command-based mutations
- Batched operations for drag and multi-edit

---

## Performance Principles

- No reactive binding between graph execution and rendering
- Execution only runs on explicit demand
- Pixi rendering optimized for visibility and scale
- Structural sharing and minimal allocations in graph core
- Avoid premature generalization beyond MVP limits

---

## Testing

- Unit tests use Vitest in core packages
- Playwright smoke tests live in `tests/e2e` and load `packages/app-web/index.html` directly

---

## Non-Goals (By Design)

- No multi-user or collaborative features
- No async nodes or background IO at MVP
- No implicit type coercion
- No hidden execution triggers
- No DOM-based canvas rendering

---

## Architectural North Star

> **A deterministic, composable, high-performance node system where execution is explicit, data flow is visible, and complexity scales linearly with intent—not with features.**

This document should evolve, but its principles should remain stable.
