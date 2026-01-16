#!/usr/bin/env bash
# Ralph Planning - Single iteration to analyze and generate fix_plan.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load config
[[ -f "${SCRIPT_DIR}/config.sh" ]] && source "${SCRIPT_DIR}/config.sh"
PROVIDER="${PROVIDER:-claude}"

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --provider) PROVIDER="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--provider claude|codex]"
            exit 0 ;;
        *) shift ;;
    esac
done

cd "${PROJECT_ROOT}"

# Build command
case "${PROVIDER}" in
    claude) AI_CMD="claude --dangerously-skip-permissions" ;;
    codex)  AI_CMD="codex --full-auto" ;;
    *) echo "Unknown provider: ${PROVIDER}"; exit 1 ;;
esac

echo "Running planning analysis with ${PROVIDER}..."
cat "${SCRIPT_DIR}/PROMPT_PLAN.md" | ${AI_CMD}
echo ""
echo "Done. Review fix_plan.md then run: .ralph/ralph.sh"
