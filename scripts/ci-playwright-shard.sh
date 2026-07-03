#!/usr/bin/env bash
# Resolve matrix shard count for a CI tier from ci-playwright-manifest.json.
# Usage: bash scripts/ci-playwright-shard.sh <tier>
set -euo pipefail

TIER="${1:?Usage: ci-playwright-shard.sh <tier>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

area_for_tier() {
  case "$1" in
    push-gate | pr-auth | exhaustive-auth) echo auth ;;
    pr-billing | exhaustive-billing) echo billing ;;
    pr-account | exhaustive-account) echo account ;;
    pr-assistants | exhaustive-assistants) echo assistants ;;
    pr-shell-admin | exhaustive-shell) echo shell ;;
    exhaustive-admin) echo admin ;;
    exhaustive-impersonation) echo impersonation ;;
    *) echo shell ;;
  esac
}

AREA="$(area_for_tier "$TIER")"
SHARDS=$(node -e "
const m = require('${ROOT}/scripts/ci-playwright-manifest.json');
const area = m.areas['${AREA}'];
console.log(area?.defaultShards ?? 1);
")

echo "$SHARDS"
