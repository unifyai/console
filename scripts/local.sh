#!/usr/bin/env bash
# =============================================================================
# local.sh — Local development environment for Console + Orchestra
# =============================================================================
#
# Starts a fully local Console deployment with a local Orchestra backend,
# PostgreSQL database, and seeded test data.
#
# All test data is created via TypeScript seed scenarios (src/tests/seeds/).
# By default the "personal-workspace" scenario is used. Pass --seed <name>
# to pick a different one, or --org as a shorthand for --seed org-basic.
#
# Usage:
#   ./scripts/local.sh                                # personal-workspace (default)
#   ./scripts/local.sh start                          # Same as above
#   ./scripts/local.sh start --org                    # Shorthand for --seed org-basic
#   ./scripts/local.sh start --seed org-multi-role    # Specific scenario
#   ./scripts/local.sh start --seed all               # Run all scenarios
#   ./scripts/local.sh start --stripe                 # + Stripe webhook forwarding
#   ./scripts/local.sh start --pubsub                 # + Pub/Sub emulator (billing events)
#   ./scripts/local.sh start --chat                   # + Pub/Sub + chat (adapters + Unity)
#   ./scripts/local.sh stop                           # Stop all services
#   ./scripts/local.sh restart                        # Stop then start (wipes database)
#   ./scripts/local.sh status                         # Show status of all services
#
# Prerequisites:
#   - Node.js 20+ and npm 10+
#   - Docker (for PostgreSQL)
#   - Poetry (for Orchestra)
#   - Orchestra repo cloned as a sibling: ../orchestra
#   - (--stripe) Stripe CLI installed and authenticated (`stripe login`)
#   - (--pubsub) gcloud CLI with Pub/Sub emulator component
#   - (--chat)   Everything for --pubsub, plus Communication repo: ../communication
#
# Environment:
#   ORCHESTRA_REPO_PATH       Path to orchestra repo (default: ../orchestra)
#   COMMUNICATION_REPO_PATH   Path to communication repo (default: ../communication)
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

COMMUNICATION_REPO_PATH="${COMMUNICATION_REPO_PATH:-$(cd "$CONSOLE_REPO_PATH/../communication" 2>/dev/null && pwd -P || echo "")}"
COMMUNICATION_LOCAL_SCRIPT="${COMMUNICATION_REPO_PATH:+$COMMUNICATION_REPO_PATH/scripts/local.sh}"
COMMUNICATION_CONFIG_FILE="/tmp/communication-local.config"

UNITY_REPO_PATH="${UNITY_REPO_PATH:-$(cd "$CONSOLE_REPO_PATH/../unity" 2>/dev/null && pwd -P || echo "")}"
UNITY_LOCAL_SCRIPT="${UNITY_REPO_PATH:+$UNITY_REPO_PATH/scripts/local.sh}"

CONSOLE_PORT="${CONSOLE_PORT:-3000}"
ORCHESTRA_PORT="${ORCHESTRA_PORT:-8000}"

CONSOLE_PIDFILE="/tmp/console-local-dev.pid"
CONSOLE_LOGFILE="/tmp/console-local-dev.log"

# Read keys from .env.local (needed so Orchestra accepts admin API calls and
# Stripe-dependent billing flows work end-to-end).
ENV_LOCAL="$CONSOLE_REPO_PATH/.env.local"
ADMIN_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
if [[ -f "$ENV_LOCAL" ]]; then
  ADMIN_KEY=$(grep -E '^ORCHESTRA_ADMIN_KEY=' "$ENV_LOCAL" | sed 's/^[^=]*=//' | tr -d '"' || true)
  STRIPE_SECRET_KEY=$(grep -E '^STRIPE_SECRET_KEY=' "$ENV_LOCAL" | sed 's/^[^=]*=//' | tr -d '"' || true)
  STRIPE_WEBHOOK_SECRET=$(grep -E '^STRIPE_WEBHOOK_SECRET=' "$ENV_LOCAL" | sed 's/^[^=]*=//' | tr -d '"' || true)
fi

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
    log_error "Missing .env.local — see README for setup instructions."
    ok=false
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

check_gcloud() {
  if ! command -v gcloud &>/dev/null; then
    log_error "gcloud CLI is not installed"
    log_info "Install from: https://cloud.google.com/sdk/docs/install"
    return 1
  fi
  return 0
}

