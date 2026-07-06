#!/usr/bin/env bash
# Resolve the Orchestra (or other sibling) git branch from the Console checkout.
# main/master → main; staging → staging; all other branches → staging.
set -euo pipefail

REPO_PATH="${1:?Usage: resolve-sibling-branch.sh <repo-path>}"

if ! git -C "$REPO_PATH" rev-parse --is-inside-work-tree &>/dev/null; then
  echo "staging"
  exit 0
fi

branch="$(git -C "$REPO_PATH" rev-parse --abbrev-ref HEAD)"
case "$branch" in
  main | master) echo "main" ;;
  staging) echo "staging" ;;
  *) echo "staging" ;;
esac
