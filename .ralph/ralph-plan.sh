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

PROMPT_FILE="${SCRIPT_DIR}/PROMPT_PLAN.md"

echo "Running planning analysis with ${PROVIDER}..."

case "${PROVIDER}" in
    claude)
        cat "${PROMPT_FILE}" | claude --dangerously-skip-permissions
        ;;
    codex)
        codex exec --full-auto "$(cat "${PROMPT_FILE}")"
        ;;
    *)
        echo "Unknown provider: ${PROVIDER}"
        exit 1
        ;;
esac

echo ""
echo "Done. Review fix_plan.md then run: .ralph/ralph.sh"