check_java() {
  if ! command -v java &>/dev/null; then
    log_error "Java is required for Pub/Sub emulator but not installed"
    log_info "Install Java with one of:"
    log_info "  macOS:  brew install openjdk"
    log_info "  Ubuntu: sudo apt install default-jdk"
    return 1
  fi
  return 0
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

start_orchestra() {
  local with_stripe="${1:-false}"

  if is_orchestra_running; then
    log_success "Orchestra already running on port $ORCHESTRA_PORT"
    return 0
  fi

  log_info "Starting Orchestra via $ORCHESTRA_LOCAL_SCRIPT ..."

  # Pass the admin key so Orchestra authenticates Console's admin calls.
  export ORCHESTRA_ADMIN_KEY="$ADMIN_KEY"
  export ORCHESTRA_PORT="$ORCHESTRA_PORT"

  # Tell Orchestra where Console is running so Stripe checkout redirects
  # (success_url / cancel_url) point to localhost instead of console.unify.ai
  export UNIFY_CONSOLE_FRONTEND_URL="http://localhost:${CONSOLE_PORT}"

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

    # Also export any Stripe price/product IDs so checkout sessions work
    for var in STRIPE_UNIFY_CREDITS_PRICE_ID_PERSONAL STRIPE_UNIFY_CREDITS_PRICE_ID_BUSINESS \
               STRIPE_UNIFY_CREDITS_PRODUCT_ID_PERSONAL STRIPE_UNIFY_CREDITS_PRODUCT_ID_BUSINESS; do
      local val
      val=$(grep -E "^${var}=" "$ENV_LOCAL" 2>/dev/null | sed 's/^[^=]*=//' | tr -d '"' || true)
      if [[ -n "$val" ]]; then
        export "$var=$val"
      fi
    done
  fi

  if ! ORCHESTRA_REPO_PATH="$ORCHESTRA_REPO_PATH" bash "$ORCHESTRA_LOCAL_SCRIPT" start; then
    log_error "Failed to start Orchestra"
    return 1
  fi

  log_success "Orchestra is running"
}

stop_orchestra() {
  log_info "Stopping Orchestra..."
  ORCHESTRA_REPO_PATH="$ORCHESTRA_REPO_PATH" bash "$ORCHESTRA_LOCAL_SCRIPT" stop 2>/dev/null || true
  log_success "Orchestra stopped"
}

# =============================================================================
# Communication Adapters Management (--chat mode, adapters only)
# =============================================================================

check_communication_prerequisites() {
  if [[ -z "$COMMUNICATION_REPO_PATH" || ! -f "$COMMUNICATION_LOCAL_SCRIPT" ]]; then
    log_error "Communication repo not found. Expected at: $CONSOLE_REPO_PATH/../communication"
    log_info "Set COMMUNICATION_REPO_PATH to override."
    log_info "(Only required for --chat; --pubsub works without it.)"
    return 1
  fi
  log_success "Communication repo found at: $COMMUNICATION_REPO_PATH"
}

is_communication_running() {
  COMMS_REPO_PATH="$COMMUNICATION_REPO_PATH" bash "$COMMUNICATION_LOCAL_SCRIPT" check &>/dev/null
}

start_communication_adapters() {
  if is_communication_running; then
    log_success "Communication adapters already running"
    load_communication_config
    return 0
  fi

  log_info "Starting Communication adapters (connecting to Console-managed emulator)..."

  local comm_env=(COMMS_REPO_PATH="$COMMUNICATION_REPO_PATH")
  if [[ -n "$ADMIN_KEY" ]]; then
    comm_env+=(ORCHESTRA_ADMIN_KEY="$ADMIN_KEY")
  fi
  if [[ -n "${ORCHESTRA_PORT:-}" ]]; then
    comm_env+=(ORCHESTRA_URL="http://127.0.0.1:${ORCHESTRA_PORT}/v0")
  fi
  comm_env+=(PUBSUB_EMULATOR_HOST="$LOCAL_PUBSUB_HOST")
  comm_env+=(GCP_PROJECT_ID="$PUBSUB_GCP_PROJECT_ID")

  if ! env "${comm_env[@]}" bash "$COMMUNICATION_LOCAL_SCRIPT" start --no-emulator; then
    log_error "Failed to start Communication adapters"
    return 1
  fi

  load_communication_config
  log_success "Communication adapters are running"
}

load_communication_config() {
  if [[ ! -f "$COMMUNICATION_CONFIG_FILE" ]]; then
    log_warn "Communication config file not found at $COMMUNICATION_CONFIG_FILE"
    return 1
  fi

  while IFS='=' read -r key value; do
    case "$key" in
      UNITY_ADAPTERS_URL)    CHAT_ADAPTERS_URL="$value" ;;
      TEST_ASSISTANT_ID)     CHAT_TEST_ASSISTANT_ID="$value" ;;
    esac
  done < "$COMMUNICATION_CONFIG_FILE"

  log_info "Loaded Communication config:"
  log_info "  Adapters URL:      ${CHAT_ADAPTERS_URL:-<not set>}"
  log_info "  Test Assistant ID: ${CHAT_TEST_ASSISTANT_ID:-<not set>}"
}

