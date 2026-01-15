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
#   SHARD_OFFSET          - Instance number (1 or 2) for multi-instance runs
#                           Instance 1 runs first half of global shards
#                           Instance 2 runs second half of global shards
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

# Multi-instance support: SHARD_OFFSET specifies which instance (1 or 2)
# Instance 1: runs shards 1-N of 2N (first half)
# Instance 2: runs shards N+1-2N of 2N (second half)
SHARD_OFFSET=${SHARD_OFFSET:-0}
if [ "$SHARD_OFFSET" -gt 0 ]; then
  TOTAL_SHARDS=$((SHARD_COUNT * 2))
  if [ "$SHARD_OFFSET" -eq 1 ]; then
    SHARD_START=1
  else
    SHARD_START=$((SHARD_COUNT + 1))
  fi
  INSTANCE_INFO=" (instance $SHARD_OFFSET/2, global shards $SHARD_START-$((SHARD_START + SHARD_COUNT - 1)) of $TOTAL_SHARDS)"
else
  TOTAL_SHARDS=$SHARD_COUNT
  SHARD_START=1
  INSTANCE_INFO=""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GENERATED_DIR="$PROJECT_ROOT/src/tests/plot/integration/generated"

# --- Header ---
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Browser Matrix Tests - Parallel Execution              ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Shards:      $SHARD_COUNT$INSTANCE_INFO"
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
  # Calculate global shard number when using multi-instance mode
  GLOBAL_SHARD=$((SHARD_START + i - 1))
  LOG_FILE="$LOG_DIR/shard-$GLOBAL_SHARD.log"
  
  if [ "$SHARD_OFFSET" -gt 0 ]; then
    echo "   Starting shard $GLOBAL_SHARD/$TOTAL_SHARDS (local $i/$SHARD_COUNT)..."
  else
    echo "   Starting shard $i/$SHARD_COUNT..."
  fi
  
  # Only run generated chunk files (in the generated/ directory)
  # Use global shard/total for vitest sharding
  MATRIX_TEST_SPLIT=true npm run test:browser -- --run --shard=$GLOBAL_SHARD/$TOTAL_SHARDS \
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
  GLOBAL_SHARD=$((SHARD_START + i - 1))
  LOG_FILE="$LOG_DIR/shard-$GLOBAL_SHARD.log"
  
  SHARD_EXIT_CODE=0
  wait $PID || SHARD_EXIT_CODE=$?
  
  if [ $SHARD_EXIT_CODE -eq 0 ]; then
    PASSED=$(grep -oE "Tests\s+[0-9]+ passed" "$LOG_FILE" | grep -oE "[0-9]+" | head -1 || echo "0")
    TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
    SUMMARY=$(grep -E "Tests.*passed" "$LOG_FILE" | tail -1 || echo "completed")
    echo "   ✅ Shard $GLOBAL_SHARD: $SUMMARY"
  else
    FAILED_SHARDS+=($GLOBAL_SHARD)
    EXIT_CODE=1
    
    # Check if log file is empty or missing
    if [ ! -s "$LOG_FILE" ]; then
      echo "   ❌ Shard $GLOBAL_SHARD: CRASHED (exit code $SHARD_EXIT_CODE, no output - possible OOM)"
    else
      FAILED=$(grep -oE "Tests\s+[0-9]+ failed" "$LOG_FILE" | grep -oE "[0-9]+" | head -1 || echo "?")
      TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
      SUMMARY=$(grep -E "Tests.*failed" "$LOG_FILE" | tail -1 || echo "failed (exit code $SHARD_EXIT_CODE)")
      echo "   ❌ Shard $GLOBAL_SHARD: $SUMMARY"
    fi
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
  
  # Print error details for each failed shard
  for shard in "${FAILED_SHARDS[@]}"; do
    SHARD_LOG="$LOG_DIR/shard-$shard.log"
    echo "┌─────────────────────────────────────────────────"
    echo "│ Shard $shard error details:"
    echo "└─────────────────────────────────────────────────"
    if [ ! -s "$SHARD_LOG" ]; then
      echo "  (log file empty - process likely killed by OOM or signal)"
      echo ""
      # Try to show any dmesg OOM messages if available
      if command -v dmesg &> /dev/null && [ -r /dev/kmsg ]; then
        echo "  Recent OOM events (if any):"
        dmesg 2>/dev/null | grep -i "oom\|killed process" | tail -5 || echo "  (none found or no permission)"
      fi
    else
      # Show last 50 lines of the log
      echo "  Last 50 lines of log:"
      tail -50 "$SHARD_LOG" | sed 's/^/  /'
    fi
    echo ""
  done
  
  echo "View full logs:"
  for shard in "${FAILED_SHARDS[@]}"; do
    echo "  cat $LOG_DIR/shard-$shard.log"
  done
  echo ""
  echo "Note: Logs preserved at: $LOG_DIR"
  echo "      Run cleanup manually: rm -rf $GENERATED_DIR"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE

