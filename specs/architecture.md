# Shadr Architecture

## Overview

Shadr is a WebGPU-based shader/graphics editor. This document describes the high-level architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SolidStart App                        │   │
│  │  ┌───────────────┐  ┌────────────────────────────────┐  │   │
│  │  │   Server      │  │         Client                  │  │   │
│  │  │   (SSR)       │  │  ┌────────────────────────┐    │  │   │
│  │  │               │  │  │     Editor Component   │    │  │   │
│  │  │  - HTML shell │  │  │                        │    │  │   │
│  │  │  - Hydration  │  │  │  ┌──────────────────┐ │    │  │   │
│  │  │               │  │  │  │  @shadr/lib-     │ │    │  │   │
│  │  │               │  │  │  │  editor          │ │    │  │   │
│  │  │               │  │  │  │                  │ │    │  │   │
│  │  │               │  │  │  │  - WebGPU init   │ │    │  │   │
│  │  │               │  │  │  │  - TypeGPU       │ │    │  │   │
│  │  │               │  │  │  └──────────────────┘ │    │  │   │
│  │  │               │  │  └────────────────────────┘    │  │   │
│  │  └───────────────┘  └────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                         WebGPU API                               │
├─────────────────────────────────────────────────────────────────┤
│                            GPU                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Package Structure

### @shadr/app (app/)

The main application built with SolidStart.

**Responsibilities:**
- UI rendering with Solid.js
- Routing (if needed)
- Server-side rendering for initial HTML
- Client-side hydration

**Key Files:**
- `app.tsx` - Root component, lazy loads editor
- `components/editor.client.tsx` - Client-only WebGPU editor
- `app.config.ts` - SolidStart configuration

### @shadr/lib-editor (packages/editor/)

Shared library for WebGPU/editor functionality.

**Responsibilities:**
- WebGPU device initialization
- Canvas setup and management
- TypeGPU integration
- Shader compilation (future)
- Rendering pipeline (future)

**Key Files:**
- `src/index.ts` - Main exports, WebGPU initialization

## Data Flow

1. **Initial Load**:
   - Server renders HTML shell
   - Client receives and hydrates
   - Editor component lazy-loaded

2. **Editor Initialization**:
   - Canvas element obtained from DOM
   - WebGPU adapter and device requested
   - Canvas context configured
   - Render loop started (future)

3. **User Interaction** (future):
   - User edits shader code
   - Shader recompiled on GPU
   - Canvas re-rendered

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| UI Framework | Solid.js | Fast, reactive, good TypeScript support |
| Meta-framework | SolidStart | SSR, file routing, Vinxi build |
| GPU API | WebGPU | Modern, performant, type-safe with TypeGPU |
| GPU Abstraction | TypeGPU | Type-safe GPU programming |
| Build Tool | tsup (lib), Vinxi (app) | Fast, zero-config |
| Package Manager | pnpm | Fast, efficient, workspace support |
| Type Checking | TypeScript (strict) | Safety, documentation |
| Code Quality | Biome | Fast, unified formatter + linter |

## Future Considerations

1. **Shader Editor UI**: Monaco or CodeMirror for code editing
2. **Shader Language**: WGSL with syntax highlighting
3. **Asset Management**: Textures, models, buffers
4. **State Management**: Effect or simple signals
5. **Persistence**: Save/load projects (localStorage, file system, cloud)

## Constraints

- **Browser Support**: WebGPU required (Chrome 113+, Edge 113+, Firefox with flag)
- **Node Version**: 22.x minimum
- **No WebGL Fallback**: WebGPU only (for now)
