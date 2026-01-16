# Shadr Agent Instructions

## Overview

WebGPU-based editor built with SolidStart + TypeGPU.

## Structure

```
shadr/
├── app/                  # SolidStart application
│   └── src/
│       ├── app.tsx       # Root component
│       └── components/   # UI (editor.client.tsx)
├── packages/editor/      # @shadr/lib-editor library
├── specs/                # Architecture docs
└── .ralph/               # Automation scripts
```

## Commands

```bash
# Install
pnpm install

# Dev (run both)
pnpm dev:packages    # Watch library
pnpm dev:app         # Start app

# Check
pnpm typecheck       # Type check
pnpm check           # Lint + format

# Build
pnpm --filter @shadr/lib-editor build
pnpm --filter @shadr/app build
```

## Code Style

- Tabs, double quotes, semicolons
- Strict TypeScript - no `any`
- Client components: `.client.tsx` suffix + lazy loading

## Ralph Automation

```bash
.ralph/ralph-plan.sh   # Analyze and create fix_plan.md
.ralph/ralph.sh        # Development loop
```

## Learnings

<!-- Add discoveries here -->
