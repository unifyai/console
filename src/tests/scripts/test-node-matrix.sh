#!/bin/bash
#
# Run Node.js matrix tests in parallel across multiple shards.
#
# Usage:
#   ./test-node-parallel.sh [SHARD_COUNT] [TEST_PATH]
#   SHARDS=8 ./test-node-parallel.sh [TEST_PATH]
#
# Examples:
#   ./test-node-parallel.sh 8                                      # 8 shards, matrix tests
#   ./test-node-parallel.sh 4 src/tests/plot/api/                  # 4 shards, specific path
#   SHARDS=8 ./test-node-parallel.sh                               # 8 shards via env var
#   PLOT_TEST_SAMPLE_RATE=100 ./test-node-parallel.sh 8            # With sampling
#
# Environment variables:
#   SHARDS                - Number of parallel shards (default: 4)
#   PLOT_TEST_SAMPLE_RATE - Percentage of matrix configs to run (1-100)
#   PLOT_TEST_API_REAL    - Use real API instead of mocks (true/false)
#
# Note: This script targets *.matrix.node.test.ts files by default.
# Only matrix tests support sharding - regular tests run in a single process.
#

set -e

# Determine shard count and test path from arguments
SHARD_COUNT=""
TEST_PATH=""

# Parse arguments - check if first arg is a number or a path
if [[ -n "$1" ]]; then
  if [[ "$1" =~ ^[0-9]+$ ]]; then
    # First arg is a number = shard count
    SHARD_COUNT="$1"
    TEST_PATH="${2:-}"
  else
    # First arg is a path
    TEST_PATH="$1"
  fi
fi

# Apply defaults
SHARD_COUNT="${SHARD_COUNT:-${SHARDS:-4}}"
# Default to matrix tests only - use glob pattern for *.matrix.node.test.ts files
TEST_PATH="${TEST_PATH:-src/tests/**/*.matrix.node.test.ts}"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           Node Matrix Tests - Parallel Execution               ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Shards:      $SHARD_COUNT"
echo "║  Test path:   $TEST_PATH"
echo "║  Sample rate: ${PLOT_TEST_SAMPLE_RATE:-100}%"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Create temp directory for logs
LOG_DIR=$(mktemp -d)
echo "Logs: $LOG_DIR"
echo ""

# Track PIDs and start time
PIDS=()
START_TIME=$(date +%s)

# Launch all shards in parallel
for i in $(seq 1 "$SHARD_COUNT"); do
  echo "Starting shard $i/$SHARD_COUNT..."
  MATRIX_SHARD="$i/$SHARD_COUNT" npm run test:node -- --run "$TEST_PATH" \
    > "$LOG_DIR/shard-$i.log" 2>&1 &
  PIDS+=($!)
done

echo ""
echo "All $SHARD_COUNT shards launched. Waiting for completion..."
echo ""

# Wait for all shards and track failures
FAILED_SHARDS=()
for i in $(seq 1 "$SHARD_COUNT"); do
  PID_INDEX=$((i - 1))
  if ! wait "${PIDS[$PID_INDEX]}"; then
    FAILED_SHARDS+=("$i")
  fi
done

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "                         RESULTS"
echo "════════════════════════════════════════════════════════════════"

# Show summary for each shard
TOTAL_TESTS=0
TOTAL_PASSED=0
for i in $(seq 1 "$SHARD_COUNT"); do
  LOG_FILE="$LOG_DIR/shard-$i.log"
  
  # Extract test counts from log
  TESTS_LINE=$(grep -E "Tests\s+[0-9]+ passed" "$LOG_FILE" 2>/dev/null | tail -1 || echo "")
  if [[ -n "$TESTS_LINE" ]]; then
    PASSED=$(echo "$TESTS_LINE" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")
    TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
    TOTAL_TESTS=$((TOTAL_TESTS + PASSED))
    
    # Check if this shard failed
    if [[ " ${FAILED_SHARDS[*]} " =~ " $i " ]]; then
      echo "  Shard $i: ❌ FAILED ($PASSED tests ran before failure)"
    else
      echo "  Shard $i: ✅ $PASSED tests passed"
    fi
  else
    echo "  Shard $i: ❌ No test output found"
    FAILED_SHARDS+=("$i")
  fi
done

echo ""
echo "────────────────────────────────────────────────────────────────"
echo "  Total tests:  $TOTAL_TESTS"
echo "  Duration:     ${DURATION}s"
echo "────────────────────────────────────────────────────────────────"

# Report final status
if [[ ${#FAILED_SHARDS[@]} -gt 0 ]]; then
  echo ""
  echo "❌ FAILED: Shards ${FAILED_SHARDS[*]} had failures"
  echo ""
  echo "View failed shard logs:"
  for shard in "${FAILED_SHARDS[@]}"; do
    echo "  cat $LOG_DIR/shard-$shard.log"
  done
  exit 1
else
  echo ""
  echo "✅ ALL SHARDS PASSED"
  # Clean up logs on success
  rm -rf "$LOG_DIR"
  exit 0
fi