stop_communication() {
  if [[ -n "$COMMUNICATION_REPO_PATH" && -f "$COMMUNICATION_LOCAL_SCRIPT" ]]; then
    log_info "Stopping Communication adapters..."
    COMMS_REPO_PATH="$COMMUNICATION_REPO_PATH" bash "$COMMUNICATION_LOCAL_SCRIPT" stop 2>/dev/null || true
    log_success "Communication adapters stopped"
  fi
}

CHAT_ADAPTERS_URL=""
CHAT_TEST_ASSISTANT_ID=""

# =============================================================================
# Unity Management (--chat mode)
# =============================================================================

is_unity_available() {
  [[ -n "$UNITY_REPO_PATH" && -f "$UNITY_LOCAL_SCRIPT" ]]
}

is_unity_running() {
  is_unity_available && bash "$UNITY_LOCAL_SCRIPT" check &>/dev/null
}

start_unity() {
  if ! is_unity_available; then
    log_warn "Unity repo not found at $CONSOLE_REPO_PATH/../unity — skipping."
    log_info "Set UNITY_REPO_PATH to override. Chat will work but no responses will come back."
    return 0
  fi

  if is_unity_running; then
    log_success "Unity already running"
    return 0
  fi

  # Resolve the actual assistant agentId from the database.  The seed
  # creates assistants with auto-incremented IDs, so the first assistant
  # is typically "1".  If the DB isn't available, fall back to the
  # Communication TEST_ASSISTANT_ID.
  local resolved_assistant_id
  resolved_assistant_id=$(docker exec orchestra-local-db \
    psql -U orchestra -d orchestra -t -A \
    -c "SELECT agent_id FROM assistants ORDER BY agent_id LIMIT 1;" 2>/dev/null | head -1 || echo "")
  resolved_assistant_id="${resolved_assistant_id:-${CHAT_TEST_ASSISTANT_ID:-default-test-assistant}}"

  log_info "Starting Unity (auto-detecting mode) for assistant=$resolved_assistant_id ..."

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
  local _a_first _a_surname _a_about _a_age _a_nat _a_tz _u_first _u_last _u_email _u_id
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

  if ! env "${unity_env[@]}" bash "$UNITY_LOCAL_SCRIPT" start; then
    log_warn "Unity failed to start — chat will work but no responses will come back."
    return 0
  fi

  log_success "Unity is running"
}

