#!/usr/bin/env bash
# =============================================================================
# local.sh — INTERNAL dev/test harness for Console + Orchestra
# =============================================================================
#
# This is NOT how you run the product locally. The single canonical end-to-end
# local command is `unity stack up` (source self-host across all repos), which
# calls this script with `--self-host`. Use the seeded modes below only for
# Console development, QA, and E2E tests.
#
# Starts a local Console deployment with a local Orchestra backend, PostgreSQL,
# and (in seeded modes) test data created via the TypeScript seed scenarios in
# src/tests/helpers/seeds/. By default the "personal-workspace" scenario is
# used. Pass --seed <name> for a different one, or --org for org-basic.
#
# To seed without starting the stack (e.g. against an already-running local
# Orchestra), invoke the runner directly:
#   npx tsx src/tests/helpers/seeds/run.ts <scenario|all|--list>
#
# Usage:
#   ./scripts/local.sh start --self-host              # Self-host (what `unity stack up` runs)
#   ./scripts/local.sh                                # personal-workspace seed (default)
#   ./scripts/local.sh start                          # Same as above
#   ./scripts/local.sh start --org                    # Shorthand for --seed org-basic
#   ./scripts/local.sh start --seed org-multi-role    # Specific scenario
#   ./scripts/local.sh start --seed all               # Run all scenarios
#   ./scripts/local.sh start --stripe                 # + Stripe webhook forwarding
#   ./scripts/local.sh start --credits 0              # seed users with a 0 credit balance
#   ./scripts/local.sh start --pubsub                 # + Pub/Sub emulator (billing events)
#   ./scripts/local.sh start --chat                   # + Pub/Sub + chat (Unity gateway)
#   ./scripts/local.sh start --integrations           # + Composio provider catalog sync
#   ./scripts/local.sh start --integrations --integrations-functions
#                                                     # + local-only curated Function rows
#   ./scripts/local.sh gateway-setup                  # Unity gateway setup wizard
#   ./scripts/local.sh gateway-doctor --check-credentials
#   ./scripts/local.sh gateway-urls --public-url https://callbacks.example.com
#   ./scripts/local.sh stop                           # Stop all services
#   ./scripts/local.sh restart                        # Stop then start (wipes database)
#   ./scripts/local.sh status                         # Show status of all services
#
# Prerequisites:
#   - Node.js 22 and npm 10+
#   - Docker (for PostgreSQL)
#   - Poetry (for Orchestra)
#   - Orchestra repo cloned as a sibling: ../orchestra
#   - (--stripe) Stripe CLI installed and authenticated (`stripe login`)
#   - (--pubsub) gcloud CLI with Pub/Sub emulator component
#   - (--chat)   Everything for --pubsub, plus Unity repo: ../unity
#
# Environment:
#   ORCHESTRA_REPO_PATH       Path to orchestra repo (default: ../orchestra)
#   UNIFY_REPO_PATH           Path to unity repo (default: ../unity)
#   CONSOLE_PORT              Next.js port (default: 3000)
#   ORCHESTRA_PORT            Orchestra port (default: 8000)
#
set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CONSOLE_REPO_PATH="$(cd "$SCRIPT_DIR/.." && pwd -P)"

ORCHESTRA_REPO_PATH="${ORCHESTRA_REPO_PATH:-$(cd "$CONSOLE_REPO_PATH/../orchestra" 2>/dev/null && pwd -P || echo "")}"
ORCHESTRA_LOCAL_SCRIPT="$ORCHESTRA_REPO_PATH/scripts/local.sh"

UNIFY_REPO_PATH="${UNIFY_REPO_PATH:-$(cd "$CONSOLE_REPO_PATH/../unity" 2>/dev/null && pwd -P || echo "")}"
UNIFY_LOCAL_SCRIPT="${UNIFY_REPO_PATH:+$UNIFY_REPO_PATH/scripts/local.sh}"
UNIFY_GATEWAY_CONFIG_FILE="/tmp/unity-local.config"
ENSURE_PREREQS_SCRIPT="${UNIFY_REPO_PATH:+$UNIFY_REPO_PATH/scripts/ensure_prereqs.sh}"
UNIFY_DEPLOY_REPO_PATH="${UNIFY_DEPLOY_REPO_PATH:-${DEPLOY_REPO_PATH:-$(cd "$CONSOLE_REPO_PATH/../unity-deploy" 2>/dev/null && pwd -P || echo "")}}"
UNIFY_DEPLOY_SELF_HOST_ENV_SCRIPT="${UNIFY_DEPLOY_REPO_PATH:+$UNIFY_DEPLOY_REPO_PATH/selfhost/self_host_env.sh}"
UNIFY_LEGACY_SELF_HOST_ENV_SCRIPT="${UNIFY_REPO_PATH:+$UNIFY_REPO_PATH/scripts/self_host_env.sh}"
if [[ -z "${SELF_HOST_ENV_SCRIPT:-}" ]]; then
  if [[ -n "$UNIFY_DEPLOY_SELF_HOST_ENV_SCRIPT" && -f "$UNIFY_DEPLOY_SELF_HOST_ENV_SCRIPT" ]]; then
    SELF_HOST_ENV_SCRIPT="$UNIFY_DEPLOY_SELF_HOST_ENV_SCRIPT"
  else
    SELF_HOST_ENV_SCRIPT="$UNIFY_LEGACY_SELF_HOST_ENV_SCRIPT"
  fi
fi
SELF_HOST_DESKTOP_SCRIPT="${UNIFY_REPO_PATH:+$UNIFY_REPO_PATH/scripts/self_host_desktop.sh}"

CONSOLE_PORT="${CONSOLE_PORT:-3000}"
ORCHESTRA_PORT="${ORCHESTRA_PORT:-8000}"

CONSOLE_PIDFILE="/tmp/console-local-dev.pid"
CONSOLE_LOGFILE="/tmp/console-local-dev.log"
CONSOLE_ENVFILE="/tmp/console-local-dev.env.json"

# Read keys from local env files (needed so Orchestra accepts admin API calls
# and Stripe-dependent billing flows work end-to-end).
ENV_LOCAL="$CONSOLE_REPO_PATH/.env.local"
ENV_DEVELOPMENT="$CONSOLE_REPO_PATH/.env.development"
ENV_DEFAULT="$CONSOLE_REPO_PATH/.env"

read_env_value() {
  local key="$1"
  shift
  local file
  for file in "$@"; do
    [[ -f "$file" ]] || continue
    local value
    value=$(grep -E "^${key}=" "$file" | sed 's/^[^=]*=//' | tr -d '"' || true)
    if [[ -n "$value" ]]; then
      echo "$value"
      return 0
    fi
  done
  echo ""
}

# Idempotently set KEY=VALUE in an env file. Replaces an existing assignment or
# appends a new one, leaving every other key untouched. Creates the file if it
# does not exist. Used to persist the self-host topology flags so a later bare
# `npm run dev` still resolves as a self-host deployment.
upsert_env_local_var() {
  local file="$1" key="$2" value="$3"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    local tmp
    tmp="$(mktemp)"
    grep -vE "^${key}=" "$file" > "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
    mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

ADMIN_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
ADMIN_KEY_SOURCE=""

ADMIN_KEY="$(read_env_value ORCHESTRA_ADMIN_KEY "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")"
if [[ -n "$ADMIN_KEY" ]]; then
  ADMIN_KEY_SOURCE="env file"
else
  # Keep a deterministic local fallback so Console, seed scripts, and Orchestra
  # all share the same admin credential unless explicitly overridden.
  ADMIN_KEY="local-admin-key"
  ADMIN_KEY_SOURCE="local fallback"
fi
STRIPE_SECRET_KEY="$(read_env_value STRIPE_SECRET_KEY "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")"
STRIPE_WEBHOOK_SECRET="$(read_env_value STRIPE_WEBHOOK_SECRET "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")"

# Stripe webhook forwarding (via orchestra/scripts/stripe.sh)
STRIPE_SCRIPT="$ORCHESTRA_REPO_PATH/scripts/stripe.sh"
STRIPE_SECRET_FILE="/tmp/stripe-webhook-secret.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# =============================================================================
# Prerequisite Checks
# =============================================================================

check_prerequisites() {
  local ok=true

  if ! command -v node &>/dev/null; then
    log_error "Node.js is not installed"
    ok=false
  fi

  if ! command -v npm &>/dev/null; then
    log_error "npm is not installed"
    ok=false
  fi

  if [[ -z "$ORCHESTRA_REPO_PATH" || ! -f "$ORCHESTRA_LOCAL_SCRIPT" ]]; then
    log_error "Orchestra repo not found. Expected at: $CONSOLE_REPO_PATH/../orchestra"
    log_info "Set ORCHESTRA_REPO_PATH to override."
    ok=false
  fi

  if [[ ! -f "$ENV_LOCAL" ]]; then
    if [[ "${SELF_HOST:-0}" == "1" && -f "$ENV_DEVELOPMENT" ]]; then
      log_warn ".env.local missing — self-host will use .env.development defaults"
    else
      log_error "Missing .env.local — see README for setup instructions."
      ok=false
    fi
  fi

  if [[ "$ok" == "false" ]]; then
    return 1
  fi

  log_success "Prerequisites OK"
}

# =============================================================================
# Pub/Sub Emulator Management (Console-owned)
# =============================================================================

PUBSUB_EMULATOR_PORT="${PUBSUB_EMULATOR_PORT:-8085}"
PUBSUB_GCP_PROJECT_ID="${PUBSUB_GCP_PROJECT_ID:-local-test-project}"
PUBSUB_TOPIC_SUFFIX_VAL="-staging"

EMULATOR_PIDFILE="/tmp/console-pubsub-emulator.pid"
EMULATOR_LOGFILE="/tmp/console-pubsub-emulator.log"
LOCAL_PUBSUB_HOST="localhost:${PUBSUB_EMULATOR_PORT}"

self_host_desktop_enabled() {
  # Desktop remains opt-in until the self-host desktop container startup path is
  # stable. Set SELF_HOST_DESKTOP=1 to re-enable liveview/file-sync desktop boot.
  [[ "${SELF_HOST_DESKTOP:-0}" == "1" ]]
}

check_gcloud() {
  if ! command -v gcloud &>/dev/null; then
    log_error "gcloud CLI is not installed"
    log_info "Install from: https://cloud.google.com/sdk/docs/install"
    return 1
  fi
  return 0
}

load_self_host_runtime_env() {
  if [[ -z "${UNIFY_REPO_PATH:-}" || ! -f "$SELF_HOST_ENV_SCRIPT" ]]; then
    return 0
  fi
  export UNIFY_HOME="${UNIFY_HOME:-$HOME/.unity}"
  export SELF_HOST_STATE_DIR="${SELF_HOST_STATE_DIR:-$UNIFY_HOME}"
  # shellcheck disable=SC1090
  source "$SELF_HOST_ENV_SCRIPT"
  export_self_host_coordinator_runtime_file
  load_self_host_repo_env_file "$UNIFY_REPO_PATH/.env"
  if declare -F self_host_export_livekit_backend &>/dev/null; then
    self_host_export_livekit_backend
  fi
}

write_console_env_fingerprint() {
  python3 - "$CONSOLE_ENVFILE" <<'PY'
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

keys = [
    "SELF_HOST",
    "NEXT_PUBLIC_SELF_HOST",
    "NEXT_PUBLIC_CONSOLE_DEBUG",
    "NEXTAUTH_URL",
    "ORCHESTRA_URL",
    "LOCAL_ADAPTERS_URL",
    "UNIFY_ADAPTERS_URL",
    "COMMUNICATION_URL",
    "UNIFY_COMMS_URL",
    "PUBSUB_EMULATOR_HOST",
    "GCP_PROJECT_ID",
    "PUBSUB_TOPIC_SUFFIX",
    "LIVEKIT_URL",
    "LIVEKIT_API_URL",
    "LIVEKIT_SIP_URI",
    "SELF_HOST_DESKTOP_URL",
    "CONSOLE_PORT",
    "ORCHESTRA_PORT",
]
secret_keys = [
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
]
env = {key: os.environ.get(key, "") for key in keys}
for key in secret_keys:
    value = os.environ.get(key, "")
    env[f"{key}_SHA256"] = hashlib.sha256(value.encode("utf-8")).hexdigest() if value else ""
data = {
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "cwd": os.getcwd(),
    "env": env,
}
with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2, sort_keys=True)
    fh.write("\n")
PY
}

console_env_missing_self_host_keys() {
  [[ -f "$CONSOLE_ENVFILE" ]] || return 0
  python3 - "$CONSOLE_ENVFILE" <<'PY'
import json
import sys

required = [
    "SELF_HOST",
    "NEXT_PUBLIC_SELF_HOST",
    "NEXT_PUBLIC_CONSOLE_DEBUG",
    "ORCHESTRA_URL",
    "LOCAL_ADAPTERS_URL",
    "UNIFY_ADAPTERS_URL",
    "PUBSUB_EMULATOR_HOST",
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY_SHA256",
    "LIVEKIT_API_SECRET_SHA256",
]
with open(sys.argv[1], encoding="utf-8") as fh:
    env = json.load(fh).get("env", {})
missing = [key for key in required if not env.get(key)]
if missing:
    print(", ".join(missing))
PY
}

ensure_service_gateway() {
  if ! is_unity_available; then
    log_error "Unity repo not found — cannot start gateway"
    return 1
  fi

  local gateway_url
  if declare -F self_host_gateway_base_url &>/dev/null; then
    gateway_url="$(self_host_gateway_base_url)"
  else
    gateway_url="http://${UNIFY_GATEWAY_HOST:-127.0.0.1}:${UNIFY_GATEWAY_PORT:-8001}"
  fi

  export UNIFY_RUNTIME_GATEWAY_OWNER="${SELF_HOST_RUNTIME_OWNER_SERVICE:-service}"
  if [[ -n "${ORCHESTRA_PORT:-}" ]]; then
    export ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}/v0"
  fi
  export ORCHESTRA_ADMIN_KEY="$ADMIN_KEY"

  if declare -F self_host_gateway_is_healthy &>/dev/null \
    && self_host_gateway_is_healthy; then
    if declare -F self_host_write_gateway_state &>/dev/null; then
      local gateway_pid=""
      gateway_pid="$(self_host_gateway_process_pid 2>/dev/null || true)"
      if [[ -n "$gateway_pid" ]]; then
        self_host_write_gateway_state \
          "${SELF_HOST_RUNTIME_OWNER_SERVICE:-service}" \
          "$gateway_pid"
      fi
    fi
    log_success "Unity gateway already running ($gateway_url)"
    return 0
  fi

  log_info "Starting Unity gateway for service runtime ($gateway_url) ..."
  if ! UNIFY_STACK_ORCHESTRATOR=console-local-harness bash "$UNIFY_LOCAL_SCRIPT" start-gateway; then
    log_error "Failed to start Unity gateway"
    return 1
  fi
  log_success "Unity gateway ready ($gateway_url)"
}

