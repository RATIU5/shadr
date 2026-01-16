#!/usr/bin/env bash
# Ralph Wiggum - Autonomous Development Loop
# ==========================================
# Usage:
#   .ralph/ralph.sh                      # Default: PROMPT.md, unlimited
#   .ralph/ralph.sh --max 20             # Limit to 20 iterations
#   .ralph/ralph.sh -p PROMPT_PLAN.md    # Use specific prompt
#   .ralph/ralph.sh --timeout 30         # 30 min timeout per iteration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Defaults
PROMPT_FILE="${SCRIPT_DIR}/PROMPT.md"
MAX_ITERATIONS=0  # 0 = unlimited
TIMEOUT_MINS=60   # 60 min default timeout
MAX_NO_CHANGE=3   # Stop after N iterations with no git changes

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--prompt) PROMPT_FILE="$2"; shift 2 ;;
        --max) MAX_ITERATIONS="$2"; shift 2 ;;
        --timeout) TIMEOUT_MINS="$2"; shift 2 ;;
        --no-change) MAX_NO_CHANGE="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "  -p, --prompt FILE    Prompt file (default: PROMPT.md)"
            echo "  --max N              Max iterations, 0=unlimited (default: 0)"
            echo "  --timeout N          Timeout per iteration in minutes (default: 60)"
            echo "  --no-change N        Stop after N iterations with no changes (default: 3)"
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Resolve prompt path
[[ ! -f "${PROMPT_FILE}" ]] && PROMPT_FILE="${SCRIPT_DIR}/${PROMPT_FILE}"
[[ ! -f "${PROMPT_FILE}" ]] && { echo "Error: Prompt not found: ${PROMPT_FILE}"; exit 1; }

cd "${PROJECT_ROOT}"

# State
iteration=0
no_change_count=0
last_git_hash=""
session_id=""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   RALPH WIGGUM LOOP                        ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Prompt: $(basename ${PROMPT_FILE})"
echo "║  Max iterations: ${MAX_ITERATIONS:-unlimited}"
echo "║  Timeout: ${TIMEOUT_MINS}m per iteration"
echo "║  Stagnation: ${MAX_NO_CHANGE} iterations"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Press Ctrl+C to stop                                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get current git state hash (more reliable than porcelain)
get_git_hash() {
    (git rev-parse HEAD 2>/dev/null; git diff 2>/dev/null; git diff --staged 2>/dev/null) | md5sum | cut -d' ' -f1
}

last_git_hash=$(get_git_hash)

while true; do
    iteration=$((iteration + 1))

    # Check max iterations
    if [[ ${MAX_ITERATIONS} -gt 0 && ${iteration} -gt ${MAX_ITERATIONS} ]]; then
        echo ""
        echo "Reached max iterations (${MAX_ITERATIONS})"
        break
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ITERATION ${iteration}  |  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Build claude command with session continuation
    CLAUDE_CMD="claude --dangerously-skip-permissions"
    if [[ -n "${session_id}" ]]; then
        CLAUDE_CMD="${CLAUDE_CMD} --continue --session-id ${session_id}"
    fi

    # Run with timeout
    start_time=$(date +%s)
    if timeout $((TIMEOUT_MINS * 60)) bash -c "cat '${PROMPT_FILE}' | ${CLAUDE_CMD}"; then
        : # Success
    else
        exit_code=$?
        if [[ ${exit_code} -eq 124 ]]; then
            echo "[!] Iteration timed out after ${TIMEOUT_MINS} minutes"
        fi
    fi
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "[i] Iteration completed in ${duration}s"

    # Check for stagnation (no git changes)
    current_git_hash=$(get_git_hash)
    if [[ "${current_git_hash}" == "${last_git_hash}" ]]; then
        no_change_count=$((no_change_count + 1))
        echo "[!] No git changes detected (${no_change_count}/${MAX_NO_CHANGE})"
        if [[ ${no_change_count} -ge ${MAX_NO_CHANGE} ]]; then
            echo ""
            echo "Stopping: No progress for ${MAX_NO_CHANGE} consecutive iterations"
            echo "Check fix_plan.md and AGENT.md for issues"
            break
        fi
    else
        no_change_count=0
        last_git_hash="${current_git_hash}"
    fi

    # Check for completion (all tasks done in fix_plan.md)
    if [[ -f fix_plan.md ]]; then
        pending=$(grep -cE '^\s*-\s*\[ \]' fix_plan.md 2>/dev/null || echo "0")
        completed=$(grep -cE '^\s*-\s*\[x\]' fix_plan.md 2>/dev/null || echo "0")

        if [[ ${pending} -eq 0 && ${completed} -gt 0 ]]; then
            echo ""
            echo "╔════════════════════════════════════════════════════════════╗"
            echo "║  ALL TASKS COMPLETE!                                       ║"
            echo "╚════════════════════════════════════════════════════════════╝"
            break
        fi
        echo "[i] Tasks: ${completed} done, ${pending} remaining"
    fi

    # Brief pause
    sleep 2
done

echo ""
echo "Ralph finished after ${iteration} iterations"
echo "Review: git log --oneline -10"
