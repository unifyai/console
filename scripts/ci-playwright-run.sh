#!/usr/bin/env bash
# Run a Playwright tier resolved by scripts/ci-playwright-tiers.sh.
# Optional: second arg shard e.g. 1/3; env SAMPLE_MODE=push|pr for random sampling.
set -euo pipefail

TIER="${1:?Usage: ci-playwright-run.sh <tier> [shard e.g. 1/3]}"
SHARD="${2:-}"
SAMPLE_MODE="${SAMPLE_MODE:-}"

MAX_FAILURES="${MAX_FAILURES:-20}"

mapfile -t SPECS < <(bash scripts/ci-playwright-tiers.sh "$TIER" "$SHARD")

if [ "${#SPECS[@]}" -eq 0 ]; then
  echo "No specs registered for tier: $TIER" >&2
  exit 1
fi

# list for CI logs; html so failure artifact uploads of playwright-report/ are non-empty
# (a lone --reporter=list overrides playwright.config.ts and skips the HTML report).
CMD=(npx playwright test "${SPECS[@]}" --reporter=list,html --max-failures="$MAX_FAILURES")

if [ -n "$SHARD" ]; then
  CMD+=(--shard="$SHARD")
fi

if [ -n "$SAMPLE_MODE" ] && [[ "$TIER" == push-gate || "$TIER" == pr-* ]]; then
  GREP_PATTERN=$(bash scripts/ci-playwright-sample.sh "$TIER" 2>/dev/null || true)
  if [ -n "$GREP_PATTERN" ]; then
    CMD+=(--grep "$GREP_PATTERN")
    echo "Sampling mode: $SAMPLE_MODE (seed: ${GITHUB_SHA:-local})" >&2
  fi
fi

"${CMD[@]}" 2>&1 | tee test-output.log
exit "${PIPESTATUS[0]}"
