# Shadr Agent Instructions

> **Keep this file operational only.** Status updates belong in `fix_plan.md`.

## Overview

WebGPU-based shader editor built with SolidStart + TypeGPU.

## Structure

```
shadr/
├── app/                  # SolidStart application
│   └── src/
│       ├── app.tsx       # Root component (lazy loads editor)
│       └── components/   # UI components
│           └── editor.client.tsx  # WebGPU editor (client-only)
├── packages/editor/      # @shadr/lib-editor library
│   └── src/index.ts      # WebGPU initialization
├── specs/                # Architecture documentation
├── fix_plan.md           # Task tracking
└── .ralph/               # Automation scripts
```

## Commands

```bash
# Install
pnpm install

# Development
pnpm dev:packages         # Watch library changes
pnpm dev:app              # Start dev server

# Validation (run before committing)
pnpm typecheck            # Type checking
pnpm check                # Lint + format

# Build
pnpm --filter @shadr/lib-editor build
pnpm --filter @shadr/app build
```

## Code Patterns

- **Indentation**: Tabs
- **Quotes**: Double quotes
- **Types**: Strict TypeScript - no `any`
- **Client components**: Use `.client.tsx` suffix + lazy loading
- **Effect library**: Follow existing patterns where used

## Ralph Automation

```bash
.ralph/ralph-plan.sh              # Analyze codebase, update fix_plan.md
.ralph/ralph.sh                   # Development loop (unlimited)
.ralph/ralph.sh --max 20          # Limit to 20 iterations
.ralph/ralph.sh --timeout 30      # 30 min timeout per iteration
```

---

## Learnings

> Add discoveries here that help future iterations avoid mistakes.

<!-- Example:
- WebGPU requires Chrome 113+ or Firefox Nightly with flag
- Always build packages before app: pnpm --filter @shadr/lib-editor build
- Effect Language Service: run pnpm prepare if IDE shows type errors
-->

---

## Guardrails

> Add "signs" here when Ralph repeatedly makes the same mistake.

<!-- Example:
- DO NOT use `any` type - always define proper types
- DO NOT create new files without checking if similar exists
- ALWAYS run pnpm typecheck before committing
-->
