# Ralph Wiggum Setup

Autonomous AI development loops for the shadr project.

## Quick Start

```bash
# 1. Plan - analyze codebase, generate tasks
.ralph/ralph-plan.sh

# 2. Review fix_plan.md

# 3. Build - run development loop
.ralph/ralph.sh --max 20    # Recommended: set iteration limit
```

## How It Works

```
while true; do
    cat PROMPT.md | claude --dangerously-skip-permissions
done
```

Each iteration:
1. Reads prompt + project files
2. Picks ONE task from `fix_plan.md`
3. Searches codebase before changing (critical!)
4. Implements the task
5. Runs validation
6. Updates docs and commits
7. Loop continues

Progress persists in **files and git**, not LLM context.

## Scripts

| Script | Purpose |
|--------|---------|
| `ralph.sh` | Main development loop |
| `ralph-plan.sh` | One-shot planning analysis |

### ralph.sh Options

```bash
.ralph/ralph.sh [options]

  -p, --prompt FILE    Prompt file (default: PROMPT.md)
  --max N              Max iterations (default: unlimited)
  --timeout N          Timeout per iteration in minutes (default: 60)
  --no-change N        Stop after N iterations with no changes (default: 3)
```

## Key Files

| File | Purpose |
|------|---------|
| `AGENT.md` | Build/run commands + learnings + guardrails |
| `fix_plan.md` | Prioritized task list |
| `specs/architecture.md` | Project structure (update on major changes!) |

## Best Practices

1. **Always set --max**: `.ralph/ralph.sh --max 20` prevents runaway loops

2. **One task per iteration**: Prompts enforce single-task focus

3. **Search before assuming**: Critical to avoid duplicate implementations

4. **Tune with guardrails**: When Ralph fails repeatedly, add "signs" to `AGENT.md`

5. **Keep docs updated**: Ralph updates `fix_plan.md`, `AGENT.md`, and `specs/architecture.md`

## When Things Go Wrong

**Stagnation (no changes)**:
- Check `fix_plan.md` - are tasks clear and actionable?
- Check `AGENT.md` Learnings - is there a blocker documented?
- Consider: `git reset --hard` and restart with clearer tasks

**Wrong implementation**:
- Add guardrail to `AGENT.md`
- Update specs if requirements unclear
- Re-run planning: `.ralph/ralph-plan.sh`

**Costs too high**:
- Use `--max` to limit iterations
- Use `--timeout` to limit time per iteration
- Run planning separately to validate tasks before building

## Resources

- [Geoffrey Huntley's Guide](https://github.com/ghuntley/how-to-ralph-wiggum)
- [Official Plugin](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum)
- [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code)
