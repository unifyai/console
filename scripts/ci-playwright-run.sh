#!/usr/bin/env bash
# Run a Playwright tier resolved by scripts/ci-playwright-tiers.sh.
set -euo pipefail

TIER="${1:?Usage: ci-playwright-run.sh <tier> [shard e.g. 1/3]}"
SHARD="${2:-}"

MAX_FAILURES="${MAX_FAILURES:-20}"

mapfile -t SPECS < <(bash scripts/ci-playwright-tiers.sh "$TIER")

if [ "${#SPECS[@]}" -eq 0 ]; then
  echo "No specs registered for tier: $TIER" >&2
  exit 1
fi

CMD=(npx playwright test "${SPECS[@]}" --reporter=list --max-failures="$MAX_FAILURES")
if [ -n "$SHARD" ]; then
  CMD+=(--shard="$SHARD")
fi

"${CMD[@]}" 2>&1 | tee test-output.log
exit "${PIPESTATUS[0]}"
