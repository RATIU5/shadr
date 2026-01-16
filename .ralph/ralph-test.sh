#!/usr/bin/env bash
# Ralph Wiggum - Test Focus Loop
# ===============================
# Focused loop for expanding test coverage

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/config.sh"

cd "${PROJECT_ROOT}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              RALPH TEST MODE                                  ║"
echo "║  Focus: Expanding test coverage                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Use test-focused prompt
exec "${SCRIPT_DIR}/ralph.sh" -p "${SCRIPT_DIR}/PROMPT_TEST.md" "$@"
