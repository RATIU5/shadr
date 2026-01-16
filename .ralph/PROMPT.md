# Ralph Wiggum Development Prompt - Shadr

Study the project context files to understand the current state:
- @AGENT.md for build/run instructions
- @fix_plan.md for the current task list
- @specs/* for feature specifications (if they exist)

## Your Task

Your task is to implement features, fix bugs, and improve the shadr WebGPU editor project. Follow the @fix_plan.md and choose the most important item to work on.

Before making changes:
1. Search codebase using subagents (don't assume something is not implemented)
2. Understand the existing patterns in the codebase
3. Think hard about the best approach

## Guidelines

1. **One item per iteration**: Focus on completing ONE task from fix_plan.md. Do it well.

2. **Use parallel subagents**: You may use up to 50 parallel subagents for searching and reading. Use only 1 subagent for build/test operations.

3. **Verify your work**: After implementing functionality, run the relevant checks:
   - `pnpm typecheck` for type checking
   - `pnpm check` for linting

4. **Update documentation**: When you learn something new about how to build or test the project, update @AGENT.md using a subagent but keep it brief.

5. **Track progress**: Update @fix_plan.md with your findings:
   - Mark completed items with [x]
   - Add new issues you discover
   - Remove items that are no longer relevant

6. **Commit your work**: When tests pass, commit your changes:
   ```bash
   git add -A
   git commit -m "description of changes"
   git push
   ```

## Quality Standards

- Follow existing code patterns and conventions
- Use TypeScript strict mode - no `any` types
- Keep the Effect library patterns where used
- DO NOT implement placeholder or minimal implementations
- Ensure all types are properly defined

## Completion Signal

When you have completed the current task and there's nothing more to do:
- Update @fix_plan.md marking the item complete
- Ensure all changes are committed
- Output: EXIT_SIGNAL: true

If there are more tasks in fix_plan.md, continue to the next iteration.
