# Shadr Planning Task

## 0. Orientation

0a. Study `AGENT.md` for build/run commands and previous learnings.
0b. Study `targets.md` for current goals and feature targets.
0c. Study `specs/architecture.md` for current project structure.
0d. Study existing `fix_plan.md` to understand previous state.

## 1. Analysis

Use up to 50 parallel subagents to analyze:

1. **Source code**: Study `app/` and `packages/` directories
2. **Build health**: Run `pnpm typecheck && pnpm check` (use 1 subagent)
3. **Code gaps**: Search for TODO, FIXME, placeholder, minimal implementations
4. **Missing tests**: Identify untested functionality
5. **Type issues**: Find any `any` types or missing type definitions

**Do NOT assume functionality is missing** - confirm with code search first.

## 2. Output

Update `fix_plan.md` with prioritized tasks that advance `targets.md` (one at a time):

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
If `targets.md` lacks concrete targets, add a small set of specific, actionable targets. **Focus only on one target at a time**. When that target is completed, create tasks for the next target. Find the appropriate order for the targets: start small, build up complexity, and prioritize foundational tasks first.

## 3. Architecture Updates

If the project structure has changed significantly from what's documented:

- Update `specs/architecture.md` to reflect current state

---

## Guardrails

99. **Do NOT implement anything** - this is planning only.

999. Search before assuming something isn't implemented.

9999. Be thorough but realistic about priorities.

99999. Keep tasks specific, concise, and actionable.
