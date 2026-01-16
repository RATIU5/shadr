#!/usr/bin/env bash
# Circuit Breaker for Ralph Wiggum
# =================================
# Detects stagnation and prevents infinite wasteful loops

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../config.sh"

# State file locations
STATE_DIR="${SCRIPT_DIR}/../state"
CHANGE_COUNTER_FILE="${STATE_DIR}/change_counter"
ERROR_HISTORY_FILE="${STATE_DIR}/error_history"
CIRCUIT_STATE_FILE="${STATE_DIR}/circuit_state"

# Initialize state directory
init_circuit_breaker() {
    mkdir -p "${STATE_DIR}"
    echo "0" > "${CHANGE_COUNTER_FILE}"
    echo "" > "${ERROR_HISTORY_FILE}"
    echo "CLOSED" > "${CIRCUIT_STATE_FILE}"
}

# Get current circuit state
get_circuit_state() {
    if [[ -f "${CIRCUIT_STATE_FILE}" ]]; then
        cat "${CIRCUIT_STATE_FILE}"
    else
        echo "CLOSED"
    fi
}

# Check if circuit is open (should stop)
is_circuit_open() {
    [[ "$(get_circuit_state)" == "OPEN" ]]
}

# Record that files changed
record_change() {
    echo "0" > "${CHANGE_COUNTER_FILE}"
    log_debug "Circuit breaker: Changes detected, counter reset"
}

# Record no changes in this iteration
record_no_change() {
    local current
    current=$(cat "${CHANGE_COUNTER_FILE}" 2>/dev/null || echo "0")
    local new_count=$((current + 1))
    echo "${new_count}" > "${CHANGE_COUNTER_FILE}"

    log_debug "Circuit breaker: No changes detected, counter: ${new_count}/${NO_CHANGE_THRESHOLD}"

    if [[ ${new_count} -ge ${NO_CHANGE_THRESHOLD} ]]; then
        open_circuit "No file changes for ${NO_CHANGE_THRESHOLD} consecutive iterations"
    fi
}

# Record an error
record_error() {
    local error_hash="$1"

    # Keep last 10 errors
    local errors
    errors=$(tail -n 9 "${ERROR_HISTORY_FILE}" 2>/dev/null || echo "")
    echo -e "${errors}\n${error_hash}" | grep -v '^$' > "${ERROR_HISTORY_FILE}"

    # Check for identical consecutive errors
    local consecutive
    consecutive=$(tail -n "${IDENTICAL_ERROR_THRESHOLD}" "${ERROR_HISTORY_FILE}" | sort -u | wc -l)

    if [[ ${consecutive} -eq 1 ]] && [[ $(wc -l < "${ERROR_HISTORY_FILE}") -ge ${IDENTICAL_ERROR_THRESHOLD} ]]; then
        open_circuit "Same error repeated ${IDENTICAL_ERROR_THRESHOLD} times"
    fi
}

# Open the circuit (stop the loop)
open_circuit() {
    local reason="$1"
    echo "OPEN" > "${CIRCUIT_STATE_FILE}"
    log_warn "Circuit breaker OPEN: ${reason}"
    echo ""
    echo "=========================================="
    echo "CIRCUIT BREAKER TRIGGERED"
    echo "=========================================="
    echo "Reason: ${reason}"
    echo ""
    echo "Options:"
    echo "  1. Review the logs and fix_plan.md"
    echo "  2. Reset with: .ralph/utils/circuit_breaker.sh reset"
    echo "  3. Check git status for changes"
    echo "=========================================="
}

# Reset the circuit breaker
reset_circuit() {
    init_circuit_breaker
    log_info "Circuit breaker reset to CLOSED state"
}

# Check for file changes since last check
check_for_changes() {
    local last_check_file="${STATE_DIR}/last_git_status"
    local current_status
    current_status=$(git status --porcelain 2>/dev/null || echo "")

    if [[ -f "${last_check_file}" ]]; then
        local last_status
        last_status=$(cat "${last_check_file}")

        if [[ "${current_status}" != "${last_status}" ]]; then
            record_change
            echo "${current_status}" > "${last_check_file}"
            return 0
        else
            record_no_change
            return 1
        fi
    else
        echo "${current_status}" > "${last_check_file}"
        record_change
        return 0
    fi
}

# Logging helpers
log_debug() {
    [[ "${LOG_LEVEL}" == "DEBUG" ]] && echo "[DEBUG] $1" >&2
}

log_info() {
    [[ "${LOG_LEVEL}" =~ ^(DEBUG|INFO)$ ]] && echo "[INFO] $1" >&2
}

log_warn() {
    [[ "${LOG_LEVEL}" =~ ^(DEBUG|INFO|WARN)$ ]] && echo "[WARN] $1" >&2
}

# CLI interface
case "${1:-}" in
    init)
        init_circuit_breaker
        ;;
    reset)
        reset_circuit
        ;;
    state)
        get_circuit_state
        ;;
    check)
        if is_circuit_open; then
            echo "OPEN"
            exit 1
        else
            echo "CLOSED"
            exit 0
        fi
        ;;
    changes)
        check_for_changes
        ;;
    *)
        echo "Usage: $0 {init|reset|state|check|changes}"
        exit 1
        ;;
esac
