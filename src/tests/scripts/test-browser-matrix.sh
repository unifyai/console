#!/bin/bash
#
# Run browser matrix tests with file splitting and parallel sharding.
# Handles: generate chunk files → run sharded tests → cleanup generated files
#
# Usage:
#   ./test-browser-matrix.sh [SHARD_COUNT] [EXTRA_VITEST_ARGS...]
#   SHARDS=8 ./test-browser-matrix.sh
#
# Examples:
#   npm run test:browser:matrix         # Default shards, auto-cleanup
#   npm run test:browser:matrix 8       # 8 shards
#   PLOT_TEST_SAMPLE_RATE=10 npm run test:browser:matrix 4
#
# Environment variables:
#   SHARDS                - Number of parallel shards (default: CPU cores, max 8)
#   PLOT_TEST_SAMPLE_RATE - Percentage of matrix configs to run (1-100)
#   SKIP_CLEANUP          - Set to 'true' to keep generated files after run
#

set -e

# --- Configuration ---
# First arg can be shard count if it's a number
if [[ "$1" =~ ^[0-9]+$ ]]; then
  SHARD_COUNT=$1
  shift
else
  SHARD_COUNT=${SHARDS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}
fi

# Cap at 8 shards
SHARD_COUNT=$((SHARD_COUNT > 8 ? 8 : SHARD_COUNT))

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GENERATED_DIR="$PROJECT_ROOT/src/tests/plot/integration/generated"

# --- Header ---
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Browser Matrix Tests - Parallel Execution              ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Shards:      $SHARD_COUNT"
echo "║  Sample rate: ${PLOT_TEST_SAMPLE_RATE:-100}%"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# --- Step 1: Generate chunk files ---
echo "📦 Step 1: Generating chunk files..."
cd "$PROJECT_ROOT"
npm run test:browser:generate --silent 2>/dev/null || npm run test:browser:generate

CHUNK_COUNT=$(find "$GENERATED_DIR" -name "*.browser.test.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "   Generated $CHUNK_COUNT chunk files"
echo ""

# --- Cleanup function ---
cleanup() {
  if [ "$SKIP_CLEANUP" != "true" ]; then
    echo ""
    echo "🧹 Cleaning up generated files..."
    rm -rf "$GENERATED_DIR"
  else
    echo ""
    echo "⚠️  Skipping cleanup (SKIP_CLEANUP=true)"
    echo "   Generated files at: $GENERATED_DIR"
  fi
}

# --- Step 2: Run sharded tests ---
echo "🚀 Step 2: Running $SHARD_COUNT parallel shards..."
echo ""

LOG_DIR=$(mktemp -d)
PIDS=()
EXIT_CODE=0

for i in $(seq 1 "$SHARD_COUNT"); do
  LOG_FILE="$LOG_DIR/shard-$i.log"
  echo "   Starting shard $i/$SHARD_COUNT..."
  
  # Only run generated chunk files (in the generated/ directory)
  MATRIX_TEST_SPLIT=true npm run test:browser -- --run --shard=$i/$SHARD_COUNT \
    'src/tests/plot/integration/generated/' "$@" > "$LOG_FILE" 2>&1 &
  PIDS+=($!)
done

echo ""
echo "⏳ Waiting for all shards to complete..."
echo ""

# --- Step 3: Collect results ---
FAILED_SHARDS=()
TOTAL_PASSED=0
TOTAL_FAILED=0

for i in $(seq 1 "$SHARD_COUNT"); do
  PID_IDX=$((i - 1))
  PID=${PIDS[$PID_IDX]}
  LOG_FILE="$LOG_DIR/shard-$i.log"
  
  if wait $PID; then
    PASSED=$(grep -oE "Tests\s+[0-9]+ passed" "$LOG_FILE" | grep -oE "[0-9]+" | head -1 || echo "0")
    TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
    SUMMARY=$(grep -E "Tests.*passed" "$LOG_FILE" | tail -1 || echo "completed")
    echo "   ✅ Shard $i: $SUMMARY"
  else
    FAILED_SHARDS+=($i)
    FAILED=$(grep -oE "Tests\s+[0-9]+ failed" "$LOG_FILE" | grep -oE "[0-9]+" | head -1 || echo "?")
    TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
    SUMMARY=$(grep -E "Tests.*failed" "$LOG_FILE" | tail -1 || echo "failed")
    echo "   ❌ Shard $i: $SUMMARY"
    EXIT_CODE=1
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All $SHARD_COUNT shards passed! ($TOTAL_PASSED tests)"
  cleanup
else
  echo "❌ Failed shards: ${FAILED_SHARDS[*]}"
  echo ""
  echo "View logs:"
  for shard in "${FAILED_SHARDS[@]}"; do
    echo "  cat $LOG_DIR/shard-$shard.log"
  done
  echo ""
  echo "Note: Logs preserved at: $LOG_DIR"
  echo "      Run cleanup manually: rm -rf $GENERATED_DIR"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE

