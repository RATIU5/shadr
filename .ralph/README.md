# Ralph Wiggum Setup

A simple autonomous development loop for AI-driven coding.

## Quick Start

```bash
# 1. Plan - analyze codebase and generate tasks
.ralph/ralph-plan.sh

# 2. Build - run the development loop
.ralph/ralph.sh
```

## How It Works

```bash
while true; do
    cat PROMPT.md | claude --dangerously-skip-permissions
done
```

Each iteration:
1. Reads the prompt
2. Picks a task from `fix_plan.md`
3. Implements it
4. Commits changes
5. Loop continues until done or stuck

## Files

| File | Purpose |
|------|---------|
| `ralph.sh` | Main loop (stops after 3 iterations with no changes) |
| `ralph-plan.sh` | One-shot planning to generate fix_plan.md |
| `PROMPT.md` | Development instructions |
| `PROMPT_PLAN.md` | Planning instructions |

## Project Files

| File | Purpose |
|------|---------|
| `AGENT.md` | Build/run instructions (update when commands change) |
| `fix_plan.md` | Task list (Ralph's TODO) |
| `specs/architecture.md` | Architecture docs (update on major changes) |

## Tips

- **Tune the prompt**: When Ralph makes mistakes, add guidance to PROMPT.md
- **Watch fix_plan.md**: It shows what Ralph is working on
- **Reset if stuck**: Sometimes `git reset --hard` and restart is faster than fixing
