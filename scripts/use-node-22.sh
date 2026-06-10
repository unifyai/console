#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
REQUIRED_MAJOR="$(tr -d '[:space:]' < "$REPO_ROOT/.nvmrc")"

node_major() {
  node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true
}

if [[ "$(node_major)" != "$REQUIRED_MAJOR" ]]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # Cursor can set npm_config_prefix, which makes nvm refuse to load.
    unset npm_config_prefix
    unset NPM_CONFIG_PREFIX
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm use "$REQUIRED_MAJOR" --silent >/dev/null || true
  fi
  if [[ "$(node_major)" != "$REQUIRED_MAJOR" ]] && compgen -G "$HOME/.nvm/versions/node/v${REQUIRED_MAJOR}*/bin/node" >/dev/null; then
    node_bin="$(ls -d "$HOME/.nvm/versions/node/v${REQUIRED_MAJOR}"*/bin | sort -V | tail -1)"
    export PATH="$node_bin:$PATH"
  fi
fi

if [[ "$(node_major)" != "$REQUIRED_MAJOR" ]]; then
  echo "Console requires Node ${REQUIRED_MAJOR}. Run: nvm install ${REQUIRED_MAJOR}" >&2
  exit 1
fi

exec "$@"
