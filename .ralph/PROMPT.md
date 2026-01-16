# Shadr Development Task

Read these files first:
- `AGENT.md` - Build/run instructions
- `fix_plan.md` - Task list
- `specs/architecture.md` - Current architecture

## Task

1. Pick ONE uncompleted item from `fix_plan.md`
2. Search codebase before changing (don't assume)
3. Implement the change
4. Run `pnpm typecheck && pnpm check`
5. Update `fix_plan.md` (mark done or add discoveries)
6. Commit: `git add -A && git commit -m "message" && git push`

## Architecture Updates

**When you make major changes** (new packages, new patterns, structural changes):
- Update `specs/architecture.md` to document the change
- Update `AGENT.md` if commands change

## Rules

- One task per iteration
- No placeholder implementations
- TypeScript strict - no `any`
- Follow existing patterns
