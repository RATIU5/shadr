#!/usr/bin/env bash
# Exit Detection for Ralph Wiggum
# ================================
# Detects when Claude has completed its task and should exit gracefully

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../config.sh"

STATE_DIR="${SCRIPT_DIR}/../state"
COMPLETION_INDICATORS_FILE="${STATE_DIR}/completion_indicators"

# Initialize exit detection state
init_exit_detection() {
    mkdir -p "${STATE_DIR}"
    echo "0" > "${COMPLETION_INDICATORS_FILE}"
}

# Patterns that indicate task completion
COMPLETION_PATTERNS=(
    "all tasks.*completed"
    "implementation.*complete"
    "nothing.*left.*to.*do"
    "fix_plan.*empty"
    "all.*items.*resolved"
    "EXIT_SIGNAL.*true"
    "RALPH_COMPLETE"
    "DONE"
    "COMPLETE"
)

# Check Claude's output for completion signals
check_completion() {
    local output="$1"
    local indicators=0
    local explicit_exit=false

    # Convert to lowercase for matching
    local lower_output
    lower_output=$(echo "${output}" | tr '[:upper:]' '[:lower:]')

    for pattern in "${COMPLETION_PATTERNS[@]}"; do
        if echo "${lower_output}" | grep -qiE "${pattern}"; then
            indicators=$((indicators + 1))

            # Check for explicit exit signal
            if [[ "${pattern}" == "EXIT_SIGNAL.*true" ]] || \
               [[ "${pattern}" == "RALPH_COMPLETE" ]]; then
                explicit_exit=true
            fi
        fi
    done

    echo "${indicators}" > "${COMPLETION_INDICATORS_FILE}"

    # Dual-condition gate: require both indicators AND explicit signal
    if [[ "${REQUIRE_EXPLICIT_EXIT}" == "true" ]]; then
        if [[ ${indicators} -ge 2 ]] && [[ "${explicit_exit}" == "true" ]]; then
            return 0  # Should exit
        fi
    else
        if [[ ${indicators} -ge 2 ]]; then
            return 0  # Should exit
        fi
    fi

    return 1  # Should continue
}

# Check if fix_plan.md indicates completion
check_fix_plan_complete() {
    local fix_plan="${1:-fix_plan.md}"

    if [[ ! -f "${fix_plan}" ]]; then
        return 1  # No fix_plan, continue
    fi

    # Check if all items are marked complete or file is empty/minimal
    local pending_items
    pending_items=$(grep -cE '^\s*-\s*\[[ ]\]' "${fix_plan}" 2>/dev/null || echo "0")

    if [[ ${pending_items} -eq 0 ]]; then
        # Check if there are any completed items (meaning work was done)
        local completed_items
        completed_items=$(grep -cE '^\s*-\s*\[[xX]\]' "${fix_plan}" 2>/dev/null || echo "0")

        if [[ ${completed_items} -gt 0 ]]; then
            return 0  # All items completed
        fi
    fi

    return 1  # Still has pending items
}

# Get count of completion indicators detected
get_indicator_count() {
    cat "${COMPLETION_INDICATORS_FILE}" 2>/dev/null || echo "0"
}

# CLI interface
case "${1:-}" in
    init)
        init_exit_detection
        ;;
    check-output)
        shift
        check_completion "$@"
        ;;
    check-fix-plan)
        shift
        check_fix_plan_complete "${1:-fix_plan.md}"
        ;;
    indicators)
        get_indicator_count
        ;;
    *)
        echo "Usage: $0 {init|check-output <output>|check-fix-plan [file]|indicators}"
        exit 1
        ;;
esac