start_self_host_stack_gateway() {
  if ! check_unity_gateway_prerequisites; then
    return 1
  fi

  local gateway_url
  gateway_url="$(unity_gateway_base_url)"

  export UNIFY_RUNTIME_GATEWAY_OWNER="${SELF_HOST_RUNTIME_OWNER_STACK:-stack}"
  if [[ -n "${ORCHESTRA_PORT:-}" ]]; then
    export ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}/v0"
  fi
  export ORCHESTRA_ADMIN_KEY="$ADMIN_KEY"

  if declare -F self_host_gateway_is_healthy &>/dev/null \
    && self_host_gateway_is_healthy; then
    configure_unity_gateway_urls || return 1
    CHAT_COMMS_URL="$CHAT_ADAPTERS_URL"
    log_success "Unity gateway already running ($gateway_url)"
    return 0
  fi

  log_info "Starting Unity gateway for self-host ($gateway_url) ..."
  local gateway_env=(
    PUBSUB_EMULATOR_HOST="$LOCAL_PUBSUB_HOST"
    GCP_PROJECT_ID="$PUBSUB_GCP_PROJECT_ID"
    ORCHESTRA_ADMIN_KEY="$ADMIN_KEY"
  )
  if [[ -n "${ORCHESTRA_PORT:-}" ]]; then
    gateway_env+=(ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}/v0")
  fi
  if [[ "${SELF_HOST:-0}" == "1" ]]; then
    load_self_host_runtime_env
    append_workspace_oauth_env gateway_env
  fi

  if ! env UNIFY_STACK_ORCHESTRATOR=console-local-harness "${gateway_env[@]}" bash "$UNIFY_LOCAL_SCRIPT" start-gateway; then
    log_error "Failed to start Unity gateway"
    return 1
  fi

  configure_unity_gateway_urls || return 1
  CHAT_COMMS_URL="$CHAT_ADAPTERS_URL"
  log_success "Unity gateway ready ($gateway_url)"
}

append_workspace_oauth_env() {
  local -n _target_array="$1"
  local key val
  for key in \
    GOOGLE_OAUTH_CLIENT_ID \
    GOOGLE_OAUTH_CLIENT_SECRET \
    OAUTH_STATE_SIGNING_KEY \
    MICROSOFT_BYOD_CLIENT_ID \
    MS365_BYOD_CLIENT_ID \
    MS365_BYOD_CLIENT_SECRET; do
    val="${!key:-}"
    if [[ -n "$val" ]]; then
      _target_array+=("$key=$val")
    fi
  done
}

check_java() {
  if [[ -f "$ENSURE_PREREQS_SCRIPT" ]]; then
    # shellcheck disable=SC1090
    source "$ENSURE_PREREQS_SCRIPT"
    ensure_java
    return $?
  fi

  if command -v java &>/dev/null && java -version &>/dev/null 2>&1; then
    return 0
  fi
  log_error "Java is required for Pub/Sub emulator"
  return 1
}

check_pubsub_emulator() {
  if ! check_java; then return 1; fi

  local sdk_root
  sdk_root="$(gcloud info --format='value(installation.sdk_root)' 2>/dev/null || echo "")"

  local emulator_found=false
  for candidate in \
    "${sdk_root:+$sdk_root/platform/pubsub-emulator}" \
    "/usr/lib/google-cloud-sdk/platform/pubsub-emulator" \
    "$HOME/google-cloud-sdk/platform/pubsub-emulator"; do
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      emulator_found=true
      break
    fi
  done

  if [[ "$emulator_found" == "false" ]]; then
    if gcloud components install pubsub-emulator --quiet 2>/dev/null; then
      emulator_found=true
    else
      log_error "Pub/Sub emulator is not installed"
      log_info "Install with one of:"
      log_info "  apt:    sudo apt-get install google-cloud-cli-pubsub-emulator"
      log_info "  gcloud: gcloud components install pubsub-emulator"
      return 1
    fi
  fi

  mkdir -p "$HOME/.config/gcloud/emulators/pubsub" 2>/dev/null || true
  mkdir -p "$HOME/.config/gcloud/logs" 2>/dev/null || true

  log_success "Pub/Sub emulator is available"
  return 0
}

is_emulator_running() {
  if [[ -f "$EMULATOR_PIDFILE" ]]; then
    local pid
    pid=$(cat "$EMULATOR_PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  if lsof -i ":${PUBSUB_EMULATOR_PORT}" -sTCP:LISTEN &>/dev/null; then
    return 0
  fi
  return 1
}

start_pubsub_emulator() {
  log_info "Starting Pub/Sub emulator on port $PUBSUB_EMULATOR_PORT..."

  if is_emulator_running; then
    log_success "Pub/Sub emulator already running"
    return 0
  fi

  gcloud beta emulators pubsub start \
    --project="$PUBSUB_GCP_PROJECT_ID" \
    --host-port="localhost:${PUBSUB_EMULATOR_PORT}" \
    > "$EMULATOR_LOGFILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$EMULATOR_PIDFILE"

  log_info "Waiting for Pub/Sub emulator to be ready..."
  local max_attempts=30
  local attempt=0
  while (( attempt < max_attempts )); do
    if curl -s "http://localhost:${PUBSUB_EMULATOR_PORT}" &>/dev/null; then
      log_success "Pub/Sub emulator is ready"
      return 0
    fi
    sleep 1
    ((attempt++)) || true
  done

  log_error "Pub/Sub emulator failed to start within 30 seconds"
  log_info "Check logs at: $EMULATOR_LOGFILE"
  return 1
}

stop_pubsub_emulator() {
  if [[ -f "$EMULATOR_PIDFILE" ]]; then
    local pid
    pid=$(cat "$EMULATOR_PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      log_info "Stopping Pub/Sub emulator (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$EMULATOR_PIDFILE"
  fi

  local port_pids
  port_pids=$(lsof -t -i ":${PUBSUB_EMULATOR_PORT}" 2>/dev/null || true)
  if [[ -n "$port_pids" ]]; then
    echo "$port_pids" | xargs kill -9 2>/dev/null || true
  fi

  log_success "Pub/Sub emulator stopped"
}

# =============================================================================
# Orchestra Management (delegates to orchestra/scripts/local.sh)
# =============================================================================

is_orchestra_running() {
  curl -s --connect-timeout 2 --max-time 5 "http://127.0.0.1:${ORCHESTRA_PORT}/v0" &>/dev/null
}

orchestra_listens_on_lan() {
  local port="${ORCHESTRA_PORT:-8000}"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null \
    | grep -qE '(\*|0\.0\.0\.0|\[::\]):'"$port"
}

start_orchestra() {
  local with_stripe="${1:-false}"

  if is_orchestra_running; then
    if [[ "${SELF_HOST:-0}" == "1" ]] \
      && self_host_desktop_enabled \
      && ! orchestra_listens_on_lan; then
      log_info "Restarting Orchestra so desktop containers can reach it on 0.0.0.0 ..."
      UNIFY_STACK_ORCHESTRATOR=console-local-harness bash "$ORCHESTRA_LOCAL_SCRIPT" stop 2>/dev/null || true
      sleep 1
    else
      log_success "Orchestra already running on port $ORCHESTRA_PORT"
      return 0
    fi
  fi

  if [[ -f "$SCRIPT_DIR/ensure-sibling-repo-branch.sh" && -n "$ORCHESTRA_REPO_PATH" ]]; then
    bash "$SCRIPT_DIR/ensure-sibling-repo-branch.sh" "$ORCHESTRA_REPO_PATH" orchestra
  fi

  log_info "Starting Orchestra via $ORCHESTRA_LOCAL_SCRIPT ..."

  # Pass the admin key so Orchestra authenticates Console's admin calls.
  export ORCHESTRA_ADMIN_KEY="$ADMIN_KEY"
  export ORCHESTRA_PORT="$ORCHESTRA_PORT"

  # Local deployment mirrors the test logging convention (see the CM runtime env
  # in unity-deploy/selfhost/self_host_env.sh): Orchestra writes OTel spans to
  # the shared cross-repo logs/all/ and per-request JSON traces to logs/orchestra/
  # in the unity repo, so a run's Orchestra spans correlate with unity/unify/
  # unillm. Opt-out by exporting these beforehand.
  if [[ -n "${UNIFY_REPO_PATH:-}" ]]; then
    export ORCHESTRA_OTEL_LOG_DIR="${ORCHESTRA_OTEL_LOG_DIR:-$UNIFY_REPO_PATH/logs/all}"
    export ORCHESTRA_LOG_DIR="${ORCHESTRA_LOG_DIR:-$UNIFY_REPO_PATH/logs/orchestra}"
    mkdir -p "$ORCHESTRA_OTEL_LOG_DIR" "$ORCHESTRA_LOG_DIR" 2>/dev/null || true
  fi
  local composio_key="${COMPOSIO_API_KEY:-$(read_env_value COMPOSIO_API_KEY "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
  if [[ -n "$composio_key" ]]; then
    export COMPOSIO_API_KEY="$composio_key"
  fi
  local pipedream_client_id="${PIPEDREAM_CLIENT_ID:-$(read_env_value PIPEDREAM_CLIENT_ID "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
  local pipedream_client_secret="${PIPEDREAM_CLIENT_SECRET:-$(read_env_value PIPEDREAM_CLIENT_SECRET "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
  local pipedream_project_id="${PIPEDREAM_PROJECT_ID:-$(read_env_value PIPEDREAM_PROJECT_ID "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
  if [[ -n "$pipedream_client_id" ]]; then export PIPEDREAM_CLIENT_ID="$pipedream_client_id"; fi
  if [[ -n "$pipedream_client_secret" ]]; then export PIPEDREAM_CLIENT_SECRET="$pipedream_client_secret"; fi
  if [[ -n "$pipedream_project_id" ]]; then export PIPEDREAM_PROJECT_ID="$pipedream_project_id"; fi

  # Tell Orchestra where Console is running so Stripe checkout redirects
  # (success_url / cancel_url) point to localhost instead of console.unify.ai
  export UNIFY_CONSOLE_FRONTEND_URL="http://localhost:${CONSOLE_PORT}"

  # Wire Orchestra to the Unity gateway so the unity_system_event
  # webhook is reachable in local dev. ``CHAT_ADAPTERS_URL`` is
  # populated by ``configure_unity_gateway_urls`` when --chat
  # is on; without this export Orchestra would read the variable as
  # ``None`` at import time and every subsequent ``_post_unity_system_event``
  # (secret-landed narration, onboarding-session-started, ...) would
  # fail with "Request URL is missing an 'http://' or 'https://' protocol."
  if [[ -n "$CHAT_ADAPTERS_URL" ]]; then
    export UNIFY_ADAPTERS_URL="$CHAT_ADAPTERS_URL"
    log_info "  UNIFY_ADAPTERS_URL=$UNIFY_ADAPTERS_URL"
  fi
  if [[ -n "$CHAT_COMMS_URL" ]]; then
    export UNIFY_COMMS_URL="$CHAT_COMMS_URL"
    log_info "  UNIFY_COMMS_URL=$UNIFY_COMMS_URL"
  fi
  if [[ "${SELF_HOST:-0}" == "1" ]]; then
    export SELF_HOST=1
    export ORCHESTRA_SKIP_TEST_USER=1
    load_self_host_runtime_env
    log_info "  SELF_HOST=1"
    log_info "  ORCHESTRA_SKIP_TEST_USER=1"
    if [[ -n "${GOOGLE_OAUTH_CLIENT_ID:-}" ]]; then
      export GOOGLE_OAUTH_CLIENT_ID
      log_info "  GOOGLE_OAUTH_CLIENT_ID set"
    fi
    if [[ -n "${OAUTH_STATE_SIGNING_KEY:-}" ]]; then
      export OAUTH_STATE_SIGNING_KEY
    fi
    if [[ -n "${MICROSOFT_BYOD_CLIENT_ID:-}" ]]; then
      export MICROSOFT_BYOD_CLIENT_ID
      log_info "  MICROSOFT_BYOD_CLIENT_ID set"
    fi
  fi

  # When --stripe is requested, pass Stripe keys so Orchestra can create
  # checkout/portal sessions and process webhooks.
  if [[ "$with_stripe" == "true" ]]; then
    if [[ -z "$STRIPE_SECRET_KEY" ]]; then
      log_warn "STRIPE_SECRET_KEY not found in .env.local — Stripe billing flows won't work"
    else
      export STRIPE_SECRET_KEY
      log_info "Stripe API key configured for Orchestra"
    fi
    # Skip webhook signature verification for local dev — the webhook secret
    # from 'stripe listen' changes every session, so strict verification
    # would break unless Orchestra is restarted each time.
    export SKIP_STRIPE_SIGNATURE_VERIFICATION=true

    # Also export any Stripe price/product IDs so billing flows work.
    #   * CREDITS_* — legacy one-time credit checkout (kept for back-compat).
    #   * SUBSCRIPTION_*_MONTHLY/_ANNUAL + ANNUAL_COUPON_ID — the self-serve
    #     subscription plans. Without these the /billing/subscribe endpoint
    #     fails with "Stripe subscription price ID not configured", so the
    #     subscribe / annual / upgrade journeys can't be exercised locally.
    #     Mint them once with: orchestra/scripts/create_subscription_prices.py
    #     and store the printed ids (drop the _TEST suffix) in .env.local.
    for var in STRIPE_UNIFY_CREDITS_PRICE_ID_PERSONAL STRIPE_UNIFY_CREDITS_PRICE_ID_BUSINESS \
               STRIPE_UNIFY_CREDITS_PRODUCT_ID_PERSONAL STRIPE_UNIFY_CREDITS_PRODUCT_ID_BUSINESS \
               STRIPE_UNIFY_SUBSCRIPTION_PRICE_ID_PERSONAL_MONTHLY \
               STRIPE_UNIFY_SUBSCRIPTION_PRICE_ID_BUSINESS_MONTHLY \
               STRIPE_UNIFY_SUBSCRIPTION_PRICE_ID_PERSONAL_ANNUAL \
               STRIPE_UNIFY_SUBSCRIPTION_PRICE_ID_BUSINESS_ANNUAL \
               STRIPE_UNIFY_ANNUAL_COUPON_ID; do
      local val
      val=$(grep -E "^${var}=" "$ENV_LOCAL" 2>/dev/null | sed 's/^[^=]*=//' | tr -d '"' || true)
      if [[ -n "$val" ]]; then
        export "$var=$val"
      fi
    done

    # Surface which subscription prices made it through so a missing/typo'd
    # id is obvious before you click Subscribe.
    if [[ -n "${STRIPE_UNIFY_SUBSCRIPTION_PRICE_ID_PERSONAL_MONTHLY:-}" ]]; then
      log_info "Self-serve subscription prices configured (monthly/annual)"
    else
      log_warn "No STRIPE_UNIFY_SUBSCRIPTION_PRICE_ID_* in .env.local — the subscribe journey will 500."
      log_warn "  Mint them: cd ../orchestra && python scripts/create_subscription_prices.py"
      log_warn "  Then add the printed ids (without the _TEST suffix) to console/.env.local"
    fi
  fi

  if ! UNIFY_STACK_ORCHESTRATOR=console-local-harness ORCHESTRA_REPO_PATH="$ORCHESTRA_REPO_PATH" bash "$ORCHESTRA_LOCAL_SCRIPT" start; then
    log_error "Failed to start Orchestra"
    return 1
  fi

  log_success "Orchestra is running"
}

stop_orchestra() {
  log_info "Stopping Orchestra..."
  UNIFY_STACK_ORCHESTRATOR=console-local-harness ORCHESTRA_REPO_PATH="$ORCHESTRA_REPO_PATH" bash "$ORCHESTRA_LOCAL_SCRIPT" stop 2>/dev/null || true
  log_success "Orchestra stopped"
}

# Destroy Orchestra's local Postgres volume so the next start comes up with a
# fresh, empty database (migrations + a single seed run). Used by `restart` so
# it lives up to its "wipes database" contract — without this the DB is
# preserved and every reseed mints another random seed user, accumulating
# stale logins (and stale credit balances) in the Quick Sign-In panel.
purge_orchestra_db() {
  log_info "Wiping Orchestra database (fresh schema + single seed on start)..."
  UNIFY_STACK_ORCHESTRATOR=console-local-harness ORCHESTRA_REPO_PATH="$ORCHESTRA_REPO_PATH" bash "$ORCHESTRA_LOCAL_SCRIPT" purge 2>/dev/null || true
  log_success "Orchestra database wiped"
}

# =============================================================================
# Unity Gateway Management (--chat mode)
# =============================================================================

check_unity_gateway_prerequisites() {
  if ! is_unity_available; then
    log_error "Unity repo not found. Expected at: $CONSOLE_REPO_PATH/../unity"
    log_info "Set UNIFY_REPO_PATH to override."
    log_info "(Only required for --chat; --pubsub works without it.)"
    return 1
  fi
  log_success "Unity repo found at: $UNIFY_REPO_PATH"
}

unity_gateway_python() {
  if [[ -x "$UNIFY_REPO_PATH/.venv/bin/python" ]]; then
    echo "$UNIFY_REPO_PATH/.venv/bin/python"
  else
    echo "python3"
  fi
}

cmd_gateway_setup() {
  if ! check_unity_gateway_prerequisites; then
    return 1
  fi
  local python_bin
  python_bin="$(unity_gateway_python)"
  local env_file="${UNIFY_GATEWAY_ENV_FILE:-$ENV_LOCAL}"
  local interactive_default="true"
  local arg
  for arg in "$@"; do
    case "$arg" in
      --interactive|--non-interactive|--write-env|--print)
        interactive_default="false"
        ;;
    esac
  done
  local args=(setup --env-file "$env_file")
  if [[ "$interactive_default" == "true" ]]; then
    args+=(--interactive)
  fi
  if (( "$#" )); then
    args+=("$@")
  fi
  log_info "Delegating to Unity gateway setup..."
  (
    cd "$UNIFY_REPO_PATH"
    ORCHESTRA_ADMIN_KEY="$ADMIN_KEY" "$python_bin" -m unify.gateway "${args[@]}"
  )
}

cmd_gateway_doctor() {
  if ! check_unity_gateway_prerequisites; then
    return 1
  fi
  local python_bin
  python_bin="$(unity_gateway_python)"
  local env_file="${UNIFY_GATEWAY_ENV_FILE:-$ENV_LOCAL}"
  log_info "Delegating to Unity gateway doctor..."
  (
    cd "$UNIFY_REPO_PATH"
    ORCHESTRA_ADMIN_KEY="$ADMIN_KEY" "$python_bin" -m unify.gateway doctor --env-file "$env_file" "$@"
  )
}

cmd_gateway_urls() {
  if ! check_unity_gateway_prerequisites; then
    return 1
  fi
  local python_bin
  python_bin="$(unity_gateway_python)"
  local env_file="${UNIFY_GATEWAY_ENV_FILE:-$ENV_LOCAL}"
  local public_url
  public_url="${UNIFY_GATEWAY_PUBLIC_URL:-$(read_env_value UNIFY_GATEWAY_PUBLIC_URL "$env_file" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
  log_info "Delegating to Unity gateway URL printer..."
  (
    cd "$UNIFY_REPO_PATH"
    ORCHESTRA_ADMIN_KEY="$ADMIN_KEY" UNIFY_GATEWAY_PUBLIC_URL="$public_url" "$python_bin" -m unify.gateway urls "$@"
  )
}

unity_gateway_base_url() {
  if [[ -n "${UNIFY_GATEWAY_PUBLIC_URL:-}" ]]; then
    echo "$UNIFY_GATEWAY_PUBLIC_URL"
  else
    echo "http://${UNIFY_GATEWAY_HOST:-127.0.0.1}:${UNIFY_GATEWAY_PORT:-8001}"
  fi
}

configure_unity_gateway_urls() {
  CHAT_ADAPTERS_URL="$(unity_gateway_base_url)"
  CHAT_TEST_ASSISTANT_ID="${CHAT_TEST_ASSISTANT_ID:-default-test-assistant}"

  if [[ -f "$UNIFY_GATEWAY_CONFIG_FILE" ]]; then
    while IFS='=' read -r key value; do
      case "$key" in
        UNIFY_COMMS_URL)     CHAT_ADAPTERS_URL="$value" ;;
        UNIFY_ADAPTERS_URL)  CHAT_ADAPTERS_URL="$value" ;;
        TEST_ASSISTANT_ID)   CHAT_TEST_ASSISTANT_ID="$value" ;;
      esac
    done < "$UNIFY_GATEWAY_CONFIG_FILE"
  fi

  log_info "Configured Unity gateway:"
  log_info "  Gateway URL:       ${CHAT_ADAPTERS_URL:-<not set>}"
  log_info "  Test Assistant ID: ${CHAT_TEST_ASSISTANT_ID:-<not set>}"
}

