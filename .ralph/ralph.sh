#!/usr/bin/env bash
# Ralph Wiggum - Main Development Loop
# =====================================
# "Me fail English? That's unpossible!" - Ralph Wiggum
#
# This is the main autonomous development loop for the shadr project.
# It runs Claude Code in a continuous loop, building and iterating.
#
# Usage:
#   .ralph/ralph.sh                    # Use default PROMPT.md
#   .ralph/ralph.sh -p PROMPT_TEST.md  # Use specific prompt
#   .ralph/ralph.sh --max 10           # Limit to 10 iterations
#   .ralph/ralph.sh --verbose          # Verbose output

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load configuration
source "${SCRIPT_DIR}/config.sh"
source "${SCRIPT_DIR}/utils/logging.sh"

# Parse command line arguments
PROMPT_FILE="${DEFAULT_PROMPT}"
MAX_ITERS="${MAX_ITERATIONS}"
VERBOSE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--prompt)
            PROMPT_FILE="$2"
            shift 2
            ;;
        --max|--max-iterations)
            MAX_ITERS="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            LOG_LEVEL="DEBUG"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            echo "Ralph Wiggum - Autonomous Development Loop"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -p, --prompt FILE       Prompt file to use (default: PROMPT.md)"
            echo "  --max N                 Maximum iterations (0 = unlimited)"
            echo "  -v, --verbose           Enable verbose output"
            echo "  --dry-run               Show what would be done without running"
            echo "  -h, --help              Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Resolve prompt file path
if [[ ! -f "${PROMPT_FILE}" ]]; then
    if [[ -f "${SCRIPT_DIR}/${PROMPT_FILE}" ]]; then
        PROMPT_FILE="${SCRIPT_DIR}/${PROMPT_FILE}"
    elif [[ -f "${PROJECT_ROOT}/${PROMPT_FILE}" ]]; then
        PROMPT_FILE="${PROJECT_ROOT}/${PROMPT_FILE}"
    else
        echo "Error: Prompt file not found: ${PROMPT_FILE}"
        exit 1
    fi
fi

cd "${PROJECT_ROOT}"

# Initialize utilities
"${SCRIPT_DIR}/utils/circuit_breaker.sh" init
"${SCRIPT_DIR}/utils/exit_detection.sh" init

log_info "Ralph Wiggum starting..."
log_info "Project: ${PROJECT_NAME}"
log_info "Prompt: ${PROMPT_FILE}"
log_info "Max iterations: ${MAX_ITERS:-unlimited}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    RALPH WIGGUM LOOP                         ║"
echo "║  'The doctor said I wouldn't have so many nosebleeds if I    ║"
echo "║   kept my finger outta there.'                               ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Press Ctrl+C to stop the loop                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Main loop
iteration=0
while true; do
    iteration=$((iteration + 1))

    # Check max iterations
    if [[ ${MAX_ITERS} -gt 0 ]] && [[ ${iteration} -gt ${MAX_ITERS} ]]; then
        log_info "Maximum iterations (${MAX_ITERS}) reached"
        break
    fi

    # Check circuit breaker
    if [[ "${CIRCUIT_BREAKER_ENABLED}" == "true" ]]; then
        if ! "${SCRIPT_DIR}/utils/circuit_breaker.sh" check >/dev/null 2>&1; then
            log_warn "Circuit breaker is OPEN - stopping loop"
            break
        fi
    fi

    log_iteration_start "${iteration}" "${PROMPT_FILE}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ITERATION ${iteration}"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    start_time=$(date +%s)

    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "[DRY RUN] Would execute: cat ${PROMPT_FILE} | ${CLAUDE_CODE}"
        sleep 2
        output="[DRY RUN] Simulated output"
    else
        # Run Claude Code with the prompt
        output=$(cat "${PROMPT_FILE}" | ${CLAUDE_CODE} --dangerously-skip-permissions 2>&1) || true
    fi

    end_time=$(date +%s)
    duration=$((end_time - start_time))

    log_claude_output "${output}"

    # Check for file changes (circuit breaker)
    if [[ "${CIRCUIT_BREAKER_ENABLED}" == "true" ]]; then
        "${SCRIPT_DIR}/utils/circuit_breaker.sh" changes || true
    fi

    # Check for completion signals
    if [[ "${EXIT_DETECTION_ENABLED}" == "true" ]]; then
        if "${SCRIPT_DIR}/utils/exit_detection.sh" check-output "${output}"; then
            log_info "Completion signal detected - exiting gracefully"
            echo ""
            echo "╔══════════════════════════════════════════════════════════════╗"
            echo "║  RALPH COMPLETE - Task finished successfully!                 ║"
            echo "╚══════════════════════════════════════════════════════════════╝"
            break
        fi

        # Also check fix_plan.md
        if "${SCRIPT_DIR}/utils/exit_detection.sh" check-fix-plan "${PROJECT_ROOT}/fix_plan.md"; then
            log_info "All fix_plan.md items completed - exiting gracefully"
            break
        fi
    fi

    log_iteration_end "${iteration}" "${duration}" "OK"

    # Brief pause between iterations to avoid hammering
    sleep 2
done

log_info "Ralph Wiggum loop finished after ${iteration} iterations"
echo ""
echo "Ralph says: 'I'm helping!'"
