# Ralph Wiggum Planning Prompt - Shadr

Study the project to understand its current state:
- @AGENT.md for build/run instructions
- Read the source code in app/ and packages/
- Check existing tests (if any)
- Review package.json files for dependencies and scripts

## Your Task

Analyze the shadr project and create/update @fix_plan.md with a prioritized list of tasks.

## Analysis Steps

1. **Study the architecture**: Use up to 50 parallel subagents to understand:
   - How the app/ and packages/ are structured
   - What WebGPU functionality exists
   - What the editor is supposed to do

2. **Identify gaps**: Look for:
   - TODO comments in the code
   - Placeholder or minimal implementations
   - Missing error handling
   - Missing tests
   - Missing TypeScript types
   - Incomplete features

3. **Check build health**: Run:
   - `pnpm typecheck` - note any type errors
   - `pnpm check` - note any lint errors

4. **Review specifications**: Check @specs/* (if exists) for planned features that aren't implemented yet.

## Output

Create or update @fix_plan.md with:

```markdown
# Shadr Fix Plan

Last updated: [date]

## Critical (blocking issues)
- [ ] Item 1
- [ ] Item 2

## High Priority (important features)
- [ ] Item 1
- [ ] Item 2

## Medium Priority (improvements)
- [ ] Item 1
- [ ] Item 2

## Low Priority (nice to have)
- [ ] Item 1
- [ ] Item 2

## Completed
- [x] Item 1 (date)
```

Be specific about each item - include file paths and line numbers where relevant.

## Important

- Do NOT start implementing anything
- Focus only on analysis and planning
- Be thorough but realistic
- Prioritize based on:
  1. Build/type errors (must fix first)
  2. Core functionality
  3. Test coverage
  4. Code quality