CHAT_ADAPTERS_URL=""
CHAT_COMMS_URL=""
CHAT_TEST_ASSISTANT_ID=""

# =============================================================================
# Unity Management (--chat mode)
# =============================================================================

is_unity_available() {
  [[ -n "$UNIFY_REPO_PATH" && -f "$UNIFY_LOCAL_SCRIPT" ]]
}

is_unity_running() {
  is_unity_available && bash "$UNIFY_LOCAL_SCRIPT" check &>/dev/null
}

start_unity() {
  local force_echo="${1:-false}"

  if ! is_unity_available; then
    log_warn "Unity repo not found at $CONSOLE_REPO_PATH/../unity — skipping."
    log_info "Set UNIFY_REPO_PATH to override. Chat will work but no responses will come back."
    return 0
  fi

  if is_unity_running; then
    log_success "Unity already running"
    return 0
  fi

  # Resolve the actual assistant agentId from the database.  The seed
  # creates assistants with auto-incremented IDs, so the first assistant
  # is typically "1". If the DB isn't available, fall back to the
  # configured test assistant id.
  local resolved_assistant_id
  resolved_assistant_id=$(docker exec orchestra-local-db \
    psql -U orchestra -d orchestra -t -A \
    -c "SELECT agent_id FROM assistants ORDER BY agent_id LIMIT 1;" 2>/dev/null | head -1 || echo "")
  resolved_assistant_id="${resolved_assistant_id:-${CHAT_TEST_ASSISTANT_ID:-default-test-assistant}}"
  CHAT_TEST_ASSISTANT_ID="$resolved_assistant_id"

  if [[ "$force_echo" == "true" ]]; then
    log_info "Starting Unity in echo mode (forced) — auto-discovers all unity-* topics ..."
  else
    log_info "Starting Unity gateway + ConversationManager for assistant=$resolved_assistant_id ..."
  fi

  local unity_env=(
    PUBSUB_EMULATOR_HOST="$LOCAL_PUBSUB_HOST"
    GCP_PROJECT_ID="$PUBSUB_GCP_PROJECT_ID"
    ASSISTANT_ID="$resolved_assistant_id"
    DEPLOY_ENV="staging"
  )

  # Forward Orchestra connection.
  if [[ -n "${ORCHESTRA_PORT:-}" ]]; then
    unity_env+=(ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}/v0")
  fi

  # Forward LLM API keys from .env.local if present (for full CM mode).
  for key in OPENAI_API_KEY ANTHROPIC_API_KEY; do
    local val
    val=$(grep -E "^${key}=" "$ENV_LOCAL" 2>/dev/null | sed 's/^[^=]*=//' | tr -d '"' || true)
    if [[ -n "$val" ]]; then
      unity_env+=("$key=$val")
    fi
  done

  # UNIFY_KEY must be the local seed key so the CM can authenticate
  # against the local Orchestra (the .env.local key is for production).
  local local_unify_key
  local_unify_key=$(docker exec orchestra-local-db \
    psql -U orchestra -d orchestra -t -A \
    -c "SELECT k.key FROM api_key k JOIN \"user\" u ON k.user_id = u.id ORDER BY k.id LIMIT 1;" 2>/dev/null | head -1 || echo "")
  local_unify_key="${local_unify_key:-local-test-api-key}"
  unity_env+=("UNIFY_KEY=$local_unify_key")

  # Forward admin key from .env.local if available.
  local admin_val
  admin_val=$(grep -E "^ORCHESTRA_ADMIN_KEY=" "$ENV_LOCAL" 2>/dev/null | sed 's/^[^=]*=//' | tr -d '"' || true)
  if [[ -n "$admin_val" ]]; then
    unity_env+=("ORCHESTRA_ADMIN_KEY=$admin_val")
  fi

  # Populate full session details from the seeded assistant/user so the CM
  # knows who the assistant is and who the owner is (replicating what the
  # startup message provides in production).
  local _a_first="" _a_surname="" _a_about="" _a_age="" _a_nat="" _a_tz=""
  local _u_first="" _u_last="" _u_email="" _u_id="" _u_phone="" _u_whatsapp=""
  _a_first=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT first_name FROM assistants WHERE agent_id = $resolved_assistant_id;" 2>/dev/null || echo "")
  _a_surname=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT surname FROM assistants WHERE agent_id = $resolved_assistant_id;" 2>/dev/null || echo "")
  _a_about=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT about FROM assistants WHERE agent_id = $resolved_assistant_id;" 2>/dev/null || echo "")
  _a_age=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT age FROM assistants WHERE agent_id = $resolved_assistant_id;" 2>/dev/null || echo "")
  _a_nat=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT nationality FROM assistants WHERE agent_id = $resolved_assistant_id;" 2>/dev/null || echo "")
  _a_tz=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT timezone FROM assistants WHERE agent_id = $resolved_assistant_id;" 2>/dev/null || echo "")
  _u_id=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT user_id FROM assistants WHERE agent_id = $resolved_assistant_id;" 2>/dev/null || echo "")
  if [[ -n "$_u_id" ]]; then
    _u_first=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT name FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
    _u_last=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT last_name FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
    _u_email=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT email FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
    _u_phone=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT phone_number FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
    _u_whatsapp=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT whatsapp_number FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
  fi

  [[ -n "$_a_first" ]]   && unity_env+=("ASSISTANT_FIRST_NAME=$_a_first")
  [[ -n "$_a_surname" ]] && unity_env+=("ASSISTANT_SURNAME=$_a_surname")
  [[ -n "$_a_about" ]]   && unity_env+=("ASSISTANT_ABOUT=$_a_about")
  [[ -n "$_a_age" ]]     && unity_env+=("ASSISTANT_AGE=$_a_age")
  [[ -n "$_a_nat" ]]     && unity_env+=("ASSISTANT_NATIONALITY=$_a_nat")
  [[ -n "$_a_tz" ]]      && unity_env+=("ASSISTANT_TIMEZONE=$_a_tz")
  [[ -n "$_u_first" ]]   && unity_env+=("USER_FIRST_NAME=$_u_first")
  [[ -n "$_u_last" ]]    && unity_env+=("USER_SURNAME=$_u_last")
  [[ -n "$_u_email" ]]   && unity_env+=("USER_EMAIL=$_u_email")
  [[ -n "$_u_id" ]]      && unity_env+=("USER_ID=$_u_id")
  [[ -n "$_u_phone" ]]    && unity_env+=("USER_NUMBER=$_u_phone")
  [[ -n "$_u_whatsapp" ]] && unity_env+=("USER_WHATSAPP_NUMBER=$_u_whatsapp")

  local unity_args=(start)
  if [[ "$force_echo" == "true" ]]; then
    unity_args+=(--echo)
  else
    unity_args+=(--full)
  fi

  if ! env UNIFY_STACK_ORCHESTRATOR=console-local-harness "${unity_env[@]}" bash "$UNIFY_LOCAL_SCRIPT" "${unity_args[@]}"; then
    log_warn "Unity failed to start — chat will work but no responses will come back."
    return 0
  fi

  log_success "Unity is running"
}

stop_unity() {
  if [[ "${UNIFY_ALLOW_RUNTIME_STOP:-0}" != "1" ]] \
    && declare -F self_host_should_preserve_runtime_on_interactive_stop &>/dev/null \
    && self_host_should_preserve_runtime_on_interactive_stop; then
    if declare -F self_host_adopt_coordinator_for_service &>/dev/null; then
      local preserved_assistant_id=""
      preserved_assistant_id="$(_running_coordinator_agent_id 2>/dev/null || true)"
      self_host_adopt_coordinator_for_service "$preserved_assistant_id" || true
    fi
    log_info "Keeping service-managed Coordinator runtime running"
    return 0
  fi

  if is_unity_available; then
    log_info "Stopping Unity..."
    UNIFY_STACK_ORCHESTRATOR=console-local-harness UNIFY_ALLOW_RUNTIME_STOP=1 bash "$UNIFY_LOCAL_SCRIPT" stop 2>/dev/null || true
    if [[ -n "${SELF_HOST_DESKTOP_SCRIPT:-}" && -f "$SELF_HOST_DESKTOP_SCRIPT" ]]; then
      bash "$SELF_HOST_DESKTOP_SCRIPT" stop 2>/dev/null || true
    fi
    if declare -F self_host_clear_runtime_state &>/dev/null; then
      self_host_clear_runtime_state
    fi
    log_success "Unity stopped"
  fi
}

# =============================================================================
# Self-host Coordinator runtime (Auth B — logged-in user)
# =============================================================================

_INBOUND_SUBSCRIPTION_FILTER='attributes.thread = "inbound"'

_pubsub_emulator_base_url() {
  local emulator_host="$LOCAL_PUBSUB_HOST"
  if [[ -z "$emulator_host" ]]; then
    return 1
  fi
  if [[ ! "$emulator_host" =~ ^http ]]; then
    echo "http://$emulator_host"
  else
    echo "$emulator_host"
  fi
}

_inbound_subscription_filter_matches() {
  local emulator_url="$1"
  local project_id="$2"
  local inbound_sub="$3"
  local body

  body="$(curl -s "${emulator_url}/v1/projects/${project_id}/subscriptions/${inbound_sub}" 2>/dev/null || true)"
  [[ -n "$body" ]] || return 1

  EXPECTED_FILTER="$_INBOUND_SUBSCRIPTION_FILTER" python3 -c "
import json
import os
import sys

try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(1)
sys.exit(0 if data.get('filter') == os.environ['EXPECTED_FILTER'] else 1)
" <<<"$body"
}

# Ensure assistant Pub/Sub topics/subscriptions exist on the local emulator.
# Inbound sub is recreated only when missing or mis-filtered. If Coordinator CM
# is already subscribed, callers must refresh CM after a recreate (see
# refresh_coordinator_ingress_if_running).
ensure_assistant_pubsub_topics() {
  local agent_id="$1"
  local project_id="$PUBSUB_GCP_PROJECT_ID"
  local suffix="$PUBSUB_TOPIC_SUFFIX_VAL"
  local emulator_url

  UNIFY_INBOUND_SUB_RECREATED=0
  export UNIFY_INBOUND_SUB_RECREATED

  if [[ -z "$agent_id" ]]; then
    return 0
  fi
  if ! emulator_url="$(_pubsub_emulator_base_url)"; then
    return 0
  fi

  local topic_name="unity-${agent_id}${suffix}"
  log_info "Ensuring Pub/Sub topic for assistant $agent_id ..."

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "${emulator_url}/v1/projects/${project_id}/topics/${topic_name}" 2>/dev/null || echo "000")

  if [[ "$status" == "200" || "$status" == "409" ]]; then
    log_success "Topic ready: $topic_name"
  else
    log_warn "Failed to create topic $topic_name (HTTP $status)"
    return 1
  fi

  local outbound_sub="${topic_name}-outbound-sub"
  curl -s -o /dev/null \
    -X PUT "${emulator_url}/v1/projects/${project_id}/subscriptions/${outbound_sub}" \
    -H "Content-Type: application/json" \
    -d "{\"topic\":\"projects/${project_id}/topics/${topic_name}\",\"filter\":\"attributes.thread = \\\"unify_message_outbound\\\"\"}" \
    2>/dev/null || true

  local syserr_sub="${topic_name}-system-error-sub"
  curl -s -o /dev/null \
    -X PUT "${emulator_url}/v1/projects/${project_id}/subscriptions/${syserr_sub}" \
    -H "Content-Type: application/json" \
    -d "{\"topic\":\"projects/${project_id}/topics/${topic_name}\",\"filter\":\"attributes.thread = \\\"system_error\\\"\"}" \
    2>/dev/null || true

  local actions_sub="${topic_name}-actions-sub"
  curl -s -o /dev/null \
    -X PUT "${emulator_url}/v1/projects/${project_id}/subscriptions/${actions_sub}" \
    -H "Content-Type: application/json" \
    -d "{\"topic\":\"projects/${project_id}/topics/${topic_name}\",\"filter\":\"attributes.thread = \\\"action_event\\\"\",\"messageRetentionDuration\":\"1800s\"}" \
    2>/dev/null || true

  # CM inbound subscription — match hosted production: only ``thread=inbound``
  # messages (Adapters / gateway). Unfiltered subs also receive action_event
  # and outbound threads, which CommsManager acks as unknown noise.
  local inbound_sub="${topic_name}-sub"
  if _inbound_subscription_filter_matches "$emulator_url" "$project_id" "$inbound_sub"; then
    log_success "Inbound subscription ready: $inbound_sub"
    return 0
  fi

  if is_unity_running; then
    local running_id=""
    running_id="$(_running_coordinator_agent_id 2>/dev/null || true)"
    if [[ -n "$running_id" && "$running_id" == "$agent_id" ]]; then
      log_info "Recreating inbound subscription — Coordinator CM will resubscribe afterward"
    fi
  fi

  curl -s -o /dev/null \
    -X DELETE "${emulator_url}/v1/projects/${project_id}/subscriptions/${inbound_sub}" \
    2>/dev/null || true
  curl -s -o /dev/null \
    -X PUT "${emulator_url}/v1/projects/${project_id}/subscriptions/${inbound_sub}" \
    -H "Content-Type: application/json" \
    -d "{\"topic\":\"projects/${project_id}/topics/${topic_name}\",\"filter\":\"attributes.thread = \\\"inbound\\\"\"}" \
    2>/dev/null || true

  UNIFY_INBOUND_SUB_RECREATED=1
  export UNIFY_INBOUND_SUB_RECREATED
  log_success "Inbound subscription ready: $inbound_sub"
}

create_assistant_pubsub_topics() {
  ensure_assistant_pubsub_topics "$@"
}

_running_coordinator_agent_id() {
  local pidfile="/tmp/unity-local.pid"
  [[ -f "$pidfile" ]] || return 1
  local pid
  pid="$(cat "$pidfile" 2>/dev/null)" || return 1
  [[ -n "$pid" ]] || return 1
  ps eww -p "$pid" 2>/dev/null | tr ' ' '\n' | sed -n 's/^ASSISTANT_ID=//p' | head -1
}

refresh_coordinator_ingress_if_running() {
  local unify_key="${1:-}"
  local coordinator_agent_id="${2:-}"

  [[ -n "$unify_key" && -n "$coordinator_agent_id" ]] || return 0
  is_emulator_running || return 0
  is_unity_running || return 0

  local running_id=""
  running_id="$(_running_coordinator_agent_id 2>/dev/null || true)"
  [[ "$running_id" == "$coordinator_agent_id" ]] || return 0

  log_info "Refreshing Coordinator Pub/Sub ingress..."
  export UNIFY_REFRESH_INBOUND_SUBSCRIPTION=1
  export UNIFY_ALLOW_RUNTIME_STOP=1
  start_unity_coordinator "$unify_key" "$coordinator_agent_id"
}

_load_self_host_coordinator_credentials() {
  local unify_key="${SELF_HOST_UNIFY_KEY:-}"
  local coordinator_id="${SELF_HOST_COORDINATOR_AGENT_ID:-}"
  local runtime_file="${SELF_HOST_COORDINATOR_RUNTIME_FILE:-${UNIFY_HOME:-$HOME/.unity}/coordinator-runtime.json}"

  if [[ (-z "$unify_key" || -z "$coordinator_id") && -f "$runtime_file" ]]; then
    local parsed
    parsed="$(python3 - "$runtime_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    data = json.load(fh)
print(data.get("api_key") or data.get("apiKey") or "")
print(data.get("coordinator_agent_id") or data.get("coordinatorAgentId") or "")
PY
)" || true
    if [[ -z "$unify_key" ]]; then
      unify_key="$(echo "$parsed" | sed -n '1p')"
    fi
    if [[ -z "$coordinator_id" ]]; then
      coordinator_id="$(echo "$parsed" | sed -n '2p')"
    fi
  fi

  SELF_HOST_UNIFY_KEY="$unify_key"
  SELF_HOST_COORDINATOR_AGENT_ID="$coordinator_id"
  export SELF_HOST_UNIFY_KEY SELF_HOST_COORDINATOR_AGENT_ID
}

start_unity_coordinator() {
  local unify_key="${1:-${SELF_HOST_UNIFY_KEY:-}}"
  local coordinator_agent_id="${2:-${SELF_HOST_COORDINATOR_AGENT_ID:-}}"
  local runtime_owner="${UNIFY_RUNTIME_OWNER:-${SELF_HOST_RUNTIME_OWNER_STACK:-stack}}"

  if [[ -z "$unify_key" || -z "$coordinator_agent_id" ]]; then
    log_error "UNIFY_KEY and Coordinator agent_id are required"
    return 1
  fi

  if ! is_unity_available; then
    log_warn "Unity repo not found — skipping Coordinator runtime"
    return 0
  fi

  if is_unity_running; then
    local running_id=""
    running_id="$(_running_coordinator_agent_id 2>/dev/null || true)"
    if [[ "$running_id" == "$coordinator_agent_id" ]]; then
      if declare -F self_host_adopt_coordinator_for_service &>/dev/null \
        && declare -F self_host_service_is_enabled &>/dev/null \
        && self_host_service_is_enabled \
        && declare -F self_host_service_supervisor_is_running &>/dev/null \
        && self_host_service_supervisor_is_running; then
        self_host_adopt_coordinator_for_service "$coordinator_agent_id" || true
      fi
      if [[ "${UNIFY_REFRESH_INBOUND_SUBSCRIPTION:-0}" == "1" ]]; then
        log_info "Restarting Coordinator to refresh Pub/Sub subscription..."
        UNIFY_STACK_ORCHESTRATOR=console-local-harness UNIFY_ALLOW_RUNTIME_STOP=1 bash "$UNIFY_LOCAL_SCRIPT" stop 2>/dev/null || true
        sleep 1
      else
        log_success "Unity Coordinator runtime already running (assistant=$coordinator_agent_id)"
        return 0
      fi
    fi
    if declare -F self_host_runtime_owner_for_pid &>/dev/null; then
      local running_pid
      running_pid="$(cat /tmp/unity-local.pid 2>/dev/null || true)"
      if [[ "$(self_host_runtime_owner_for_pid "$running_pid")" == "${SELF_HOST_RUNTIME_OWNER_SERVICE:-service}" \
        && "$runtime_owner" != "${SELF_HOST_RUNTIME_OWNER_SERVICE:-service}" \
        && "${UNIFY_ALLOW_RUNTIME_STOP:-0}" != "1" ]]; then
        log_error "Coordinator CM is owned by the runtime service (assistant=$running_id)"
        log_info "Stop it with: unity service stop"
        return 1
      fi
    fi
    log_info "Restarting Unity for Coordinator assistant=$coordinator_agent_id ..."
    UNIFY_STACK_ORCHESTRATOR=console-local-harness UNIFY_ALLOW_RUNTIME_STOP=1 bash "$UNIFY_LOCAL_SCRIPT" stop 2>/dev/null || true
    sleep 1
  fi

  log_info "Starting Unity for Coordinator assistant=$coordinator_agent_id ..."

  load_self_host_runtime_env

  if self_host_desktop_enabled && [[ -n "${SELF_HOST_DESKTOP_SCRIPT:-}" && -f "$SELF_HOST_DESKTOP_SCRIPT" ]]; then
    export ORCHESTRA_URL="${ORCHESTRA_URL:-http://127.0.0.1:${ORCHESTRA_PORT:-8000}/v0}"
    if ! bash "$SELF_HOST_DESKTOP_SCRIPT" ensure "$coordinator_agent_id" "$unify_key"; then
      log_error "Self-host desktop failed to start"
      return 1
    fi
  fi

  local service_gateway_url=""
  if [[ "${UNIFY_SERVICE_RUNTIME:-0}" == "1" ]]; then
    ensure_service_gateway || return 1
    if declare -F self_host_gateway_base_url &>/dev/null; then
      service_gateway_url="$(self_host_gateway_base_url)"
    else
      service_gateway_url="http://${UNIFY_GATEWAY_HOST:-127.0.0.1}:${UNIFY_GATEWAY_PORT:-8001}"
    fi
  fi

  local unity_env=(
    PUBSUB_EMULATOR_HOST="$LOCAL_PUBSUB_HOST"
    GCP_PROJECT_ID="$PUBSUB_GCP_PROJECT_ID"
    ASSISTANT_ID="$coordinator_agent_id"
    DEPLOY_ENV="staging"
    SELF_HOST=1
    UNIFY_KEY="$unify_key"
    SHARED_UNIFY_KEY="$unify_key"
    ASSISTANT_IS_COORDINATOR=True
    EVENTBUS_PUBLISHING_ENABLED="${EVENTBUS_PUBLISHING_ENABLED:-true}"
    EVENTBUS_PUBSUB_STREAMING="${EVENTBUS_PUBSUB_STREAMING:-true}"
    UNIFY_LOCAL_SCHEDULER="${UNIFY_LOCAL_SCHEDULER:-true}"
    UNIFY_RUNTIME_OWNER="$runtime_owner"
    # The CM spawns subprocesses (rclone, agent tooling) while gRPC channels
    # are live; gRPC's fork handlers log a warning on every spawn, flooding
    # /tmp/unity-local.log. Only errors are actionable here.
    GRPC_VERBOSITY="${GRPC_VERBOSITY:-ERROR}"
  )

  if [[ -n "${ORCHESTRA_PORT:-}" ]]; then
    unity_env+=(ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}/v0")
  fi

  unity_env+=(
    "UNIFY_COMMS_URL=${service_gateway_url:-${CHAT_COMMS_URL:-${CHAT_ADAPTERS_URL:-http://127.0.0.1:8001}}}"
    "UNIFY_ADAPTERS_URL=${service_gateway_url:-${CHAT_ADAPTERS_URL:-http://127.0.0.1:8001}}"
  )

  local _voice_provider _voice_id
  _voice_provider=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT COALESCE(voice_provider, '') FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  _voice_id=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT COALESCE(voice_id, '') FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  [[ -n "$_voice_provider" ]] && unity_env+=("VOICE_PROVIDER=$_voice_provider")
  [[ -n "$_voice_id" ]] && unity_env+=("VOICE_ID=$_voice_id")

  for key in OPENAI_API_KEY ANTHROPIC_API_KEY DEEPSEEK_API_KEY ORCHESTRA_ADMIN_KEY DEEPGRAM_API_KEY CARTESIA_API_KEY; do
    local val="${!key:-}"
    if [[ -z "$val" && -f "$ENV_LOCAL" ]]; then
      val=$(grep -E "^${key}=" "$ENV_LOCAL" 2>/dev/null | sed 's/^[^=]*=//' | tr -d '"' || true)
    fi
    if [[ -n "$val" ]]; then
      unity_env+=("$key=$val")
    fi
  done

  if [[ -f "$SELF_HOST_ENV_SCRIPT" ]]; then
    # shellcheck disable=SC1090
    source "$SELF_HOST_ENV_SCRIPT"
    append_self_host_unity_runtime_env unity_env
  fi

  local _a_first _a_surname _a_about _a_age _a_nat _a_tz _u_first _u_last _u_email _u_id _u_phone _u_whatsapp
  _u_first=""
  _u_last=""
  _u_email=""
  _u_phone=""
  _u_whatsapp=""
  _a_first=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT first_name FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  _a_surname=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT surname FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  _a_about=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT about FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  _a_age=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT age FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  _a_nat=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT nationality FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  _a_tz=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT timezone FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  _u_id=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
    -c "SELECT user_id FROM assistants WHERE agent_id = $coordinator_agent_id;" 2>/dev/null || echo "")
  if [[ -n "$_u_id" ]]; then
    _u_first=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT name FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
    _u_last=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT last_name FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
    _u_email=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT email FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
    _u_phone=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT phone_number FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
    _u_whatsapp=$(docker exec orchestra-local-db psql -U orchestra -d orchestra -t -A \
      -c "SELECT whatsapp_number FROM \"user\" WHERE id = '$_u_id';" 2>/dev/null || echo "")
  fi

  [[ -n "$_a_first" ]]   && unity_env+=("ASSISTANT_FIRST_NAME=$_a_first")
  [[ -n "$_a_surname" ]] && unity_env+=("ASSISTANT_SURNAME=$_a_surname")
  [[ -n "$_a_about" ]]   && unity_env+=("ASSISTANT_ABOUT=$_a_about")
  [[ -n "$_a_age" ]]     && unity_env+=("ASSISTANT_AGE=$_a_age")
  [[ -n "$_a_nat" ]]     && unity_env+=("ASSISTANT_NATIONALITY=$_a_nat")
  [[ -n "$_a_tz" ]]      && unity_env+=("ASSISTANT_TIMEZONE=$_a_tz")
  [[ -n "$_u_first" ]]   && unity_env+=("USER_FIRST_NAME=$_u_first")
  [[ -n "$_u_last" ]]    && unity_env+=("USER_SURNAME=$_u_last")
  [[ -n "$_u_email" ]]   && unity_env+=("USER_EMAIL=$_u_email")
  [[ -n "$_u_id" ]]      && unity_env+=("USER_ID=$_u_id")
  [[ -n "$_u_phone" ]]    && unity_env+=("USER_NUMBER=$_u_phone")
  [[ -n "$_u_whatsapp" ]] && unity_env+=("USER_WHATSAPP_NUMBER=$_u_whatsapp")

  if self_host_desktop_enabled; then
    unity_env+=("ASSISTANT_DESKTOP_URL=${SELF_HOST_DESKTOP_URL:-http://127.0.0.1:8090}")
  fi

  export ORCHESTRA_URL="${ORCHESTRA_URL:-http://127.0.0.1:${ORCHESTRA_PORT:-8000}/v0}"
  export ORCHESTRA_ADMIN_KEY="${ORCHESTRA_ADMIN_KEY:-${ADMIN_KEY:-}}"
  if declare -F self_host_apply_user_desktops_export &>/dev/null; then
    self_host_apply_user_desktops_export "$coordinator_agent_id"
  elif [[ -f "${SELF_HOST_ENV_SCRIPT:-}" ]]; then
    # shellcheck source=/dev/null
    source "$SELF_HOST_ENV_SCRIPT"
    UNIFY_REPO="$UNIFY_REPO_PATH" self_host_apply_user_desktops_export "$coordinator_agent_id"
  fi

  if ! env UNIFY_STACK_ORCHESTRATOR=console-local-harness "${unity_env[@]}" bash "$UNIFY_LOCAL_SCRIPT" start --full; then
    log_warn "Unity failed to start — chat will not get Coordinator replies"
    return 1
  fi

  local cm_pid
  cm_pid="$(cat /tmp/unity-local.pid 2>/dev/null || true)"
  if [[ -n "$cm_pid" ]]; then
    self_host_write_runtime_state "$runtime_owner" "$cm_pid" "$coordinator_agent_id"
  fi

  log_success "Unity Coordinator runtime is running (assistant=$coordinator_agent_id)"

  if self_host_desktop_enabled && [[ -n "${SELF_HOST_DESKTOP_SCRIPT:-}" && -f "$SELF_HOST_DESKTOP_SCRIPT" ]]; then
    sleep 8
    if ! bash "$SELF_HOST_DESKTOP_SCRIPT" publish-ready "$coordinator_agent_id"; then
      log_warn "Failed to publish assistant_desktop_ready — file sync and liveview may stay pending"
    else
      log_success "Published assistant_desktop_ready for desktop at ${SELF_HOST_DESKTOP_URL:-http://127.0.0.1:8090}"
    fi
  fi
}

cmd_ensure_coordinator_topics() {
  export SELF_HOST=1
  load_self_host_runtime_env
  _load_self_host_coordinator_credentials

  local unify_key="${SELF_HOST_UNIFY_KEY:-}"
  local coordinator_id="${SELF_HOST_COORDINATOR_AGENT_ID:-}"

  if [[ -z "$coordinator_id" ]]; then
    log_error "Coordinator agent_id is required"
    log_info "Register or sign in at /login first, or set SELF_HOST_COORDINATOR_AGENT_ID."
    return 1
  fi

  if ! is_emulator_running; then
    log_error "Pub/Sub emulator is not running — start the stack first (unity stack up)"
    return 1
  fi

  if ! ensure_assistant_pubsub_topics "$coordinator_id"; then
    return 1
  fi

  if [[ "${UNIFY_INBOUND_SUB_RECREATED:-0}" == "1" ]]; then
    if [[ -z "$unify_key" ]]; then
      log_warn "Inbound subscription recreated — sign in and run start-coordinator to refresh CM ingress"
    else
      refresh_coordinator_ingress_if_running "$unify_key" "$coordinator_id" || return 1
    fi
  fi
}

cmd_start_coordinator() {
  export SELF_HOST=1
  load_self_host_runtime_env
  _load_self_host_coordinator_credentials

  local unify_key="${SELF_HOST_UNIFY_KEY:-}"
  local coordinator_id="${SELF_HOST_COORDINATOR_AGENT_ID:-}"

  if [[ -z "$unify_key" || -z "$coordinator_id" ]]; then
    log_error "Coordinator runtime credentials missing."
    log_info "Register or sign in at /login first, or set SELF_HOST_UNIFY_KEY and SELF_HOST_COORDINATOR_AGENT_ID."
    return 1
  fi

  if ! is_orchestra_running; then
    log_error "Orchestra is not running — start the stack first (unity stack up)"
    return 1
  fi

  if ! is_emulator_running; then
    log_error "Pub/Sub emulator is not running — start the stack first (unity stack up)"
    return 1
  fi

  if declare -F self_host_apply_service_coordinator_context &>/dev/null; then
    self_host_apply_service_coordinator_context
  fi

  if is_unity_running; then
    local running_id=""
    running_id="$(_running_coordinator_agent_id 2>/dev/null || true)"
    if [[ "$running_id" == "$coordinator_id" ]]; then
      if declare -F self_host_adopt_coordinator_for_service &>/dev/null \
        && declare -F self_host_service_is_enabled &>/dev/null \
        && self_host_service_is_enabled \
        && declare -F self_host_service_supervisor_is_running &>/dev/null \
        && self_host_service_supervisor_is_running; then
        self_host_adopt_coordinator_for_service "$coordinator_id" || true
      fi
      log_success "Coordinator runtime already running (assistant=$coordinator_id)"
      return 0
    fi
  fi

  if ! ensure_assistant_pubsub_topics "$coordinator_id"; then
    return 1
  fi

  start_unity_coordinator "$unify_key" "$coordinator_id"
}

cmd_start_runtime_backend() {
  export SELF_HOST=1
  export UNIFY_SERVICE_RUNTIME=1
  export UNIFY_RUNTIME_OWNER="${SELF_HOST_RUNTIME_OWNER_SERVICE:-service}"
  load_self_host_runtime_env

  local unify_key=""
  local coordinator_id=""
  local runtime_file="${SELF_HOST_COORDINATOR_RUNTIME_FILE:-${UNIFY_HOME:-$HOME/.unity}/coordinator-runtime.json}"

  if [[ -f "$runtime_file" ]]; then
    unify_key="$(self_host_load_coordinator_credentials "$runtime_file" | sed -n '1p')"
    coordinator_id="$(self_host_load_coordinator_credentials "$runtime_file" | sed -n '2p')"
  fi

  if [[ -z "$unify_key" || -z "$coordinator_id" ]]; then
    log_warn "Coordinator credentials missing — register at Console (/login) first"
    return 1
  fi

  if ! is_orchestra_running; then
    start_orchestra false || return 1
  fi

  ensure_service_gateway || return 1

  if ! is_emulator_running; then
    log_info "Pub/Sub emulator not running — Coordinator CM deferred until unity stack up"
    return 0
  fi

  if is_unity_running; then
    local running_id=""
    running_id="$(_running_coordinator_agent_id 2>/dev/null || true)"
    if [[ "$running_id" == "$coordinator_id" ]]; then
      local cm_pid=""
      cm_pid="$(cat /tmp/unity-local.pid 2>/dev/null || true)"
      if [[ -n "$cm_pid" ]]; then
        self_host_write_runtime_state \
          "${SELF_HOST_RUNTIME_OWNER_SERVICE:-service}" \
          "$cm_pid" \
          "$coordinator_id"
      fi
      if declare -F self_host_gateway_is_healthy &>/dev/null \
        && ! self_host_gateway_is_healthy; then
        log_warn "Service gateway unhealthy — restarting gateway"
        export UNIFY_RUNTIME_GATEWAY_OWNER="${SELF_HOST_RUNTIME_OWNER_SERVICE:-service}"
        UNIFY_STACK_ORCHESTRATOR=console-local-harness bash "$UNIFY_LOCAL_SCRIPT" start-gateway || return 1
      fi
      return 0
    fi
  fi

  if is_emulator_running; then
    ensure_assistant_pubsub_topics "$coordinator_id" || true
  fi
  start_unity_coordinator "$unify_key" "$coordinator_id"
}

cmd_stop_runtime_backend() {
  export SELF_HOST=1
  load_self_host_runtime_env
  export UNIFY_ALLOW_RUNTIME_STOP=1

  if is_unity_available && is_unity_running; then
    log_info "Stopping service-managed Coordinator runtime..."
    UNIFY_STACK_ORCHESTRATOR=console-local-harness bash "$UNIFY_LOCAL_SCRIPT" stop 2>/dev/null || true
  fi
  self_host_clear_runtime_state

  if is_orchestra_running && ! is_console_running; then
    stop_orchestra
  fi
}

create_seeded_assistant_topics() {
  local emulator_host="$LOCAL_PUBSUB_HOST"
  local project_id="$PUBSUB_GCP_PROJECT_ID"
  local suffix="$PUBSUB_TOPIC_SUFFIX_VAL"

  if [[ -z "$emulator_host" ]]; then
    return 0
  fi

  local emulator_url="$emulator_host"
  if [[ ! "$emulator_url" =~ ^http ]]; then
    emulator_url="http://$emulator_url"
  fi

  # Query assistant agent_ids directly from the local Orchestra database.
  local agent_ids
  agent_ids=$(docker exec orchestra-local-db \
    psql -U orchestra -d orchestra -t -A \
    -c "SELECT agent_id FROM assistants;" 2>/dev/null | tr '\n' ' ' || echo "")

  if [[ -z "$agent_ids" ]]; then
    log_warn "No assistant agentIds found — skipping topic creation"
    return 0
  fi

  log_info "Creating Pub/Sub topics for seeded assistants ..."
  for agent_id in $agent_ids; do
    create_assistant_pubsub_topics "$agent_id" || true
  done
}

create_seeded_billing_topics() {
  local emulator_host="$LOCAL_PUBSUB_HOST"
  local project_id="$PUBSUB_GCP_PROJECT_ID"
  local suffix="$PUBSUB_TOPIC_SUFFIX_VAL"

  if [[ -z "$emulator_host" ]]; then
    return 0
  fi

  local emulator_url="$emulator_host"
  if [[ ! "$emulator_url" =~ ^http ]]; then
    emulator_url="http://$emulator_url"
  fi

  local ba_ids
  ba_ids=$(docker exec orchestra-local-db \
    psql -U orchestra -d orchestra -tAc \
    "SELECT id FROM billing_account;" 2>/dev/null | tr '\n' ' ' || echo "")

  if [[ -z "$ba_ids" ]]; then
    return 0
  fi

  log_info "Creating Pub/Sub billing topics for seeded accounts..."
  for ba_id in $ba_ids; do
    local topic_name="billing-account-${ba_id}${suffix}"
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PUT "${emulator_url}/v1/projects/${project_id}/topics/${topic_name}" 2>/dev/null || echo "000")

    if [[ "$status" == "200" || "$status" == "409" ]]; then
      log_success "Billing topic ready: $topic_name"
    else
      log_warn "Failed to create billing topic $topic_name (HTTP $status)"
    fi
  done
}

# =============================================================================
# NPM Dependencies
# =============================================================================

ensure_npm_deps() {
  cd "$CONSOLE_REPO_PATH"
  if [[ ! -d "node_modules" ]]; then
    log_info "Running npm install..."
    npm install --silent
  fi
}

# =============================================================================
# Modular Seed Scenarios (TypeScript-based)
# =============================================================================

# Valid seed scenario names — must match SCENARIOS in src/tests/helpers/seeds/run.ts.
VALID_SEED_SCENARIOS=(personal-workspace personal-workspace-multi sidebar-team-grouping org-basic org-multi-role org-unify credit-grant-links referrals billing-banner-states manual-topup managed-billing usage-ledger chat-search brain-rich tasks-rich secrets-rich re-appraisal all)

validate_seed_scenario() {
  local scenario="$1"
  if [[ -z "$scenario" ]]; then
    return 0  # no scenario requested = nothing to validate
  fi

  for valid in "${VALID_SEED_SCENARIOS[@]}"; do
    if [[ "$scenario" == "$valid" ]]; then
      return 0
    fi
  done

  log_error "Unknown seed scenario: '$scenario'"
  log_info "Valid scenarios: ${VALID_SEED_SCENARIOS[*]}"
  log_info "Run: npx tsx src/tests/helpers/seeds/run.ts --list"
  return 1
}

run_seed_scenario() {
  local scenario="$1"
  log_info "Running seed scenario: $scenario ..."

  cd "$CONSOLE_REPO_PATH"

  # Make sure tsx is available (comes with devDependencies)
  if ! npx --yes tsx --version &>/dev/null 2>&1; then
    log_error "tsx is not available — run 'npm install' first"
    return 1
  fi

  # Set env vars so the seed client can reach the local services
  export ORCHESTRA_DB_CONTAINER="orchestra-local-db"
  export NEXT_PUBLIC_BASE_URL="http://localhost:${CONSOLE_PORT}"
  export ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}"
  export ORCHESTRA_REPO_PATH="$ORCHESTRA_REPO_PATH"
  export ORCHESTRA_ADMIN_KEY="$ADMIN_KEY"

  if npx tsx src/tests/helpers/seeds/run.ts "$scenario"; then
    log_success "Seed scenario '$scenario' completed"
  else
    log_error "Seed scenario '$scenario' failed"
    return 1
  fi

  # Ensure the "Assistants" project exists in Orchestra. The seed should
  # create it via seedChatInfrastructure, but we double-check here as a
  # safety net (e.g. if Orchestra was restarted after a prior seed).
  local seed_key
  seed_key=$(docker exec orchestra-local-db \
    psql -U orchestra -d orchestra -t -A \
    -c "SELECT k.key FROM api_key k JOIN \"user\" u ON k.user_id = u.id ORDER BY k.id LIMIT 1;" 2>/dev/null | head -1 || echo "")
  if [[ -n "$seed_key" ]]; then
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST -H "Authorization: Bearer $seed_key" -H "Content-Type: application/json" \
      -d '{"name":"Assistants"}' \
      "http://127.0.0.1:${ORCHESTRA_PORT}/v0/project" 2>/dev/null || echo "000")
    if [[ "$status" == "200" || "$status" == "400" ]]; then
      log_success "Assistants project ensured"
    else
      log_warn "Could not ensure Assistants project (HTTP $status)"
    fi
  fi
}

# =============================================================================
# Provider Integration Bootstrap
# =============================================================================

setup_provider_integrations() {
  local provider="${1:-composio}"
  if [[ "$provider" != "composio" && "$provider" != "pipedream" ]]; then
    log_error "Unsupported provider integration bootstrap: $provider"
    log_info "Supported providers: composio, pipedream"
    return 1
  fi

  if [[ "$provider" == "composio" ]]; then
    local composio_key="${COMPOSIO_API_KEY:-$(read_env_value COMPOSIO_API_KEY "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
    if [[ -z "$composio_key" ]]; then
      log_error "COMPOSIO_API_KEY is required for --integrations --provider composio"
      log_info "Add COMPOSIO_API_KEY to .env.local or export it before running this script."
      return 1
    fi
    export COMPOSIO_API_KEY="$composio_key"
  fi
  if [[ "$provider" == "pipedream" ]]; then
    local pipedream_client_id="${PIPEDREAM_CLIENT_ID:-$(read_env_value PIPEDREAM_CLIENT_ID "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
    local pipedream_client_secret="${PIPEDREAM_CLIENT_SECRET:-$(read_env_value PIPEDREAM_CLIENT_SECRET "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
    local pipedream_project_id="${PIPEDREAM_PROJECT_ID:-$(read_env_value PIPEDREAM_PROJECT_ID "$ENV_LOCAL" "$ENV_DEVELOPMENT" "$ENV_DEFAULT")}"
    if [[ -z "$pipedream_client_id" || -z "$pipedream_client_secret" || -z "$pipedream_project_id" ]]; then
      log_error "PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, and PIPEDREAM_PROJECT_ID are required for --integrations --provider pipedream"
      log_info "Add them to .env.local or export them before running this script."
      return 1
    fi
    export PIPEDREAM_CLIENT_ID="$pipedream_client_id"
    export PIPEDREAM_CLIENT_SECRET="$pipedream_client_secret"
    export PIPEDREAM_PROJECT_ID="$pipedream_project_id"
  fi

  log_info "Configuring ${provider} provider backend..."
  local orchestra_base="http://127.0.0.1:${ORCHESTRA_PORT}/v0"
  local backend_status
  backend_status=$(curl -s -o "/tmp/console-${provider}-backend.json" -w "%{http_code}" \
    -X POST "${orchestra_base}/admin/integrations/backends" \
    -H "Authorization: Bearer ${ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"backend_id\": \"${provider}\",
      \"kind\": \"${provider}\",
      \"environment\": \"prod\",
      \"display_name\": \"${provider}\",
      \"status\": \"enabled\",
      \"default_priority\": 10,
      \"config_json\": {
        \"timeout_seconds\": 30,
        \"max_pages\": 100,
        \"max_items\": 10000
      }
    }" 2>/dev/null || echo "000")
  if [[ "$backend_status" != "200" ]]; then
    log_error "Failed to upsert ${provider} backend (HTTP $backend_status)"
    [[ -f "/tmp/console-${provider}-backend.json" ]] && sed 's/^/  /' "/tmp/console-${provider}-backend.json" || true
    return 1
  fi

  log_info "Syncing ${provider} partial catalog..."
  local sync_status
  if [[ "$provider" == "composio" ]]; then
    sync_status=$(curl -s -o /tmp/console-composio-sync.json -w "%{http_code}" \
      -X POST "${orchestra_base}/admin/integrations/sync" \
      -H "Authorization: Bearer ${ADMIN_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "backend_id": "composio",
        "app_slugs": ["GMAIL", "SLACK", "HUBSPOT"],
        "tool_limit_per_app": 50,
        "include_all_managed_apps": false,
        "create_auth_configs": true,
        "cache_version": "local-composio-partial"
      }' 2>/dev/null || echo "000")
  else
    sync_status=$(curl -s -o /tmp/console-pipedream-sync.json -w "%{http_code}" \
      -X POST "${orchestra_base}/admin/integrations/sync" \
      -H "Authorization: Bearer ${ADMIN_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "backend_id": "pipedream",
        "app_slugs": ["slack", "github", "hubspot"],
        "component_limit_per_app": 50,
        "include_all_apps": false,
        "cache_version": "local-pipedream-partial"
      }' 2>/dev/null || echo "000")
  fi
  if [[ "$sync_status" != "200" ]]; then
    log_error "Failed to sync ${provider} catalog (HTTP $sync_status)"
    [[ -f "/tmp/console-${provider}-sync.json" ]] && sed 's/^/  /' "/tmp/console-${provider}-sync.json" || true
    return 1
  fi
  log_success "${provider} catalog sync complete"
  sed 's/^/  /' "/tmp/console-${provider}-sync.json" || true
}

