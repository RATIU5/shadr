#!/usr/bin/env bash
# Logging Utilities for Ralph Wiggum
# ===================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../config.sh"

# Ensure log directory exists
mkdir -p "${LOG_DIR}"

# Get timestamp
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Get log file for today
get_log_file() {
    local date_str
    date_str=$(date '+%Y-%m-%d')
    echo "${LOG_DIR}/ralph_${date_str}.log"
}

# Log message to file and optionally stdout
log() {
    local level="$1"
    shift
    local message="$*"
    local log_file
    log_file=$(get_log_file)

    local entry="[$(timestamp)] [${level}] ${message}"
    echo "${entry}" >> "${log_file}"

    # Also output to stderr based on log level
    case "${LOG_LEVEL}" in
        DEBUG)
            echo "${entry}" >&2
            ;;
        INFO)
            [[ "${level}" != "DEBUG" ]] && echo "${entry}" >&2
            ;;
        WARN)
            [[ "${level}" =~ ^(WARN|ERROR)$ ]] && echo "${entry}" >&2
            ;;
        ERROR)
            [[ "${level}" == "ERROR" ]] && echo "${entry}" >&2
            ;;
    esac
}

log_debug() { log "DEBUG" "$@"; }
log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }

# Log iteration start
log_iteration_start() {
    local iteration="$1"
    local prompt_file="$2"
    log_info "========== ITERATION ${iteration} START =========="
    log_info "Prompt file: ${prompt_file}"
}

# Log iteration end
log_iteration_end() {
    local iteration="$1"
    local duration="$2"
    local status="$3"
    log_info "Iteration ${iteration} completed in ${duration}s with status: ${status}"
    log_info "========== ITERATION ${iteration} END ============"
}

# Log Claude output (truncated for logs)
log_claude_output() {
    local output="$1"
    local max_lines=50
    local line_count
    line_count=$(echo "${output}" | wc -l)

    if [[ ${line_count} -gt ${max_lines} ]]; then
        log_debug "Claude output (${line_count} lines, showing first ${max_lines}):"
        echo "${output}" | head -n ${max_lines} >> "$(get_log_file)"
        log_debug "... (${line_count} total lines)"
    else
        log_debug "Claude output:"
        echo "${output}" >> "$(get_log_file)"
    fi
}

# CLI interface
case "${1:-}" in
    debug|info|warn|error)
        level="${1^^}"
        shift
        log "${level}" "$@"
        ;;
    *)
        # Source mode - just export functions
        :
        ;;
esac
