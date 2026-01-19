# Shadr Development Task

## 0. Orientation

0a. Study `AGENTS.md` to understand build/run commands and learnings.
0b. Study `fix_plan.md` to understand current tasks and priorities.
0c. Study `specs/architecture.md` to understand project structure.
0d. Study `FEATURES.md` to understand overall goals and features of the project.
0e. Review recent changes: `git log --oneline -5`

## 1. Task Selection

Pick the SINGLE highest priority uncompleted item from `fix_plan.md`.

**Focus on ONE task only.** Complete it fully before moving on.

## 2. Before Making Changes

Before implementing, search the codebase using parallel subagents:

- **Do NOT assume functionality is not implemented** - always search first
- Use up to 50 parallel subagents for reading and searching files
- Verify the current state before making changes

## 3. Implementation

Implement the selected task following existing code patterns.

After implementing:

- Run validation: `pnpm lint && pnpm check`
- If tests/checks fail, fix them before proceeding
- Use only 1 subagent for build/test operations (backpressure control)

## 4. Documentation Updates

When you make changes:

- Update `fix_plan.md`: mark task complete `[x]` or add new discoveries
- Update `specs/architecture.md` if you change project structure
- Update `docs/agents/learnings.md` Learnings section if you discover important patterns

**Capture the why** - document not just what you did, but why it matters.

---

## Guardrails

99. Always search before assuming code doesn't exist.

100. One task per iteration. Do not start multiple tasks.

101. No placeholder or minimal implementations - implement fully.

102. Follow TypeScript strict mode - no `any` types.

103. Keep `fix_plan.md` up to date with progress after every change.

104. If you discover bugs unrelated to current task, document them in `fix_plan.md` but don't fix them this iteration.

105. If stuck for multiple attempts, document the blocker in `docs/agents/learnings.md` Learnings section and move on.