sync_local_integration_functions() {
  local apps="${LOCAL_INTEGRATION_FUNCTION_SYNC_APPS:-discord,slack,gmail,google_calendar,github,linear,salesforce}"
  log_info "Warming local-only FunctionManager integration primitives for active apps: $apps"
  log_warn "This shortcut is for local experimentation only; inactive apps remain hidden until connected."

  cd "$CONSOLE_REPO_PATH"
  export ORCHESTRA_DB_CONTAINER="orchestra-local-db"
  export ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}"
  export LOCAL_INTEGRATION_FUNCTION_SYNC_APPS="$apps"

  if npx tsx src/tests/helpers/seeds/sync-integration-functions.ts; then
    log_success "Local integration FunctionManager shortcut completed"
  else
    log_error "Local integration FunctionManager shortcut failed"
    return 1
  fi
}

start_local_integration_functions_sync() {
  local apps="${LOCAL_INTEGRATION_FUNCTION_SYNC_APPS:-discord,slack,gmail,google_calendar,github,linear,salesforce}"
  local log_file="/tmp/console-integration-functions-sync.log"

  log_info "Starting local integration FunctionManager warmup in the background for active apps: $apps"
  (
    cd "$CONSOLE_REPO_PATH" || exit 1
    export ORCHESTRA_DB_CONTAINER="orchestra-local-db"
    export ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}"
    export LOCAL_INTEGRATION_FUNCTION_SYNC_APPS="$apps"
    npx tsx src/tests/helpers/seeds/sync-integration-functions.ts
  ) >"$log_file" 2>&1 &
  log_success "Local integration FunctionManager warmup started (PID $!, log: $log_file)"
}

# =============================================================================
# Console Management
# =============================================================================

is_console_running() {
  if [[ -f "$CONSOLE_PIDFILE" ]]; then
    local pid
    pid=$(cat "$CONSOLE_PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$CONSOLE_PIDFILE"
  fi
  # Also check if something is listening on the port
  [[ -n "$(console_port_pids)" ]]
}

console_port_pids() {
  {
    if command -v lsof &>/dev/null; then
      lsof -t -i ":${CONSOLE_PORT}" -sTCP:LISTEN 2>/dev/null | sed 's/[^0-9].*$//' || true
      printf '\n'
    fi
    if command -v fuser &>/dev/null; then
      fuser "${CONSOLE_PORT}/tcp" 2>/dev/null | tr -cs '0-9' '\n' || true
      printf '\n'
    fi
    if command -v ss &>/dev/null; then
      ss -ltnp "sport = :${CONSOLE_PORT}" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' || true
      printf '\n'
    fi
  } | sed -n '/^[0-9][0-9]*$/p' | sort -u
}

wait_for_console_port_to_clear() {
  local attempts=10
  local attempt=0
  while (( attempt < attempts )); do
    if [[ -z "$(console_port_pids)" ]]; then
      return 0
    fi
    sleep 1
    ((attempt++)) || true
  done
  return 1
}

console_log_has_startup_failure() {
  grep -Eq "EADDRINUSE|Failed to start server|Error: listen" "$CONSOLE_LOGFILE" 2>/dev/null
}

console_log_has_ready_signal() {
  grep -Eq "Ready in|Local:|started server|Next.js .*ready" "$CONSOLE_LOGFILE" 2>/dev/null
}

start_console() {
  local with_pubsub="${1:-false}"
  local with_chat="${2:-false}"
  local with_self_host="${3:-false}"

  # Kill any stale Console processes on the port before checking, so we
  # always start fresh with the correct environment variables.
  local stale_pids
  stale_pids=$(console_port_pids)
  if [[ -n "$stale_pids" ]]; then
    log_info "Cleaning up stale processes on port $CONSOLE_PORT ..."
    echo "$stale_pids" | xargs kill 2>/dev/null || true
    if ! wait_for_console_port_to_clear; then
      stale_pids=$(console_port_pids)
      if [[ -n "$stale_pids" ]]; then
        echo "$stale_pids" | xargs kill -9 2>/dev/null || true
      fi
    fi
    if ! wait_for_console_port_to_clear; then
      log_error "Port $CONSOLE_PORT is still in use; cannot start Console safely."
      log_info "Processes still listening on port $CONSOLE_PORT:"
      if command -v lsof &>/dev/null; then
        lsof -i ":${CONSOLE_PORT}" -sTCP:LISTEN || true
      else
        console_port_pids || true
      fi
      return 1
    fi
    rm -f "$CONSOLE_PIDFILE"
  fi

  if is_console_running; then
    log_success "Console already running on port $CONSOLE_PORT"
    return 0
  fi

  log_info "Starting Console on port $CONSOLE_PORT ..."

  cd "$CONSOLE_REPO_PATH"

  # Override NEXTAUTH_URL so server actions (which make server-to-server
  # fetch calls to Console's own API routes) reach the correct port.
  export NEXTAUTH_URL="http://localhost:${CONSOLE_PORT}"
  export ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}"

  # When running locally without --pubsub/--chat, override the staging
  # Pub/Sub credentials that .env.development defines so Console uses the
  # local in-memory event bus (enables the /actions/push dev endpoint).
  # process.env takes precedence over .env files in Next.js.
  if [[ "$with_pubsub" != "true" && "$with_chat" != "true" ]]; then
    export COMMS_SERVICE_ACCOUNT_CREDENTIALS=""
  fi

  # When --pubsub or --chat is active, inject the Pub/Sub emulator env vars
  # so Console connects to the local emulator for billing events (and chat).
  if [[ "$with_pubsub" == "true" || "$with_chat" == "true" ]]; then
    export PUBSUB_EMULATOR_HOST="$LOCAL_PUBSUB_HOST"
    export GCP_PROJECT_ID="$PUBSUB_GCP_PROJECT_ID"
    export PUBSUB_TOPIC_SUFFIX="$PUBSUB_TOPIC_SUFFIX_VAL"

    log_info "Console Pub/Sub env vars set:"
    log_info "  PUBSUB_EMULATOR_HOST=$PUBSUB_EMULATOR_HOST"
    log_info "  GCP_PROJECT_ID=$GCP_PROJECT_ID"
    log_info "  PUBSUB_TOPIC_SUFFIX=$PUBSUB_TOPIC_SUFFIX"

    if [[ "$with_chat" == "true" && -n "$CHAT_ADAPTERS_URL" ]]; then
      export COMMUNICATION_URL="$CHAT_ADAPTERS_URL"
      export LOCAL_ADAPTERS_URL="$CHAT_ADAPTERS_URL"
      export UNIFY_ADAPTERS_URL="$CHAT_ADAPTERS_URL"
      log_info "  COMMUNICATION_URL=$COMMUNICATION_URL"
      log_info "  LOCAL_ADAPTERS_URL=$LOCAL_ADAPTERS_URL"
      log_info "  UNIFY_ADAPTERS_URL=$UNIFY_ADAPTERS_URL"
    fi
  fi

  if [[ "$with_self_host" == "true" ]]; then
    export SELF_HOST=1
    export NEXT_PUBLIC_SELF_HOST=1
    export NEXT_PUBLIC_CONSOLE_DEBUG=true
    export SELF_HOST_DEPLOY_EPOCH="${SELF_HOST_DEPLOY_EPOCH:-$(date +%s)}"
    export NEXT_PUBLIC_SELF_HOST_DEPLOY_EPOCH="$SELF_HOST_DEPLOY_EPOCH"
    # Persist the topology flags durably so a later bare `npm run dev` (which
    # does not pass --self-host) still resolves as a self-host deployment.
    upsert_env_local_var "$ENV_LOCAL" SELF_HOST 1
    upsert_env_local_var "$ENV_LOCAL" NEXT_PUBLIC_SELF_HOST 1
    upsert_env_local_var "$ENV_LOCAL" NEXT_PUBLIC_CONSOLE_DEBUG true
    upsert_env_local_var "$ENV_LOCAL" SELF_HOST_DEPLOY_EPOCH "$SELF_HOST_DEPLOY_EPOCH"
    upsert_env_local_var "$ENV_LOCAL" NEXT_PUBLIC_SELF_HOST_DEPLOY_EPOCH "$SELF_HOST_DEPLOY_EPOCH"
    export SELF_HOST_DESKTOP_URL="${SELF_HOST_DESKTOP_URL:-http://127.0.0.1:8090}"
    # The browser session should resume with the self-host owner key, not any
    # unrelated shell value.
    unset SHARED_UNIFY_KEY
    load_self_host_runtime_env
    local _runtime_file="${SELF_HOST_COORDINATOR_RUNTIME_FILE:-${UNIFY_HOME:-$HOME/.unity}/coordinator-runtime.json}"
    # Console expects ORCHESTRA_URL without a /v0 suffix; self-host env must not override.
    export ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}"
    if [[ -f "$_runtime_file" ]]; then
      local _resume_key
      _resume_key="$(python3 - "$_runtime_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    data = json.load(fh)
print(data.get("apiKey") or data.get("api_key") or "")
PY
)" || true
      if [[ -n "$_resume_key" ]]; then
        export SHARED_UNIFY_KEY="$_resume_key"
      fi
    fi
    log_info "Console self-host env:"
    log_info "  SELF_HOST=1"
    log_info "  NEXT_PUBLIC_CONSOLE_DEBUG=true"
    log_info "  SELF_HOST_DESKTOP_URL=$SELF_HOST_DESKTOP_URL"
    log_info "  LIVEKIT_URL=$LIVEKIT_URL"
    if [[ -n "$CHAT_ADAPTERS_URL" ]]; then
      export COMMUNICATION_URL="$CHAT_ADAPTERS_URL"
      export LOCAL_ADAPTERS_URL="$CHAT_ADAPTERS_URL"
      export UNIFY_ADAPTERS_URL="$CHAT_ADAPTERS_URL"
      export UNIFY_COMMS_URL="${CHAT_COMMS_URL:-$CHAT_ADAPTERS_URL}"
      log_info "  UNIFY_GATEWAY_URL=$CHAT_ADAPTERS_URL"
    fi
  fi

  write_console_env_fingerprint

  if command -v setsid &>/dev/null; then
    setsid env UNIFY_STACK_ORCHESTRATOR=console-local-harness npm run dev -- -p "$CONSOLE_PORT" -H 0.0.0.0 > "$CONSOLE_LOGFILE" 2>&1 < /dev/null &
  else
    nohup env UNIFY_STACK_ORCHESTRATOR=console-local-harness npm run dev -- -p "$CONSOLE_PORT" -H 0.0.0.0 > "$CONSOLE_LOGFILE" 2>&1 < /dev/null &
  fi
  local pid=$!
  echo "$pid" > "$CONSOLE_PIDFILE"

  log_info "Waiting for Console to be ready (PID $pid)..."

  local max_attempts=60
  local attempt=0
  while (( attempt < max_attempts )); do
    if console_log_has_startup_failure; then
      rm -f "$CONSOLE_PIDFILE"
      log_error "Console failed during startup."
      if grep -q "EADDRINUSE" "$CONSOLE_LOGFILE" 2>/dev/null; then
        log_error "Port $CONSOLE_PORT is already in use."
        local listeners
        listeners=$(console_port_pids)
        if [[ -n "$listeners" ]]; then
          log_info "Processes listening on port $CONSOLE_PORT: $listeners"
        fi
      fi
      log_info "Check logs: $CONSOLE_LOGFILE"
      return 1
    fi
    if console_log_has_ready_signal && curl -s --connect-timeout 2 --max-time 5 "http://localhost:${CONSOLE_PORT}" &>/dev/null; then
      local listener_pids
      listener_pids=$(console_port_pids)
      if [[ -n "$listener_pids" ]]; then
        echo "$listener_pids" | head -1 > "$CONSOLE_PIDFILE"
      fi
      log_success "Console is ready at http://localhost:${CONSOLE_PORT}"
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$CONSOLE_PIDFILE"
      log_error "Console process exited before it became ready."
      if grep -q "EADDRINUSE" "$CONSOLE_LOGFILE" 2>/dev/null; then
        log_error "Port $CONSOLE_PORT is already in use."
      fi
      log_info "Check logs: $CONSOLE_LOGFILE"
      return 1
    fi
    sleep 1
    ((attempt++)) || true
  done

  log_error "Console failed to start within 60 seconds"
  log_info "Check logs: $CONSOLE_LOGFILE"
  kill "$pid" 2>/dev/null || true
  rm -f "$CONSOLE_PIDFILE"
  return 1
}

stop_console() {
  if [[ -f "$CONSOLE_PIDFILE" ]]; then
    local pid
    pid=$(cat "$CONSOLE_PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      log_info "Stopping Console (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$CONSOLE_PIDFILE"
  fi

  # Kill any remaining next-server processes on the port. In WSL, lsof can
  # miss Node listeners that ss/fuser still see, so use the shared detector.
  local port_pids
  port_pids=$(console_port_pids)
  if [[ -n "$port_pids" ]]; then
    log_info "Stopping remaining Console listener(s) on port $CONSOLE_PORT: $port_pids"
    echo "$port_pids" | xargs kill 2>/dev/null || true
    if ! wait_for_console_port_to_clear; then
      port_pids=$(console_port_pids)
      if [[ -n "$port_pids" ]]; then
        echo "$port_pids" | xargs kill -9 2>/dev/null || true
      fi
    fi
    if ! wait_for_console_port_to_clear; then
      log_error "Console port $CONSOLE_PORT is still occupied after stop."
      return 1
    fi
  fi

  log_success "Console stopped"
}

cmd_repair_console() {
  local with_self_host="${1:-false}"

  if [[ "$with_self_host" == "true" ]]; then
    export SELF_HOST=1
    export NEXT_PUBLIC_SELF_HOST=1
    export NEXT_PUBLIC_CONSOLE_DEBUG=true
    export NEXTAUTH_URL="http://localhost:${CONSOLE_PORT}"
    export ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}"
    export PUBSUB_EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-$LOCAL_PUBSUB_HOST}"
    export GCP_PROJECT_ID="${GCP_PROJECT_ID:-$PUBSUB_GCP_PROJECT_ID}"
    export PUBSUB_TOPIC_SUFFIX="${PUBSUB_TOPIC_SUFFIX:-$PUBSUB_TOPIC_SUFFIX_VAL}"
    export SELF_HOST_DESKTOP_URL="${SELF_HOST_DESKTOP_URL:-http://127.0.0.1:8090}"
    CHAT_ADAPTERS_URL="${CHAT_ADAPTERS_URL:-${LOCAL_ADAPTERS_URL:-${UNIFY_ADAPTERS_URL:-http://127.0.0.1:${UNIFY_GATEWAY_PORT:-8001}}}}"
    export CHAT_ADAPTERS_URL
    export COMMUNICATION_URL="${COMMUNICATION_URL:-$CHAT_ADAPTERS_URL}"
    export LOCAL_ADAPTERS_URL="${LOCAL_ADAPTERS_URL:-$CHAT_ADAPTERS_URL}"
    export UNIFY_ADAPTERS_URL="${UNIFY_ADAPTERS_URL:-$CHAT_ADAPTERS_URL}"
    export UNIFY_COMMS_URL="${UNIFY_COMMS_URL:-${CHAT_COMMS_URL:-$CHAT_ADAPTERS_URL}}"
    load_self_host_runtime_env
  fi

  log_info "Repairing Console on port $CONSOLE_PORT ..."
  stop_console
  if [[ -d "$CONSOLE_REPO_PATH/.next" ]]; then
    local stale_dir
    stale_dir="$CONSOLE_REPO_PATH/.next-stale-$(date +%s)"
    log_info "Moving stale Next cache to $stale_dir"
    mv "$CONSOLE_REPO_PATH/.next" "$stale_dir"
  fi
  start_console
}

