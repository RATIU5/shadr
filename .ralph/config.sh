#!/usr/bin/env bash
# Ralph Wiggum Configuration for Shadr
# =====================================

# Claude Code executable (adjust if using different path)
CLAUDE_CODE="claude"

# Default prompt file
DEFAULT_PROMPT="PROMPT.md"

# Maximum iterations (safety limit, 0 = unlimited)
MAX_ITERATIONS=0

# Timeout per Claude iteration in minutes (1-120)
ITERATION_TIMEOUT=30

# API rate limiting (calls per hour)
API_RATE_LIMIT=100

# Circuit breaker settings
CIRCUIT_BREAKER_ENABLED=true
# Consecutive loops with no file changes before circuit breaks
NO_CHANGE_THRESHOLD=3
# Consecutive identical errors before circuit breaks
IDENTICAL_ERROR_THRESHOLD=5

# Exit detection settings
EXIT_DETECTION_ENABLED=true
# Require explicit EXIT_SIGNAL in addition to completion indicators
REQUIRE_EXPLICIT_EXIT=true

# Logging
LOG_DIR=".ralph/logs"
LOG_LEVEL="INFO"  # DEBUG, INFO, WARN, ERROR

# Git integration
AUTO_COMMIT=true
AUTO_PUSH=false

# Session management
SESSION_FILE=".ralph_session"
SESSION_TIMEOUT_HOURS=24

# Subagent parallelism limits
MAX_PARALLEL_SUBAGENTS=50
MAX_BUILD_SUBAGENTS=1  # Only 1 subagent for build/test operations

# Project-specific settings for Shadr
PROJECT_NAME="shadr"
PROJECT_TYPE="typescript-pnpm-monorepo"
BUILD_COMMAND="pnpm typecheck && pnpm check"
TEST_COMMAND="pnpm typecheck"
DEV_COMMAND="pnpm dev:packages"
