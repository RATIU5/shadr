# Shadr Agent Instructions

Single-user, offline-first node-based editor for deterministic data, shader, and code generation.

## Essentials

- Package manager: pnpm (enable via `corepack enable`)
- Status updates, progress, and task tracking belong in `fix_plan.md`
- If assumptions conflict with the codebase, trust the codebase and update the relevant agent docs
- Do not silently work around incorrect architecture assumptions; update docs and `fix_plan.md` when needed

## Key Commands

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm format
pnpm test
```

## Detailed Guides

- Architecture and repo layout: `docs/agents/architecture.md`
- Execution model: `docs/agents/execution.md`
- Graph model: `docs/agents/graph.md`
- Rendering rules: `docs/agents/rendering.md`
- Persistence and history: `docs/agents/persistence.md`
- Plugin system: `docs/agents/plugins.md`
- Code patterns and conventions: `docs/agents/conventions.md`
- Anti-goals (what the app is not): `docs/agents/anti-goals.md`
- Learnings: `docs/agents/learnings.md`
- Guardrails: `docs/agents/guardrails.md`
