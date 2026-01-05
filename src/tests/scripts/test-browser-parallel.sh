#!/bin/bash
#
# Run browser tests in parallel using Vitest sharding.
# Each shard runs in a separate process with its own browser instance.
#
# Usage:
#   ./src/tests/scripts/test-browser-parallel.sh [vitest-args...]
#   SHARDS=4 ./src/tests/scripts/test-browser-parallel.sh
#   SHARDS=8 ./src/tests/scripts/test-browser-parallel.sh src/tests/plot/integration/
#
# Examples:
#   # Run all browser tests with 4 parallel shards
#   npm run test:browser:parallel
#
#   # Run with 8 shards
#   SHARDS=8 npm run test:browser:parallel
#
#   # Run specific files with sharding
#   npm run test:browser:parallel -- src/tests/plot/integration/

set -e

# Number of parallel shards (default: number of CPU cores, max 8)
CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
SHARDS=${SHARDS:-$(( CPU_CORES > 8 ? 8 : CPU_CORES ))}

echo "🚀 Running browser tests with $SHARDS parallel shards..."
echo ""

# Array to track PIDs
PIDS=()
EXIT_CODE=0

# Create temp directory for logs
LOG_DIR=$(mktemp -d)
trap "rm -rf $LOG_DIR" EXIT

# Start all shards in parallel
for i in $(seq 1 $SHARDS); do
  LOG_FILE="$LOG_DIR/shard-$i.log"
  
  echo "  Starting shard $i/$SHARDS..."
  
  # Run vitest with this shard, passing through any extra arguments
  npm run test:browser -- --run --shard=$i/$SHARDS "$@" > "$LOG_FILE" 2>&1 &
  PIDS+=($!)
done

echo ""
echo "⏳ Waiting for all shards to complete..."
echo ""

# Wait for all shards and collect results
FAILED_SHARDS=()
for i in $(seq 1 $SHARDS); do
  PID_IDX=$((i - 1))
  PID=${PIDS[$PID_IDX]}
  LOG_FILE="$LOG_DIR/shard-$i.log"
  
  if wait $PID; then
    # Extract summary from log
    SUMMARY=$(grep -E "Tests.*passed" "$LOG_FILE" | tail -1 || echo "completed")
    echo "  ✅ Shard $i: $SUMMARY"
  else
    FAILED_SHARDS+=($i)
    SUMMARY=$(grep -E "Tests.*failed" "$LOG_FILE" | tail -1 || echo "failed")
    echo "  ❌ Shard $i: $SUMMARY"
    EXIT_CODE=1
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All $SHARDS shards passed!"
else
  echo "❌ Failed shards: ${FAILED_SHARDS[*]}"
  echo ""
  echo "View logs:"
  for shard in "${FAILED_SHARDS[@]}"; do
    echo "  tail -50 $LOG_DIR/shard-$shard.log"
  done
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE

