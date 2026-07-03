#!/usr/bin/env bash
# Resolve sampled test grep pattern for push/PR tiers.
# Usage: SAMPLE_MODE=push|pr GITHUB_SHA=... bash scripts/ci-playwright-sample.sh <tier>
set -euo pipefail

TIER="${1:?Usage: ci-playwright-sample.sh <tier>}"
MODE="${SAMPLE_MODE:-}"

mapfile -t SPECS < <(bash scripts/ci-playwright-tiers.sh "$TIER")

if [ "${#SPECS[@]}" -eq 0 ]; then
  echo "No specs for tier: $TIER" >&2
  exit 1
fi

if [ -z "$MODE" ]; then
  # No sampling — pass through all specs
  printf '%s\n' "${SPECS[@]}"
  exit 0
fi

export SAMPLE_MODE="$MODE"
LIST=$(npx tsx scripts/ci-playwright-list-tests.ts "${SPECS[@]}")

if [ -z "$LIST" ]; then
  echo "No tests selected after sampling for $TIER ($MODE)" >&2
  exit 1
fi

# Build a single --grep regex from selected test titles
mapfile -t TITLES < <(echo "$LIST" | cut -d'|' -f2 | sort -u)
GREP_PARTS=()
for title in "${TITLES[@]}"; do
  clean=$(echo "$title" | sed -E 's/@push//g; s/@critical//g; s/@area\([^)]*\)//g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [ -n "$clean" ]; then
    esc=$(printf '%s' "$clean" | sed 's/[][\\^$.*+?{}|()]/\\&/g')
    GREP_PARTS+=("$esc")
  fi
done

if [ "${#GREP_PARTS[@]}" -eq 0 ]; then
  printf '%s\n' "${SPECS[@]}"
  exit 0
fi

IFS='|'
echo "${GREP_PARTS[*]}"
