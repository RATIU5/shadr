#!/usr/bin/env bash
# Ralph Wiggum - Infrastructure Loop
# ====================================
# Focused loop for build tooling and CI/CD improvements

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/config.sh"

cd "${PROJECT_ROOT}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              RALPH INFRASTRUCTURE MODE                        ║"
echo "║  Focus: Build tooling, CI/CD, deployment                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Use infrastructure-focused prompt
exec "${SCRIPT_DIR}/ralph.sh" -p "${SCRIPT_DIR}/PROMPT_INFRA.md" "$@"
