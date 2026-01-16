# Shadr Agent Instructions

This file contains instructions for AI agents working on the shadr project.

## Project Overview

Shadr is a WebGPU-based editor application built with:
- **Frontend**: SolidStart (Solid.js meta-framework)
- **Graphics**: WebGPU via TypeGPU
- **Build**: pnpm monorepo with Vinxi and tsup
- **Language**: TypeScript (strict mode)
- **Code Quality**: Biome (formatting + linting)

## Project Structure

```
shadr/
├── app/                    # Main SolidStart application
│   ├── src/
│   │   ├── app.tsx         # Root component
│   │   ├── components/     # UI components
│   │   │   └── editor.client.tsx  # WebGPU editor (client-only)
│   │   ├── entry-server.tsx
│   │   └── entry-client.tsx
│   └── app.config.ts       # SolidStart config
├── packages/
│   └── editor/             # @shadr/lib-editor library
│       └── src/index.ts    # WebGPU initialization
├── .ralph/                 # Ralph Wiggum automation
│   ├── PROMPT.md           # Main development prompt
│   ├── ralph.sh            # Main loop script
│   └── utils/              # Helper scripts
└── specs/                  # Feature specifications
```

## Commands

### Development

```bash
# Install dependencies
pnpm install

# Start development (run both in separate terminals)
pnpm dev:packages    # Watch library for changes
pnpm dev:app         # Start app dev server

# Or run both (app depends on packages being built)
pnpm --filter @shadr/lib-editor build && pnpm dev:app
```

### Code Quality

```bash
# Type check
pnpm typecheck

# Lint and format check
pnpm check

# Auto-fix lint/format issues
pnpm --filter @shadr/app check --fix
pnpm --filter @shadr/lib-editor check --fix

# Format code
pnpm format
```

### Build

```bash
# Build the editor library
pnpm --filter @shadr/lib-editor build

# Build the app
pnpm --filter @shadr/app build

# Start production server
pnpm --filter @shadr/app start
```

### Clean

```bash
# Remove all node_modules and dist
pnpm clean
```

## Code Style

- **Indentation**: Tabs (configured in biome.json)
- **Quotes**: Double quotes for JS/TS
- **Semicolons**: Required
- **Types**: Strict TypeScript, no `any`
- **Imports**: Use Effect patterns where applicable

## Key Patterns

### WebGPU Initialization

The editor uses TypeGPU for WebGPU abstraction. See `packages/editor/src/index.ts`:
- Uses `@typegpu/jit` for runtime GPU code generation
- Canvas is obtained from the DOM, not created programmatically

### Client-Side Components

Components that use WebGPU must be client-only. Use the `.client.tsx` suffix and lazy loading:
```typescript
import { lazy } from "solid-js";
const Editor = lazy(() => import("./components/editor.client"));
```

### Effect Library

The project uses the Effect library for functional programming patterns. Follow existing patterns when extending functionality.

## Common Issues

1. **WebGPU not available**: WebGPU requires a supported browser (Chrome 113+, Edge 113+, or Firefox Nightly with flag)

2. **Type errors in IDE**: Run `pnpm prepare` to install the Effect Language Service

3. **Build fails**: Ensure packages are built before app: `pnpm --filter @shadr/lib-editor build`

## Ralph Wiggum Automation

To run autonomous development loops:

```bash
# Planning mode - analyze codebase and create fix_plan.md
.ralph/ralph-plan.sh

# Development mode - implement features from fix_plan.md
.ralph/ralph.sh

# Test mode - focus on test coverage
.ralph/ralph-test.sh

# Infrastructure mode - CI/CD and build improvements
.ralph/ralph-infra.sh
```

## Learnings

<!-- Add learnings here as you work on the project -->