stop_unity() {
  if is_unity_available; then
    log_info "Stopping Unity..."
    bash "$UNITY_LOCAL_SCRIPT" stop 2>/dev/null || true
    log_success "Unity stopped"
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
    local topic_name="unity-${agent_id}${suffix}"

    # Create topic (ignore if exists)
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PUT "${emulator_url}/v1/projects/${project_id}/topics/${topic_name}" 2>/dev/null || echo "000")

    if [[ "$status" == "200" || "$status" == "409" ]]; then
      log_success "Topic ready: $topic_name"
    else
      log_warn "Failed to create topic $topic_name (HTTP $status)"
      continue
    fi

    # Create the outbound subscription (for Console's chat SSE to receive replies)
    local outbound_sub="${topic_name}-outbound-sub"
    curl -s -o /dev/null \
      -X PUT "${emulator_url}/v1/projects/${project_id}/subscriptions/${outbound_sub}" \
      -H "Content-Type: application/json" \
      -d "{\"topic\":\"projects/${project_id}/topics/${topic_name}\",\"filter\":\"attributes.thread = \\\"unify_message_outbound\\\"\"}" \
      2>/dev/null || true

    # Create the system-error subscription
    local syserr_sub="${topic_name}-system-error-sub"
    curl -s -o /dev/null \
      -X PUT "${emulator_url}/v1/projects/${project_id}/subscriptions/${syserr_sub}" \
      -H "Content-Type: application/json" \
      -d "{\"topic\":\"projects/${project_id}/topics/${topic_name}\",\"filter\":\"attributes.thread = \\\"system_error\\\"\"}" \
      2>/dev/null || true

    # Create the actions subscription
    local actions_sub="${topic_name}-actions-sub"
    curl -s -o /dev/null \
      -X PUT "${emulator_url}/v1/projects/${project_id}/subscriptions/${actions_sub}" \
      -H "Content-Type: application/json" \
      -d "{\"topic\":\"projects/${project_id}/topics/${topic_name}\",\"filter\":\"attributes.thread = \\\"action_event\\\"\",\"messageRetentionDuration\":\"1800s\"}" \
      2>/dev/null || true

    # Create the CM's inbound subscription (unfiltered — receives all
    # messages so the ConversationManager can process them).
    local inbound_sub="${topic_name}-sub"
    curl -s -o /dev/null \
      -X PUT "${emulator_url}/v1/projects/${project_id}/subscriptions/${inbound_sub}" \
      -H "Content-Type: application/json" \
      -d "{\"topic\":\"projects/${project_id}/topics/${topic_name}\"}" \
      2>/dev/null || true
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
VALID_SEED_SCENARIOS=(personal-workspace org-basic org-multi-role org-unify credit-grant-links billing-banner-states usage-ledger chat-search memory-rich tasks-rich secrets-rich re-appraisal all)

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
  export ORCHESTRA_ADMIN_KEY="${ADMIN_KEY:-local-admin-key}"

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
# Console Management
# =============================================================================

