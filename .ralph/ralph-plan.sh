#!/usr/bin/env bash
# Ralph Planning - Single iteration to analyze and generate fix_plan.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

echo "Running planning analysis..."
cat "${SCRIPT_DIR}/PROMPT_PLAN.md" | claude --dangerously-skip-permissions
echo ""
echo "Done. Review fix_plan.md then run: .ralph/ralph.sh"
