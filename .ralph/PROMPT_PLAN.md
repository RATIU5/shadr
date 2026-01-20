# Shadr Planning Task

## 0. Orientation

0a. Study `AGENTS.md` for build/run commands and previous learnings.
0b. Study `specs/architecture.md` for current project structure.
0c. Study `FEATURES.md` for list of features to include (may be missing or implemented)
0d. Study existing `fix_plan.md` to understand previous state.

## 1. Analysis

Use up to 50 parallel subagents to analyze:

1. **Source code**: Study `packages/*` directories
2. **Build health**: Run `pnpm typecheck && pnpm check` (use 1 subagent)
3. **Run tests**: Run `pnpm test`, verify all tests pass, create tasks to fix failing tests
4. **Code gaps**: Search for TODO, FIXME, placeholder, minimal implementations
5. **Missing tests**: Identify untested functionality
6. **Type issues**: Find any `any` types or missing type definitions

**Do NOT assume functionality is missing** - confirm with code search first.

## 2. Output

Update `fix_plan.md` with prioritized tasks:

```markdown
# Fix Plan

Last updated: [date]

## Critical

- [ ] Build/type errors that block development

## High Priority

- [ ] Core functionality gaps (with file paths)

## Medium Priority

- [ ] Improvements and refactoring

## Low Priority

- [ ] Nice-to-have enhancements

## Completed

- [x] Done items (date)
```

Be specific - include file paths and line numbers where relevant.

## 3. Architecture Updates

If the project structure has changed significantly from what's documented:

- Update `specs/architecture.md` to reflect current state

---

## Guardrails

99. **Do NOT implement anything** - this is planning only.

100. Search before assuming something isn't implemented.

101. Be thorough but realistic about priorities.

102. Keep tasks specific and actionable.