# =============================================================================
# Stripe Webhook Forwarding (delegates to orchestra/scripts/stripe.sh)
# =============================================================================

is_stripe_listener_running() {
  pgrep -f "stripe listen.*localhost:${ORCHESTRA_PORT}" &>/dev/null
}

start_stripe_listener() {
  if ! command -v stripe &>/dev/null; then
    log_error "Stripe CLI is not installed"
    log_info "Install: brew install stripe/stripe-cli/stripe  (macOS)"
    log_info "  or:    see https://docs.stripe.com/stripe-cli#install"
    return 1
  fi

  if is_stripe_listener_running; then
    log_success "Stripe webhook listener already running"
    if [[ -f "$STRIPE_SECRET_FILE" ]]; then
      log_info "Webhook secret: $(cat "$STRIPE_SECRET_FILE")"
    fi
    return 0
  fi

  log_info "Starting Stripe webhook forwarding to Orchestra..."

  # Delegate to orchestra/scripts/stripe.sh bg (background mode)
  if [[ -f "$STRIPE_SCRIPT" ]]; then
    ORCHESTRA_PORT="$ORCHESTRA_PORT" STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" bash "$STRIPE_SCRIPT" bg
  else
    log_warn "stripe.sh not found at $STRIPE_SCRIPT — starting manually"

    local webhook_url="http://localhost:${ORCHESTRA_PORT}/v0/webhooks/stripe"
    local logfile="/tmp/stripe-listen-orchestra.log"
    rm -f "$logfile" "$STRIPE_SECRET_FILE"

    local api_key_flag=""
    if [[ -n "$STRIPE_SECRET_KEY" ]]; then
      api_key_flag="--api-key $STRIPE_SECRET_KEY"
    fi

    # shellcheck disable=SC2086
    nohup stripe listen \
      $api_key_flag \
      --forward-to "$webhook_url" \
      --device-name "console-local" \
      --events checkout.session.completed,invoice.payment_succeeded,invoice.paid,invoice.payment_failed,invoice.payment_action_required,charge.refunded,charge.refund.updated,charge.dispute.created,charge.dispute.funds_withdrawn,charge.dispute.closed,customer.tax_id.created,customer.tax_id.updated,customer.tax_id.deleted,customer.updated,review.opened,review.closed \
      > "$logfile" 2>&1 &

    log_info "Waiting for webhook secret..."
    local waited=0
    while (( waited < 10 )); do
      local secret
      secret=$(grep -o 'whsec_[a-zA-Z0-9]*' "$logfile" 2>/dev/null | head -1 || true)
      if [[ -n "$secret" ]]; then
        echo "$secret" > "$STRIPE_SECRET_FILE"
        break
      fi
      sleep 1
      ((waited++)) || true
    done
  fi

  if [[ -f "$STRIPE_SECRET_FILE" ]]; then
    log_success "Stripe webhook forwarding active"
    log_info "Webhook secret: $(cat "$STRIPE_SECRET_FILE")"
  else
    log_warn "Could not extract webhook secret — check: tail -f /tmp/stripe-listen-orchestra.log"
  fi
}

stop_stripe_listener() {
  if [[ -f "$STRIPE_SCRIPT" ]]; then
    ORCHESTRA_PORT="$ORCHESTRA_PORT" bash "$STRIPE_SCRIPT" stop 2>/dev/null || true
  else
    pkill -f "stripe listen.*localhost:${ORCHESTRA_PORT}" 2>/dev/null || true
  fi
  log_success "Stripe listener stopped"
}

# =============================================================================
# Main Commands
# =============================================================================

cmd_start() {
  local with_org="$1"
  local with_stripe="$2"
  local seed_scenario="$3"
  local with_chat="$4"
  local with_pubsub="$5"
  local with_integrations="${6:-false}"
  local integrations_provider="${7:-composio}"
  local unity_echo="${8:-false}"
  local with_integration_functions="${9:-false}"
  local with_self_host="${10:-false}"

  if [[ "$with_self_host" == "true" ]]; then
    with_chat="true"
    with_pubsub="true"
    export SELF_HOST=1
    load_self_host_runtime_env
  fi

  # Resolve effective seed scenario:
  #   --seed X  → X                     (explicit)
  #   --org     → org-basic             (convenience alias)
  #   (default) → personal-workspace
  if [[ -z "$seed_scenario" ]]; then
    if [[ "$with_self_host" == "true" ]]; then
      seed_scenario=""
    elif [[ "$with_org" == "true" ]]; then
      seed_scenario="org-basic"
    else
      seed_scenario="personal-workspace"
    fi
  fi

  # Validate seed scenario name early — before starting any services.
  if [[ -n "$seed_scenario" ]] && ! validate_seed_scenario "$seed_scenario"; then
    return 1
  fi

  local mode_label="self-host"
  if [[ "$with_self_host" != "true" ]]; then
    mode_label="seed:${seed_scenario:-personal-workspace}"
  fi
  if [[ "$with_stripe" == "true" ]]; then
    mode_label="$mode_label + stripe"
  fi
  if [[ "$with_pubsub" == "true" ]]; then
    mode_label="$mode_label + pubsub"
  fi
  if [[ "$with_chat" == "true" ]]; then
    mode_label="$mode_label + chat"
  fi
  if [[ "$with_integrations" == "true" ]]; then
    mode_label="$mode_label + integrations:${integrations_provider}"
  fi
  if [[ "$with_integration_functions" == "true" ]]; then
    mode_label="$mode_label + local integration functions"
  fi

  echo ""
  echo "=============================================="
  echo "  Starting Local Console + Orchestra ($mode_label)"
  echo "=============================================="
  echo ""

  if ! check_prerequisites; then
    return 1
  fi

  if [[ "$ADMIN_KEY_SOURCE" == "local fallback" ]]; then
    log_warn "ORCHESTRA_ADMIN_KEY not found in .env.local/.env.development/.env; using local-admin-key fallback."
    log_warn "If Orchestra was started manually with a different key, restart it through this script to realign auth."
  fi

  # Start the Pub/Sub emulator (Console-managed) early if --pubsub or --chat.
  if [[ "$with_pubsub" == "true" || "$with_chat" == "true" ]]; then
    echo ""
    if ! check_gcloud; then
      log_error "gcloud CLI required for Pub/Sub emulator"
      return 1
    fi
    if ! check_pubsub_emulator; then
      return 1
    fi
    echo ""
    start_pubsub_emulator || return 1
  fi

  # Self-host and --chat both route Console through unity.gateway.
  if [[ "$with_self_host" == "true" || "$with_chat" == "true" ]]; then
    echo ""
    if [[ "$with_self_host" == "true" ]]; then
      start_self_host_stack_gateway || return 1
    elif ! check_unity_gateway_prerequisites; then
      return 1
    else
      configure_unity_gateway_urls || return 1
    fi
  fi

  echo ""
  local restart_orchestra="false"
  if [[ "$with_self_host" == "true" ]] && is_orchestra_running; then
    if declare -F self_host_headless_scheduling_ready &>/dev/null \
      && self_host_headless_scheduling_ready; then
      log_info "Reusing Orchestra (background runtime still running)..."
    elif declare -F self_host_should_preserve_orchestra_on_interactive_stop &>/dev/null \
      && self_host_should_preserve_orchestra_on_interactive_stop; then
      log_info "Reusing Orchestra (background runtime still running)..."
    elif orchestra_listens_on_lan; then
      log_info "Reusing Orchestra (already reachable for self-host)..."
    else
      log_info "Restarting Orchestra so SELF_HOST=1 and gateway URLs apply..."
      restart_orchestra="true"
    fi
  fi
  if [[ "$restart_orchestra" == "true" ]]; then
    stop_orchestra
  fi
  start_orchestra "$with_stripe" || return 1

  if [[ "$with_self_host" == "true" ]]; then
    echo ""
    ensure_npm_deps
  else
    # Install npm deps early — seed scenarios need tsx.
    echo ""
    ensure_npm_deps

    # Seed before Console so data is available on first page load.
    echo ""
    if ! run_seed_scenario "$seed_scenario"; then
      # Non-fatal: E2E tests and provider integrations create their own data,
      # so a seed-scenario failure must not abort the local startup.
      log_warn "Seed scenario failed — continuing (tests/integrations seed their own data)"
    fi

    if [[ "$with_integrations" == "true" ]]; then
      echo ""
      setup_provider_integrations "$integrations_provider" || return 1
    fi
  fi

  # After seeding/bootstrap, create Pub/Sub topics for assistants.
  if [[ "$with_pubsub" == "true" || "$with_chat" == "true" ]] && is_emulator_running; then
    echo ""
    if [[ "$with_self_host" != "true" ]]; then
      create_seeded_billing_topics
    fi
    if [[ "$with_chat" == "true" && "$with_self_host" != "true" ]]; then
      create_seeded_assistant_topics
      echo ""
      start_unity "$unity_echo"
    fi
  fi

  echo ""
  start_console "$with_pubsub" "$with_chat" "$with_self_host" || return 1

  if [[ "$with_integration_functions" == "true" ]]; then
    echo ""
    if [[ "$with_integrations" != "true" ]]; then
      log_error "--integrations-functions requires --integrations so the provider catalog exists."
      return 1
    fi
    start_local_integration_functions_sync
  fi

  if [[ "$with_stripe" == "true" ]]; then
    echo ""
    start_stripe_listener || log_warn "Stripe listener failed — billing flows won't receive webhooks"
  fi

  echo ""
  echo "=============================================="
  log_success "Local environment is ready!"
  echo "=============================================="
  echo ""
  echo "  Console:   http://localhost:${CONSOLE_PORT}"
  echo "  Orchestra: http://127.0.0.1:${ORCHESTRA_PORT}/v0"
  if [[ "$with_stripe" == "true" ]]; then
    echo "  Stripe:    webhooks → http://localhost:${ORCHESTRA_PORT}/v0/webhooks/stripe"
  fi
  if [[ "$with_pubsub" == "true" || "$with_chat" == "true" ]]; then
    echo "  Pub/Sub:   $LOCAL_PUBSUB_HOST (emulator)"
  fi
  if [[ "$with_chat" == "true" ]]; then
    if [[ "$with_self_host" == "true" ]]; then
      echo "  Gateway:   ${CHAT_ADAPTERS_URL:-$(unity_gateway_base_url)}"
      echo "  Unity CM:  starts after register/login (or on next Console visit when signed in)"
    else
      echo "  Gateway:   ${CHAT_ADAPTERS_URL:-$(unity_gateway_base_url)}"
      echo "  Test asst: ${CHAT_TEST_ASSISTANT_ID:-default-test-assistant}"
    fi
  fi
  if [[ "$with_integrations" == "true" ]]; then
    echo "  Integrations: ${integrations_provider} catalog synced"
  fi
  if [[ "$with_integration_functions" == "true" ]]; then
    echo "  Functions:    active integration primitives warming in background"
  fi
  echo ""
  if [[ "$with_self_host" == "true" ]]; then
    echo "  Mode:      self-host (register on /login — no pre-seeded owner)"
    echo "  Unity CM:  starts automatically after register/login"
  else
    echo "  Seed:      $seed_scenario"
    echo "  Login:     Use the Quick Sign-In panel on the login page"
    echo "  Password:  testpass123"
  fi
  if [[ "$with_stripe" == "true" ]]; then
    echo ""
    echo "  Billing (Stripe test mode) — self-serve subscription journeys:"
    echo "    1. Open /billing, add a full billing address (needed for tax) → enables Subscribe."
    echo "    2. Subscribe (monthly or annual) → Stripe checkout → pay with a test card below."
    echo "       invoice.paid is forwarded back and credits are granted (shown ×400)."
    echo "    3. Change tier / cancel / let it renew to exercise upgrade, downgrade, cancel."
    echo ""
    echo "    Test cards (https://docs.stripe.com/testing):"
    echo "      4242 4242 4242 4242  success"
    echo "      4000 0000 0000 0341  attaches but fails on charge → invoice.payment_failed → PAST_DUE"
    echo "      4000 0027 6000 3184  requires 3DS authentication"
    echo "    Subscription + dispute events are forwarded (see orchestra/scripts/stripe.sh)."
  fi
  if [[ "$with_pubsub" == "true" && "$with_chat" != "true" ]]; then
    echo ""
    echo "  Pub/Sub:   Emulator running for real-time billing events."
    echo "             Billing topics created for all seeded accounts."
  fi
  if [[ "$with_chat" == "true" && "$with_self_host" != "true" ]]; then
    echo ""
    local unity_mode
    unity_mode=$(cat /tmp/unity-local.mode 2>/dev/null || echo "not running")
    echo "  Chat:      Console dispatches through the local Unity gateway."
    echo "             Unity mode: $unity_mode"
    if [[ "$unity_mode" == "echo" ]]; then
      echo "             Messages are echoed back (no LLM). Set API keys for real responses."
    elif [[ "$unity_mode" == "full-cm" ]]; then
      echo "             Full ConversationManager active — LLM-powered responses."
    fi
    echo "             To test, send a message to an assistant whose agentId"
    echo "             matches TEST_ASSISTANT_ID (${CHAT_TEST_ASSISTANT_ID:-default-test-assistant})."
  fi
  echo ""
}

