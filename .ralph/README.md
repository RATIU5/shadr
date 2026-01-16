# Ralph Wiggum Setup for Shadr

> "Me fail English? That's unpossible!" - Ralph Wiggum

This directory contains the Ralph Wiggum autonomous development setup for the shadr project.

## What is Ralph Wiggum?

Ralph Wiggum is a technique for running AI coding agents in continuous loops. Named after the Simpsons character, it embodies the philosophy of persistent iteration despite setbacks.

The core idea: **Run a while loop that feeds a prompt to Claude Code repeatedly.** Each iteration builds on the changes from the previous one, allowing the AI to make incremental progress on complex tasks.

## Quick Start

```bash
# 1. Run planning to analyze the codebase and generate fix_plan.md
.ralph/ralph-plan.sh

# 2. Review the generated fix_plan.md and specs/

# 3. Start the development loop
.ralph/ralph.sh
```

## Available Scripts

| Script | Purpose |
|--------|---------|
| `ralph.sh` | Main development loop - implements features from fix_plan.md |
| `ralph-plan.sh` | Planning mode - analyzes codebase, updates fix_plan.md |
| `ralph-test.sh` | Test focus - expands test coverage |
| `ralph-infra.sh` | Infrastructure - CI/CD, build tooling |

## Command Line Options

```bash
.ralph/ralph.sh [options]

Options:
  -p, --prompt FILE    Use a specific prompt file (default: PROMPT.md)
  --max N              Maximum iterations (0 = unlimited)
  -v, --verbose        Enable verbose logging
  --dry-run            Show what would happen without running
  -h, --help           Show help
```

## How It Works

1. **The Loop**: `while true; do cat PROMPT.md | claude-code; done`

2. **Context Reset**: Each iteration starts fresh (new context window), but the codebase retains all changes.

3. **Task Selection**: The prompt instructs Claude to pick the most important task from `fix_plan.md`.

4. **Back Pressure**: Build and type checks validate changes before committing.

5. **Exit Detection**: The loop stops when completion signals are detected or the circuit breaker trips.

## Key Files

### In Project Root

- **AGENT.md** - Build/run instructions for the AI agent
- **fix_plan.md** - Prioritized task list (the "TODO list" for Ralph)

### In .ralph/

- **PROMPT.md** - Main development prompt
- **PROMPT_PLAN.md** - Planning mode prompt
- **PROMPT_TEST.md** - Test-focused prompt
- **PROMPT_INFRA.md** - Infrastructure prompt
- **config.sh** - Configuration variables

### In specs/

- Feature specifications that guide implementation
- Architecture documentation

## Safety Features

### Circuit Breaker

Automatically stops the loop when:
- No file changes for 3 consecutive iterations (stagnation)
- Same error repeated 5 times
- Other signs of being stuck

Reset with: `.ralph/utils/circuit_breaker.sh reset`

### Exit Detection

Gracefully stops when:
- All items in fix_plan.md are completed
- Claude outputs completion signals (EXIT_SIGNAL: true)
- Explicit RALPH_COMPLETE marker

## Configuration

Edit `.ralph/config.sh` to customize:

```bash
# Maximum iterations (0 = unlimited)
MAX_ITERATIONS=0

# Circuit breaker thresholds
NO_CHANGE_THRESHOLD=3
IDENTICAL_ERROR_THRESHOLD=5

# Require explicit exit signal
REQUIRE_EXPLICIT_EXIT=true

# Logging level
LOG_LEVEL="INFO"  # DEBUG, INFO, WARN, ERROR
```

## Writing Effective Prompts

1. **One task per iteration** - Keep focus narrow
2. **Be specific** - Clear completion criteria
3. **Don't assume** - Tell Claude to verify before changing
4. **Use subagents** - Parallel search, single build/test
5. **Track progress** - Update fix_plan.md and AGENT.md

## Workflow

### Daily Development

```bash
# Morning: Plan and review
.ralph/ralph-plan.sh
# Review fix_plan.md, adjust priorities

# Development: Let Ralph work
.ralph/ralph.sh --max 10

# End of day: Review changes
git log --oneline -10
git diff HEAD~10
```

### New Feature

1. Write a spec in `specs/features/`
2. Add items to `fix_plan.md`
3. Run `.ralph/ralph.sh`
4. Review and iterate

### Debugging Stalls

```bash
# Check circuit breaker state
.ralph/utils/circuit_breaker.sh state

# Reset and retry
.ralph/utils/circuit_breaker.sh reset

# Check logs
cat .ralph/logs/ralph_$(date +%Y-%m-%d).log
```

## Tips

- **Trust eventual consistency** - Ralph may take wrong paths but will correct
- **Watch fix_plan.md** - It's your window into Ralph's progress
- **Tune the prompt** - When Ralph makes mistakes, add "signs" to the prompt
- **Delete and restart** - Sometimes it's faster to reset than rescue
- **Review changes** - Don't blindly accept; Ralph needs supervision

## GitHub Actions

The `.github/workflows/ralph.yml` workflow allows running Ralph in CI:

1. Set `ANTHROPIC_API_KEY` as a repository secret
2. Go to Actions > Ralph Wiggum > Run workflow
3. Select mode (plan/develop/test/infra)
4. Set max iterations

## Resources

- [Geoffrey Huntley's Ralph Article](https://ghuntley.com/ralph/)
- [Anthropic's Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

---

*"The doctor said I wouldn't have so many nosebleeds if I kept my finger outta there."* - Ralph Wiggum
