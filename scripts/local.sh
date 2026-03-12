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
#
# Environment:
#   ORCHESTRA_REPO_PATH   Path to orchestra repo (default: ../orchestra)
#   CONSOLE_PORT          Next.js port (default: 3333)
#   ORCHESTRA_PORT        Orchestra port (default: 8000)
#
set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CONSOLE_REPO_PATH="$(cd "$SCRIPT_DIR/.." && pwd -P)"

ORCHESTRA_REPO_PATH="${ORCHESTRA_REPO_PATH:-$(cd "$CONSOLE_REPO_PATH/../orchestra" 2>/dev/null && pwd -P || echo "")}"
ORCHESTRA_LOCAL_SCRIPT="$ORCHESTRA_REPO_PATH/scripts/local.sh"

CONSOLE_PORT="${CONSOLE_PORT:-3333}"
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

# Valid seed scenario names — must match SCENARIOS in src/tests/seeds/run.ts.
VALID_SEED_SCENARIOS=(personal-workspace org-basic org-multi-role org-unify all)

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
  log_info "Run: npx tsx src/tests/seeds/run.ts --list"
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

  if npx tsx src/tests/seeds/run.ts "$scenario"; then
    log_success "Seed scenario '$scenario' completed"
  else
    log_error "Seed scenario '$scenario' failed"
    return 1
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
  if is_console_running; then
    log_success "Console already running on port $CONSOLE_PORT"
    return 0
  fi

  log_info "Starting Console on port $CONSOLE_PORT ..."

  cd "$CONSOLE_REPO_PATH"

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

  echo ""
  echo "=============================================="
  echo "  Starting Local Console + Orchestra ($mode_label)"
  echo "=============================================="
  echo ""

  if ! check_prerequisites; then
    return 1
  fi

  echo ""
  start_orchestra "$with_stripe" || return 1

  # Install npm deps early — seed scenarios need tsx.
  echo ""
  ensure_npm_deps

  # Seed before Console so data is available on first page load.
  echo ""
  run_seed_scenario "$seed_scenario" || log_warn "Seed scenario failed — see output above"

  echo ""
  start_console || return 1

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
  echo ""
  echo "  Seed:      $seed_scenario"
  echo "  Login:     Use the Quick Sign-In panel on the login page"
  echo "  Password:  testpass123"
  if [[ "$with_stripe" == "true" ]]; then
    echo ""
    echo "  Billing:   Stripe test mode active — use card 4242 4242 4242 4242"
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
  echo ""
  log_success "Local environment stopped"
}

cmd_restart() {
  local with_org="$1"
  local with_stripe="$2"
  local seed_scenario="$3"

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
  cmd_start "$with_org" "$with_stripe" "$seed_scenario"
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

  echo ""
}

# =============================================================================
# Entry Point
# =============================================================================

main() {
  local cmd=""
  local with_org="false"
  local with_stripe="false"
  local seed_scenario=""

  while (( "$#" )); do
    case "$1" in
      --org)    with_org="true"; shift ;;
      --stripe) with_stripe="true"; shift ;;
      --seed)   shift; seed_scenario="${1:-}"; shift ;;
      -h|--help|help) cmd="help"; shift ;;
      -*)      log_error "Unknown flag: $1"; echo "Run '$0 help' for usage"; exit 1 ;;
      *)       [[ -z "$cmd" ]] && cmd="$1"; shift ;;
    esac
  done

  cmd="${cmd:-start}"

  case "$cmd" in
    start)   cmd_start "$with_org" "$with_stripe" "$seed_scenario" ;;
    stop)    cmd_stop ;;
    restart) cmd_restart "$with_org" "$with_stripe" "$seed_scenario" ;;
    status)  cmd_status ;;
    help)
      echo "Usage: $0 [start|stop|restart|status] [--org] [--stripe] [--seed <scenario>]"
      echo ""
      echo "Commands:"
      echo "  start    Start Console + Orchestra + seed data (default)"
      echo "  stop     Stop Console, Orchestra, and Stripe listener"
      echo "  restart  Stop then start (wipes database)"
      echo "  status   Show service status"
      echo ""
      echo "Flags:"
      echo "  --seed <scenario>  Choose a seed scenario. Default: personal-workspace"
      echo "                     Scenarios: personal-workspace, org-basic, org-multi-role,"
      echo "                               org-unify, all"
      echo "                     See: src/tests/seeds/run.ts --list"
      echo "  --org              Shorthand for --seed org-basic"
      echo "  --stripe           Start Stripe webhook forwarding for E2E billing flows"
      echo "                     Requires Stripe CLI: brew install stripe/stripe-cli/stripe"
      echo "                     Then authenticate:   stripe login"
      echo ""
      echo "Environment:"
      echo "  ORCHESTRA_REPO_PATH   Path to orchestra repo (default: ../orchestra)"
      echo "  CONSOLE_PORT          Console port (default: 3333)"
      echo "  ORCHESTRA_PORT        Orchestra port (default: 8000)"
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
      ;;
    *)
      log_error "Unknown command: $cmd"
      echo "Run '$0 help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
