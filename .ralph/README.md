# Ralph Wiggum Setup

Autonomous AI development loops for the shadr project.

## Quick Start

```bash
# 1. Set your provider in config.sh (default: codex)
# Or use --provider flag

# 2. Plan - analyze codebase, generate tasks
.ralph/ralph-plan.sh

# 3. Review fix_plan.md

# 4. Build - run development loop
.ralph/ralph.sh --max 20
```

## AI Providers

Ralph supports switching between AI providers:

| Provider | CLI                                                      | Env Variable        |
| -------- | -------------------------------------------------------- | ------------------- |
| `codex`  | [OpenAI Codex](https://github.com/openai/codex)          | `OPENAI_API_KEY`    |
| `claude` | [Claude Code](https://github.com/anthropics/claude-code) | `ANTHROPIC_API_KEY` |

### Switch Provider

```bash
# Option 1: Edit config.sh (persistent)
# Set PROVIDER="codex" or PROVIDER="claude"

# Option 2: Command line (one-time)
.ralph/ralph.sh --provider claude --max 20
.ralph/ralph-plan.sh --provider codex
```

### Install CLIs

```bash
# OpenAI Codex
npm install -g @openai/codex

# Claude Code
npm install -g @anthropic-ai/claude-code
```

## How It Works

```
while true; do
    cat PROMPT.md | <provider-cli>
done
```

Each iteration:

1. Reads prompt + project files
2. Picks ONE task from `fix_plan.md`
3. Searches codebase before changing
4. Implements the task
5. Runs validation
6. Updates docs and commits
7. Loop continues

Progress persists in **files and git**, not LLM context.

## Scripts

| Script          | Purpose                               |
| --------------- | ------------------------------------- |
| `ralph.sh`      | Main development loop                 |
| `ralph-plan.sh` | One-shot planning analysis            |
| `config.sh`     | Default settings (provider, timeouts) |

### ralph.sh Options

```bash
.ralph/ralph.sh [options]

  --provider NAME    AI provider: claude, codex (default: from config.sh)
  -p, --prompt FILE  Prompt file (default: PROMPT.md)
  --max N            Max iterations (default: unlimited)
  --timeout N        Timeout per iteration in minutes (default: 60)
  --no-change N      Stop after N iterations with no changes (default: 3)
```

## Key Files

| File                    | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `AGENTS.md`             | Build/run commands + learnings + guardrails  |
| `fix_plan.md`           | Prioritized task list                        |
| `specs/architecture.md` | Project structure (update on major changes!) |

## Best Practices

1. **Always set --max**: `.ralph/ralph.sh --max 20` prevents runaway loops
2. **One task per iteration**: Prompts enforce single-task focus
3. **Search before assuming**: Critical to avoid duplicate implementations
4. **Tune with guardrails**: When Ralph fails repeatedly, add "signs" to `AGENTS.md`
5. **Keep docs updated**: Ralph updates `fix_plan.md`, `AGENTS.md`, and `specs/architecture.md`

## Resources

- [OpenAI Codex CLI](https://github.com/openai/codex)
- [Claude Code](https://github.com/anthropics/claude-code)
- [Geoffrey Huntley's Guide](https://github.com/ghuntley/how-to-ralph-wiggum)