is_console_running() {
  if [[ -f "$CONSOLE_PIDFILE" ]]; then
    local pid
    pid=$(cat "$CONSOLE_PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  # Also check if something is listening on the port
  lsof -i ":${CONSOLE_PORT}" -sTCP:LISTEN &>/dev/null
}

start_console() {
  local with_pubsub="${1:-false}"
  local with_chat="${2:-false}"

  # Kill any stale Console processes on the port before checking, so we
  # always start fresh with the correct environment variables.
  local stale_pids
  stale_pids=$(lsof -t -i ":${CONSOLE_PORT}" 2>/dev/null || true)
  if [[ -n "$stale_pids" ]]; then
    log_info "Cleaning up stale processes on port $CONSOLE_PORT ..."
    echo "$stale_pids" | xargs kill -9 2>/dev/null || true
    sleep 1
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
      export LOCAL_ADAPTERS_URL="$CHAT_ADAPTERS_URL"
      log_info "  LOCAL_ADAPTERS_URL=$LOCAL_ADAPTERS_URL"
    fi
  fi

  nohup npm run dev -- -p "$CONSOLE_PORT" -H 0.0.0.0 > "$CONSOLE_LOGFILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$CONSOLE_PIDFILE"

  log_info "Waiting for Console to be ready (PID $pid)..."

  local max_attempts=60
  local attempt=0
  while (( attempt < max_attempts )); do
    if curl -s --connect-timeout 2 --max-time 5 "http://localhost:${CONSOLE_PORT}" &>/dev/null; then
      log_success "Console is ready at http://localhost:${CONSOLE_PORT}"
      return 0
    fi
    sleep 1
    ((attempt++)) || true
  done

  log_error "Console failed to start within 60 seconds"
  log_info "Check logs: $CONSOLE_LOGFILE"
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

  # Kill any remaining next-server processes on the port
  local port_pids
  port_pids=$(lsof -t -i ":${CONSOLE_PORT}" 2>/dev/null || true)
  if [[ -n "$port_pids" ]]; then
    echo "$port_pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi

  log_success "Console stopped"
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

  # Resolve effective seed scenario:
  #   --seed X  → X                     (explicit)
  #   --org     → org-basic             (convenience alias)
  #   (default) → personal-workspace
  if [[ -z "$seed_scenario" ]]; then
    if [[ "$with_org" == "true" ]]; then
      seed_scenario="org-basic"
    else
      seed_scenario="personal-workspace"
    fi
  fi

  # Validate seed scenario name early — before starting any services.
  if ! validate_seed_scenario "$seed_scenario"; then
    return 1
  fi

  local mode_label="seed:${seed_scenario}"
  if [[ "$with_stripe" == "true" ]]; then
    mode_label="$mode_label + stripe"
  fi
  if [[ "$with_pubsub" == "true" ]]; then
    mode_label="$mode_label + pubsub"
  fi
  if [[ "$with_chat" == "true" ]]; then
    mode_label="$mode_label + chat"
  fi

  echo ""
  echo "=============================================="
  echo "  Starting Local Console + Orchestra ($mode_label)"
  echo "=============================================="
  echo ""

  if ! check_prerequisites; then
    return 1
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

  # If --chat, also start the Communication adapters (needs Communication repo).
  if [[ "$with_chat" == "true" ]]; then
    echo ""
    if ! check_communication_prerequisites; then
      return 1
    fi
    echo ""
    start_communication_adapters || return 1
  fi

  echo ""
  start_orchestra "$with_stripe" || return 1

  # Install npm deps early — seed scenarios need tsx.
  echo ""
  ensure_npm_deps

  # Seed before Console so data is available on first page load.
  echo ""
  run_seed_scenario "$seed_scenario" || log_warn "Seed scenario failed — see output above"

  # After seeding, create Pub/Sub topics for seeded assistants/billing accounts.
  if [[ "$with_pubsub" == "true" || "$with_chat" == "true" ]] && is_emulator_running; then
    echo ""
    create_seeded_billing_topics
    if [[ "$with_chat" == "true" ]]; then
      create_seeded_assistant_topics
      echo ""
      start_unity
    fi
  fi

  echo ""
  start_console "$with_pubsub" "$with_chat" || return 1

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
    echo "  Adapters:  ${CHAT_ADAPTERS_URL:-http://127.0.0.1:8081}"
    echo "  Test asst: ${CHAT_TEST_ASSISTANT_ID:-default-test-assistant}"
  fi
  echo ""
  echo "  Seed:      $seed_scenario"
  echo "  Login:     Use the Quick Sign-In panel on the login page"
  echo "  Password:  testpass123"
  if [[ "$with_stripe" == "true" ]]; then
    echo ""
    echo "  Billing:   Stripe test mode active — use card 4242 4242 4242 4242"
  fi
  if [[ "$with_pubsub" == "true" && "$with_chat" != "true" ]]; then
    echo ""
    echo "  Pub/Sub:   Emulator running for real-time billing events."
    echo "             Billing topics created for all seeded accounts."
  fi
  if [[ "$with_chat" == "true" ]]; then
    echo ""
    local unity_mode
    unity_mode=$(cat /tmp/unity-local.mode 2>/dev/null || echo "not running")
    echo "  Chat:      Messages dispatched to local adapters via Pub/Sub emulator."
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
  echo "Stopping local environment..."
  echo ""
  if is_stripe_listener_running; then
    stop_stripe_listener
  fi
  stop_console
  stop_orchestra
  if is_unity_available && is_unity_running; then
    stop_unity
  fi
  if [[ -n "$COMMUNICATION_REPO_PATH" && -f "$COMMUNICATION_LOCAL_SCRIPT" ]] && is_communication_running; then
    stop_communication
  fi
  if is_emulator_running; then
    stop_pubsub_emulator
  fi
  echo ""
  log_success "Local environment stopped"
}

cmd_restart() {
  local with_org="$1"
  local with_stripe="$2"
  local seed_scenario="$3"
  local with_chat="$4"
  local with_pubsub="$5"

  # Resolve default early so validation works.
  if [[ -z "$seed_scenario" ]]; then
    if [[ "$with_org" == "true" ]]; then
      seed_scenario="org-basic"
    else
      seed_scenario="personal-workspace"
    fi
  fi

  # Validate seed scenario name early — before stopping/restarting anything.
  if ! validate_seed_scenario "$seed_scenario"; then
    return 1
  fi

  cmd_stop
  echo ""
  cmd_start "$with_org" "$with_stripe" "$seed_scenario" "$with_chat" "$with_pubsub"
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
  if [[ -n "$COMMUNICATION_REPO_PATH" && -f "$COMMUNICATION_LOCAL_SCRIPT" ]] && is_communication_running; then
    echo -e "${GREEN}running${NC} (Communication adapters)"
    if [[ -f "$COMMUNICATION_CONFIG_FILE" ]]; then
      load_communication_config 2>/dev/null
    fi
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
    echo -e "${YELLOW}not found${NC} (set UNITY_REPO_PATH)"
  fi

  echo ""
}

# =============================================================================
# Entry Point
# =============================================================================

main() {
  local cmd=""
  local with_org="false"
  local with_stripe="false"
  local with_chat="false"
  local with_pubsub="false"
  local seed_scenario=""

  while (( "$#" )); do
    case "$1" in
      --org)    with_org="true"; shift ;;
      --stripe) with_stripe="true"; shift ;;
      --chat)   with_chat="true"; with_pubsub="true"; shift ;;
      --pubsub) with_pubsub="true"; shift ;;
      --seed)   shift; seed_scenario="${1:-}"; shift ;;
      -h|--help|help) cmd="help"; shift ;;
      -*)      log_error "Unknown flag: $1"; echo "Run '$0 help' for usage"; exit 1 ;;
      *)       [[ -z "$cmd" ]] && cmd="$1"; shift ;;
    esac
  done

  cmd="${cmd:-start}"

  case "$cmd" in
    start)   cmd_start "$with_org" "$with_stripe" "$seed_scenario" "$with_chat" "$with_pubsub" ;;
    stop)    cmd_stop ;;
    restart) cmd_restart "$with_org" "$with_stripe" "$seed_scenario" "$with_chat" "$with_pubsub" ;;
    status)  cmd_status ;;
    help)
      echo "Usage: $0 [start|stop|restart|status] [--org] [--stripe] [--pubsub] [--chat] [--seed <scenario>]"
      echo ""
      echo "Commands:"
      echo "  start    Start Console + Orchestra + seed data (default)"
      echo "  stop     Stop Console, Orchestra, Pub/Sub emulator, Communication, and Stripe listener"
      echo "  restart  Stop then start (wipes database)"
      echo "  status   Show service status"
      echo ""
      echo "Flags:"
      echo "  --seed <scenario>  Choose a seed scenario. Default: personal-workspace"
      echo "                     Scenarios: personal-workspace, org-basic, org-multi-role,"
      echo "                               org-unify, credit-grant-links,"
      echo "                               billing-banner-states, all"
      echo "                     See: src/tests/helpers/seeds/run.ts --list"
      echo "  --org              Shorthand for --seed org-basic"
      echo "  --stripe           Start Stripe webhook forwarding for E2E billing flows"
      echo "                     Requires Stripe CLI: brew install stripe/stripe-cli/stripe"
      echo "                     Then authenticate:   stripe login"
      echo "  --pubsub           Start Pub/Sub emulator for real-time billing events."
      echo "                     Creates billing topics for all seeded accounts."
      echo "                     Requires: gcloud CLI with pubsub-emulator component"
      echo "  --chat             Start Pub/Sub emulator + Communication adapters + Unity."
      echo "                     Includes everything --pubsub does, plus chat functionality."
      echo "                     Requires: communication repo as sibling (../communication)"
      echo "                               + gcloud CLI with pubsub-emulator component"
      echo ""
      echo "Environment:"
      echo "  ORCHESTRA_REPO_PATH       Path to orchestra repo (default: ../orchestra)"
      echo "  COMMUNICATION_REPO_PATH   Path to communication repo (default: ../communication)"
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
      echo "  $0 start --seed all                   # all scenarios"
      echo "  $0 start --stripe                     # + Stripe webhook forwarding"
      echo "  $0 start --org --stripe               # org-basic + Stripe"
      echo "  $0 start --pubsub                     # + Pub/Sub emulator (billing events)"
      echo "  $0 start --chat                       # + Pub/Sub + chat (adapters + Unity)"
      echo "  $0 start --chat --org                 # org-basic + local chat"
      ;;
    *)
      log_error "Unknown command: $cmd"
      echo "Run '$0 help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
