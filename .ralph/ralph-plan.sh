#!/usr/bin/env bash
# Ralph Wiggum - Planning Loop
# =============================
# Runs a single planning iteration to analyze the codebase
# and generate/update the fix_plan.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/config.sh"
source "${SCRIPT_DIR}/utils/logging.sh"

cd "${PROJECT_ROOT}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              RALPH PLANNING MODE                              ║"
echo "║  Analyzing codebase and generating fix_plan.md                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

PROMPT_FILE="${SCRIPT_DIR}/PROMPT_PLAN.md"

if [[ ! -f "${PROMPT_FILE}" ]]; then
    echo "Error: Planning prompt not found: ${PROMPT_FILE}"
    exit 1
fi

log_info "Starting planning iteration..."

# Run a single planning iteration
cat "${PROMPT_FILE}" | ${CLAUDE_CODE} --dangerously-skip-permissions

log_info "Planning complete. Check fix_plan.md for the updated plan."

echo ""
echo "Next steps:"
echo "  1. Review the generated fix_plan.md"
echo "  2. Edit specs/ if needed to clarify requirements"
echo "  3. Run .ralph/ralph.sh to start building"