cmd_stop() {
  local interactive_only="false"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --interactive-only) interactive_only="true"; shift ;;
      *) shift ;;
    esac
  done

  if [[ "$interactive_only" == "true" ]]; then
    export SELF_HOST=1
    load_self_host_runtime_env
  fi

  echo "Stopping local environment..."
  echo ""

  local failed=false
  local preserve_background="false"
  local preserve_cm="false"
  if [[ "$interactive_only" == "true" ]] \
    && declare -F self_host_should_preserve_background_on_interactive_stop &>/dev/null \
    && self_host_should_preserve_background_on_interactive_stop; then
    preserve_background="true"
  fi
  if [[ "$preserve_background" == "true" ]] \
    && declare -F self_host_should_preserve_runtime_on_interactive_stop &>/dev/null \
    && self_host_should_preserve_runtime_on_interactive_stop; then
    preserve_cm="true"
  fi

  if is_stripe_listener_running; then
    stop_stripe_listener || failed=true
  fi
  stop_console || failed=true
  if [[ "$preserve_background" != "true" ]]; then
    stop_orchestra || failed=true
  else
    log_info "Keeping Orchestra running (runtime service)"
  fi
  if is_unity_available && is_unity_running; then
    if [[ "$preserve_cm" == "true" ]]; then
      if declare -F self_host_adopt_coordinator_for_service &>/dev/null; then
        local preserved_assistant_id=""
        preserved_assistant_id="$(_running_coordinator_agent_id 2>/dev/null || true)"
        self_host_adopt_coordinator_for_service "$preserved_assistant_id" || true
      fi
      log_info "Keeping service-managed Coordinator runtime running"
    else
      stop_unity || failed=true
    fi
  fi
  if [[ "$preserve_background" != "true" ]] && is_unity_available; then
    UNIFY_STACK_ORCHESTRATOR=console-local-harness bash "$UNIFY_LOCAL_SCRIPT" stop-gateway 2>/dev/null || true
  fi
  if is_emulator_running && [[ "$preserve_background" != "true" ]]; then
    stop_pubsub_emulator || failed=true
  fi
  echo ""
  if [[ "$failed" == "true" ]]; then
    log_error "Local environment stop completed with one or more cleanup errors"
    return 1
  fi
  if [[ "$interactive_only" == "true" ]] && [[ "$preserve_background" == "true" ]]; then
    log_success "Interactive stack stopped (runtime service still running)"
    if [[ "$preserve_cm" == "true" ]]; then
      log_info "Scheduled tasks and outbound comms continue until: unity service stop"
    else
      log_info "Runtime supervisor will restart Coordinator CM while the UI is down"
    fi
  else
    log_success "Local environment stopped"
  fi
}

cmd_restart() {
  local with_org="$1"
  local with_stripe="$2"
  local seed_scenario="$3"
  local with_chat="$4"
  local with_pubsub="$5"
  local with_integrations="${6:-false}"
  local integrations_provider="${7:-composio}"
  local unity_echo="${8:-false}"
  local with_integration_functions="${9:-false}"
  local with_self_host="${10:-false}"

  if [[ "$with_self_host" == "true" ]]; then
    seed_scenario=""
  elif [[ -z "$seed_scenario" ]]; then
    if [[ "$with_org" == "true" ]]; then
      seed_scenario="org-basic"
    else
      seed_scenario="personal-workspace"
    fi
  fi

  if [[ -n "$seed_scenario" ]] && ! validate_seed_scenario "$seed_scenario"; then
    return 1
  fi

  cmd_stop
  echo ""
  # `restart` is the documented clean-slate path ("wipes database"): purge the
  # DB so seeding produces exactly one fresh user (no accumulation of stale
  # seed logins / balances). Use `start` to keep existing data.
  purge_orchestra_db
  echo ""
  cmd_start "$with_org" "$with_stripe" "$seed_scenario" "$with_chat" "$with_pubsub" "$with_integrations" "$integrations_provider" "$unity_echo" "$with_integration_functions" "$with_self_host"
}

cmd_status() {
  echo ""
  echo "Local Environment Status"
  echo "========================"
  echo ""

  echo -n "  Orchestra: "
  if is_orchestra_running; then
    echo -e "${GREEN}running${NC} (http://127.0.0.1:${ORCHESTRA_PORT})"
  else
    echo -e "${RED}not running${NC}"
  fi

  echo -n "  Console:   "
  if is_console_running; then
    echo -e "${GREEN}running${NC} (http://localhost:${CONSOLE_PORT})"
    local missing_env=""
    missing_env="$(console_env_missing_self_host_keys 2>/dev/null || true)"
    if [[ -n "$missing_env" ]]; then
      echo -e "             ${YELLOW}missing self-host env:${NC} $missing_env"
      echo "             repair with: unity-deploy/selfhost/stack.sh repair-console"
    fi
  else
    echo -e "${RED}not running${NC}"
  fi

  echo -n "  Stripe:    "
  if is_stripe_listener_running; then
    echo -e "${GREEN}listening${NC} (webhooks → localhost:${ORCHESTRA_PORT})"
    if [[ -f "$STRIPE_SECRET_FILE" ]]; then
      echo "             secret: $(cat "$STRIPE_SECRET_FILE")"
    fi
  else
    echo -e "${YELLOW}not running${NC} (start with --stripe)"
  fi

  echo -n "  Pub/Sub:   "
  if is_emulator_running; then
    echo -e "${GREEN}running${NC} (port $PUBSUB_EMULATOR_PORT)"
  else
    echo -e "${YELLOW}not running${NC} (start with --pubsub or --chat)"
  fi

  echo -n "  Chat:      "
  if declare -F self_host_gateway_is_healthy &>/dev/null \
    && self_host_gateway_is_healthy; then
    echo -e "${GREEN}running${NC} (Unity gateway: $(unity_gateway_base_url))"
  elif is_unity_available && is_unity_running; then
    echo -e "${GREEN}running${NC} (Unity gateway: $(unity_gateway_base_url))"
  else
    echo -e "${YELLOW}not running${NC} (start with --chat)"
  fi

  echo -n "  Unity:     "
  if is_unity_available && is_unity_running; then
    local unity_mode
    unity_mode=$(cat /tmp/unity-local.mode 2>/dev/null || echo "unknown")
    echo -e "${GREEN}running${NC} ($unity_mode mode)"
  elif is_unity_available; then
    echo -e "${YELLOW}not running${NC} (started by --chat)"
  else
    echo -e "${YELLOW}not found${NC} (set UNIFY_REPO_PATH)"
  fi

  if declare -F self_host_runtime_doctor_line &>/dev/null; then
    echo ""
    echo "  Runtime service"
    self_host_runtime_doctor_line | sed 's/^/    /'
  fi

  echo ""
}

cmd_logs() {
  local service="${1:-console}"
  local logfile=""

  case "$service" in
    console)
      logfile="$CONSOLE_LOGFILE"
      ;;
    pubsub)
      logfile="$EMULATOR_LOGFILE"
      ;;
    stripe)
      logfile="/tmp/stripe-listen-orchestra.log"
      ;;
    orchestra)
      logfile="/tmp/orchestra-local.log"
      ;;
    *)
      log_error "Unknown log service: $service"
      log_info "Supported services: console, orchestra, pubsub, stripe"
      return 1
      ;;
  esac

  if [[ ! -f "$logfile" ]]; then
    log_error "Log file does not exist yet: $logfile"
    log_info "Start the local environment first."
    return 1
  fi

  log_info "Following $service logs: $logfile"
  tail -n 200 -F "$logfile"
}

# =============================================================================
# Entry Point
# =============================================================================

main() {
  case "${1:-}" in
    gateway-setup)
      shift
      cmd_gateway_setup "$@"
      return
      ;;
    gateway-doctor)
      shift
      cmd_gateway_doctor "$@"
      return
      ;;
    gateway-urls)
      shift
      cmd_gateway_urls "$@"
      return
      ;;
  esac

  local cmd=""
  local with_org="false"
  local with_stripe="false"
  local with_chat="false"
  local with_pubsub="false"
  local with_integrations="false"
  local integrations_provider="composio"
  local unity_echo="false"
  local with_self_host="false"
  local with_integration_functions="false"
  local seed_scenario=""
  local interactive_stop="false"
  local logs_service="console"

  while (( "$#" )); do
    case "$1" in
      --org)    with_org="true"; shift ;;
      --stripe) with_stripe="true"; shift ;;
      --chat)   with_chat="true"; with_pubsub="true"; shift ;;
      --self-host) with_self_host="true"; shift ;;
      --pubsub) with_pubsub="true"; shift ;;
      --integrations) with_integrations="true"; shift ;;
      --integrations-functions) with_integration_functions="true"; shift ;;
      --provider) shift; integrations_provider="${1:-composio}"; shift ;;
      --echo|--unity-echo) unity_echo="true"; shift ;;
      --interactive-only) interactive_stop="true"; shift ;;
      --seed)   shift; seed_scenario="${1:-}"; shift ;;
      --credits)
        shift
        if [[ -z "${1:-}" || ! "${1}" =~ ^-?[0-9]+$ ]]; then
          log_error "--credits requires an integer (e.g. --credits 0)"
          exit 1
        fi
        # Forward to the TS seed client (client.ts defaultSeedCredits()),
        # which uses it as the starting balance for seeded billing accounts.
        export SEED_CREDITS="$1"
        shift
        ;;
      --service) shift; logs_service="${1:-console}"; shift ;;
      -h|--help|help) cmd="help"; shift ;;
      -*)      log_error "Unknown flag: $1"; echo "Run '$0 help' for usage"; exit 1 ;;
      *)       if [[ -z "$cmd" ]]; then cmd="$1"; else logs_service="$1"; fi; shift ;;
    esac
  done

  cmd="${cmd:-start}"

  case "$cmd" in
    ensure-coordinator-topics) cmd_ensure_coordinator_topics ;;
    start-coordinator) cmd_start_coordinator ;;
    start-runtime-backend) cmd_start_runtime_backend ;;
    stop-runtime-backend) cmd_stop_runtime_backend ;;
    repair-console|console) cmd_repair_console "$with_self_host" ;;
    start)   cmd_start "$with_org" "$with_stripe" "$seed_scenario" "$with_chat" "$with_pubsub" "$with_integrations" "$integrations_provider" "$unity_echo" "$with_integration_functions" "$with_self_host" ;;
    stop)
      if [[ "$interactive_stop" == "true" ]]; then
        cmd_stop --interactive-only
      else
        cmd_stop
      fi
      ;;
    restart) cmd_restart "$with_org" "$with_stripe" "$seed_scenario" "$with_chat" "$with_pubsub" "$with_integrations" "$integrations_provider" "$unity_echo" "$with_integration_functions" "$with_self_host" ;;
    status)  cmd_status ;;
    logs)    cmd_logs "$logs_service" ;;
    help)
      echo "Usage: $0 [start|stop|restart|repair-console|status|logs|ensure-coordinator-topics|start-coordinator|gateway-setup|gateway-doctor|gateway-urls] [--org] [--stripe] [--pubsub] [--chat] [--self-host] [--integrations] [--integrations-functions] [--provider composio] [--echo] [--seed <scenario>] [--credits <n>]"
      echo ""
      echo "Commands:"
      echo "  ensure-coordinator-topics  Ensure Pub/Sub topics/subscriptions for the Coordinator"
      echo "  start-coordinator          Start Unity CM only (self-host; requires env vars)"
      echo "  start    Start Console + Orchestra + seed data (default)"
      echo "  stop     Stop Console, Orchestra, Pub/Sub emulator, Unity, and Stripe listener"
      echo "  restart  Stop then start (wipes database)"
      echo "  repair-console  Restart only Console with the current local-stack env"
      echo "  status   Show service status"
      echo "  gateway-setup   Run Unity gateway local setup wizard"
      echo "  gateway-doctor  Run Unity gateway doctor using Console's local env"
      echo "  gateway-urls    Print Unity gateway provider callback URLs"
      echo "  logs     Follow logs. Usage: $0 logs [console|orchestra|pubsub|stripe]"
      echo ""
      echo "Flags:"
      echo "  --seed <scenario>  Choose a seed scenario. Default: personal-workspace"
      echo "                     Scenarios: personal-workspace, personal-workspace-multi,"
      echo "                               org-basic, org-multi-role, org-unify,"
      echo "                               credit-grant-links, billing-banner-states,"
      echo "                               managed-billing, all"
      echo "                     See: src/tests/helpers/seeds/run.ts --list"
      echo "  --org              Shorthand for --seed org-basic"
      echo "  --credits <n>      Starting credit balance for seeded users/orgs whose"
      echo "                     scenario doesn't set an explicit value (default: 10000)."
      echo "                     e.g. --credits 0 to land on the out-of-credits/subscribe"
      echo "                     flow. Accepts negatives (e.g. -2) for overdraft states."
      echo "  --stripe           Start Stripe webhook forwarding for E2E billing flows"
      echo "                     Requires Stripe CLI: brew install stripe/stripe-cli/stripe"
      echo "                     Then authenticate:   stripe login"
      echo "                     For the subscription journeys, first mint the test-mode"
      echo "                     prices/coupon (orchestra/scripts/create_subscription_prices.py)"
      echo "                     and add the STRIPE_UNIFY_SUBSCRIPTION_PRICE_ID_* +"
      echo "                     STRIPE_UNIFY_ANNUAL_COUPON_ID ids to console/.env.local."
      echo "  --pubsub           Start Pub/Sub emulator for real-time billing events."
      echo "                     Creates billing topics for all seeded accounts."
      echo "                     Requires: gcloud CLI with pubsub-emulator component"
      echo "  --chat             Start Pub/Sub emulator + Unity gateway + Unity."
      echo "                     Includes everything --pubsub does, plus chat functionality."
      echo "                     Requires: unity repo as sibling (../unity)"
      echo "                               + gcloud CLI with pubsub-emulator component"
      echo "  --integrations     Configure local Orchestra with provider-backed integrations"
      echo "                     and sync a partial provider catalog."
      echo "  --integrations-functions"
      echo "                     Local-only shortcut: seed curated integration primitive"
      echo "                     rows into Functions/Primitives after provider catalog sync."
      echo "                     Override apps with LOCAL_INTEGRATION_FUNCTION_SYNC_APPS."
      echo "  --provider <name>  Provider to bootstrap with --integrations: composio or pipedream. Default: composio"
      echo "  --echo             Force Unity to start in echo-responder mode even when LLM"
      echo "                     keys are present in .env.local. The echo responder auto-"
      echo "                     discovers all unity-* topics, making it suitable for multi-"
      echo "                     assistant scenarios (e.g. personal-workspace-multi). Only"
      echo "                     meaningful with --chat. Alias: --unity-echo."
      echo ""
      echo "Environment:"
      echo "  ORCHESTRA_REPO_PATH       Path to orchestra repo (default: ../orchestra)"
      echo "  UNIFY_REPO_PATH           Path to unity repo (default: ../unity)"
      echo "  UNIFY_GATEWAY_PORT        Unity gateway port (default: 8001)"
      echo "  UNIFY_GATEWAY_PUBLIC_URL  Public callback URL for provider webhooks"
      echo "  CONSOLE_PORT              Console port (default: 3000)"
      echo "  ORCHESTRA_PORT            Orchestra port (default: 8000)"
      echo "  PUBSUB_EMULATOR_PORT      Pub/Sub emulator port (default: 8085)"
      echo ""
      echo "Test credentials:"
      echo "  Password: testpass123 (all seed users)"
      echo "  Emails:   shown in the Quick Sign-In panel on the login page"
      echo ""
      echo "Examples:"
      echo "  $0 start                              # personal-workspace (default)"
      echo "  $0 start --org                        # org-basic (shorthand)"
      echo "  $0 start --seed org-multi-role        # org-multi-role scenario"
      echo "  $0 start --seed personal-workspace-multi # personal workspace with several assistants"
      echo "  $0 start --seed all                   # all scenarios"
      echo "  $0 start --stripe                     # + Stripe webhook forwarding"
      echo "  $0 start --stripe --credits 0         # subscribe flow from a 0-credit balance"
      echo "  $0 start --org --stripe               # org-basic + Stripe"
      echo "  $0 start --pubsub                     # + Pub/Sub emulator (billing events)"
      echo "  $0 start --chat                       # + Pub/Sub + chat (Unity gateway)"
      echo "  $0 start --integrations --provider composio # + Composio partial catalog sync"
      echo "  $0 start --integrations --provider pipedream # + Pipedream partial catalog sync"
      echo "  $0 start --integrations --integrations-functions # + curated local Function rows"
      echo "  $0 console                           # restart only Console for UI/hot-reload work"
      echo "  $0 console --chat                    # restart only Console with local chat env"
      echo "  $0 start --chat --org                 # org-basic + local chat"
      echo "  $0 start --chat --echo --seed personal-workspace-multi  # multi-assistant chat with echo responder"
      ;;
    *)
      log_error "Unknown command: $cmd"
      echo "Run '$0 help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
