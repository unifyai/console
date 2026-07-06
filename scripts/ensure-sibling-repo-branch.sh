#!/usr/bin/env bash
# Check out the sibling repo branch that matches the Console branch policy.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CONSOLE_DIR="${CONSOLE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd -P)}"
SIBLING_PATH="${1:?Usage: ensure-sibling-repo-branch.sh <sibling-repo-path>}"
SIBLING_NAME="${2:-$(basename "$SIBLING_PATH")}"

if [[ ! -d "$SIBLING_PATH/.git" ]]; then
  echo "[branch] ${SIBLING_NAME}: not a git checkout at ${SIBLING_PATH} — skipping"
  exit 0
fi

target="$(bash "$SCRIPT_DIR/resolve-sibling-branch.sh" "$CONSOLE_DIR")"
current="$(git -C "$SIBLING_PATH" rev-parse --abbrev-ref HEAD)"

if [[ -n "$(git -C "$SIBLING_PATH" status --porcelain)" ]]; then
  echo "[branch] ERROR: ${SIBLING_NAME} has uncommitted changes — commit or stash before aligning to ${target}" >&2
  exit 1
fi

if [[ "$current" == "$target" ]]; then
  echo "[branch] ${SIBLING_NAME}: already on ${target}"
else
  echo "[branch] ${SIBLING_NAME}: checking out ${target} (Console branch → Orchestra branch policy)"
  git -C "$SIBLING_PATH" fetch origin "$target"
  git -C "$SIBLING_PATH" checkout "$target"
fi

git -C "$SIBLING_PATH" pull --rebase origin "$target"
echo "[branch] ${SIBLING_NAME}: synced with origin/${target}"
