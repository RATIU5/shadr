#!/usr/bin/env bash
# Ralph Wiggum - Simple Development Loop
# Usage: .ralph/ralph.sh [prompt-file]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROMPT_FILE="${1:-${SCRIPT_DIR}/PROMPT.md}"
MAX_NO_CHANGE=3
no_change_count=0
last_git_status=""

cd "${PROJECT_ROOT}"

echo "╔═══════════════════════════════════════╗"
echo "║         RALPH WIGGUM LOOP             ║"
echo "╚═══════════════════════════════════════╝"
echo "Prompt: ${PROMPT_FILE}"
echo "Press Ctrl+C to stop"
echo ""

iteration=0
while true; do
    iteration=$((iteration + 1))
    echo "━━━ Iteration ${iteration} [$(date '+%H:%M:%S')] ━━━"

    # Run Claude with the prompt
    cat "${PROMPT_FILE}" | claude --dangerously-skip-permissions || true

    # Simple stagnation detection
    current_status=$(git status --porcelain 2>/dev/null || echo "")
    if [[ "${current_status}" == "${last_git_status}" ]]; then
        no_change_count=$((no_change_count + 1))
        echo "[!] No changes (${no_change_count}/${MAX_NO_CHANGE})"
        if [[ ${no_change_count} -ge ${MAX_NO_CHANGE} ]]; then
            echo "Stopping: No progress for ${MAX_NO_CHANGE} iterations"
            break
        fi
    else
        no_change_count=0
        last_git_status="${current_status}"
    fi

    # Check if all tasks done
    if [[ -f fix_plan.md ]] && ! grep -qE '^\s*-\s*\[ \]' fix_plan.md 2>/dev/null; then
        if grep -qE '^\s*-\s*\[x\]' fix_plan.md 2>/dev/null; then
            echo "All tasks complete!"
            break
        fi
    fi

    sleep 2
done

echo "Ralph finished after ${iteration} iterations"
