#!/usr/bin/env bash
# =============================================================================
# local.sh — Local development environment for Console + Orchestra
# =============================================================================
#
# Starts a fully local Console deployment with a local Orchestra backend,
# PostgreSQL database, and seeded test data (user, organization, assistant).
#
# Usage:
#   ./scripts/local.sh              # Start everything (default)
#   ./scripts/local.sh start        # Same as above
#   ./scripts/local.sh stop         # Stop Console and Orchestra
#   ./scripts/local.sh restart      # Stop then start (wipes database)
#   ./scripts/local.sh status       # Show status of all services
#
# Prerequisites:
#   - Node.js 20+ and npm 10+
#   - Docker (for PostgreSQL)
#   - Poetry (for Orchestra)
#   - Orchestra repo cloned as a sibling: ../orchestra
#
# Environment:
#   ORCHESTRA_REPO_PATH   Path to orchestra repo (default: ../orchestra)
#   CONSOLE_PORT          Next.js port (default: 3333)
#   ORCHESTRA_PORT        Orchestra port (default: 8000)
#
# Test credentials (seeded automatically):
#   Email:    test@example.com
#   Password: testpass123
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

# Read the ORCHESTRA_ADMIN_KEY from .env.local (needed so Orchestra accepts
# admin API calls from the Console's Next.js server).
ENV_LOCAL="$CONSOLE_REPO_PATH/.env.local"
ADMIN_KEY=""
if [[ -f "$ENV_LOCAL" ]]; then
  ADMIN_KEY=$(grep -E '^ORCHESTRA_ADMIN_KEY=' "$ENV_LOCAL" | cut -d'=' -f2- || true)
fi

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
  if is_orchestra_running; then
    log_success "Orchestra already running on port $ORCHESTRA_PORT"
    return 0
  fi

  log_info "Starting Orchestra via $ORCHESTRA_LOCAL_SCRIPT ..."

  # Pass the admin key so Orchestra authenticates Console's admin calls.
  export ORCHESTRA_ADMIN_KEY="$ADMIN_KEY"
  export ORCHESTRA_PORT="$ORCHESTRA_PORT"

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
# Test Data Seeding
# =============================================================================

seed_test_data() {
  log_info "Seeding test data..."

  local db_container
  db_container=$(docker ps --filter "publish=${ORCHESTRA_PORT:-5432}" --format "{{.Names}}" 2>/dev/null | head -1)
  # The DB container listens on the DB port (5432), not the Orchestra port.
  # Orchestra's local.sh uses ORCHESTRA_DB_PORT which defaults to 5432.
  db_container=$(docker ps --filter "publish=5432" --format "{{.Names}}" 2>/dev/null | head -1)

  if [[ -z "$db_container" ]]; then
    log_warn "No PostgreSQL container found — skipping seed"
    return 0
  fi

  local psql="docker exec $db_container psql -U orchestra -d orchestra -tAc"

  # Resolve the actual user ID (Orchestra may prefix it)
  local test_user_id
  test_user_id=$($psql "SELECT id FROM \"user\" WHERE email = 'test@example.com' LIMIT 1;" 2>/dev/null || echo "")
  if [[ -z "$test_user_id" ]]; then
    test_user_id=$($psql "SELECT id FROM \"user\" LIMIT 1;" 2>/dev/null || echo "")
  fi

  if [[ -z "$test_user_id" ]]; then
    log_warn "No user found in database — skipping seed"
    return 0
  fi

  log_info "Found test user: $test_user_id"

  # 1. Update test user's name and email
  $psql "UPDATE \"user\" SET name = 'Test', last_name = 'User', email = 'test@example.com' WHERE id = '$test_user_id';" >/dev/null 2>&1

  # 2. Create email_account (password login) if not exists
  local has_email_account
  has_email_account=$($psql "SELECT 1 FROM email_account WHERE user_id = '$test_user_id';" 2>/dev/null || echo "")

  if [[ "$has_email_account" != "1" ]]; then
    log_info "Creating email/password login for test user..."
    local pw_hash
    pw_hash=$("$ORCHESTRA_REPO_PATH/.venv/bin/python" -c "from argon2 import PasswordHasher; print(PasswordHasher().hash('testpass123'))" 2>/dev/null)
    if [[ -n "$pw_hash" ]]; then
      docker exec "$db_container" psql -U orchestra -d orchestra -c \
        "INSERT INTO email_account (user_id, password_hash, email_verified) VALUES ('$test_user_id', '$pw_hash', true) ON CONFLICT (user_id) DO NOTHING;" >/dev/null 2>&1
      log_success "Email login created (test@example.com / testpass123)"
    else
      log_warn "Could not generate password hash — email login not created"
    fi
  else
    log_success "Email login already exists"
  fi

  # 3. Create organization if not exists
  local has_org
  has_org=$($psql "SELECT 1 FROM organization WHERE owner_id = '$test_user_id' LIMIT 1;" 2>/dev/null || echo "")

  if [[ "$has_org" != "1" ]]; then
    log_info "Creating test organization..."
    docker exec "$db_container" psql -U orchestra -d orchestra -c "
DO \$\$
DECLARE
  _org_id integer;
  _ba_id integer;
BEGIN
  INSERT INTO billing_account (credits, autorecharge, autorecharge_threshold, autorecharge_qty, account_status, tier)
  VALUES (10000, false, 0, 25, 'ACTIVE', 'developer')
  RETURNING id INTO _ba_id;

  INSERT INTO organization (owner_id, name, billing_account_id, verified)
  VALUES ('$test_user_id', 'Acme Corp', _ba_id, true)
  RETURNING id INTO _org_id;

  INSERT INTO organization_member (organization_id, user_id, role_id)
  VALUES (_org_id, '$test_user_id', 1);

  INSERT INTO api_key (user_id, organization_id, key, name)
  VALUES ('$test_user_id', _org_id, 'org-test-api-key', 'Org Key');
END
\$\$;
" >/dev/null 2>&1
    log_success "Organization 'Acme Corp' created"
  else
    log_success "Organization already exists"
  fi

  # 4. Create a sample assistant if none exist
  local has_assistant
  has_assistant=$($psql "SELECT 1 FROM assistants WHERE user_id = '$test_user_id' LIMIT 1;" 2>/dev/null || echo "")

  if [[ "$has_assistant" != "1" ]]; then
    log_info "Creating sample assistant..."
    local org_id
    org_id=$($psql "SELECT id FROM organization WHERE owner_id = '$test_user_id' LIMIT 1;" 2>/dev/null || echo "")

    local org_clause="NULL"
    if [[ -n "$org_id" ]]; then
      org_clause="$org_id"
    fi

    docker exec "$db_container" psql -U orchestra -d orchestra -c \
      "INSERT INTO assistants (user_id, first_name, surname, age, nationality, timezone, about, organization_id) VALUES ('$test_user_id', 'Karen', 'Myers', 58, 'United Kingdom', 'Europe/London', 'A highly experienced professional bringing years of expertise and strong problem-solving skills.', $org_clause);" >/dev/null 2>&1
    log_success "Sample assistant 'Karen Myers' created"
  else
    log_success "Assistant(s) already exist"
  fi

  log_success "Test data seeded"
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

  # Install dependencies if node_modules is missing
  if [[ ! -d "node_modules" ]]; then
    log_info "Running npm install..."
    npm install --silent
  fi

  nohup npm run dev -- -p "$CONSOLE_PORT" > "$CONSOLE_LOGFILE" 2>&1 &
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
# Main Commands
# =============================================================================

cmd_start() {
  echo ""
  echo "=============================================="
  echo "  Starting Local Console + Orchestra"
  echo "=============================================="
  echo ""

  if ! check_prerequisites; then
    return 1
  fi

  echo ""
  start_orchestra || return 1
  echo ""
  seed_test_data
  echo ""
  start_console || return 1

  echo ""
  echo "=============================================="
  log_success "Local environment is ready!"
  echo "=============================================="
  echo ""
  echo "  Console:   http://localhost:${CONSOLE_PORT}"
  echo "  Orchestra: http://127.0.0.1:${ORCHESTRA_PORT}/v0"
  echo ""
  echo "  Login:     test@example.com / testpass123"
  echo ""
}

cmd_stop() {
  echo "Stopping local environment..."
  echo ""
  stop_console
  stop_orchestra
  echo ""
  log_success "Local environment stopped"
}

cmd_restart() {
  cmd_stop
  echo ""
  cmd_start
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

  echo ""
}

# =============================================================================
# Entry Point
# =============================================================================

main() {
  local cmd="${1:-start}"

  case "$cmd" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_restart ;;
    status)  cmd_status ;;
    -h|--help|help)
      echo "Usage: $0 [start|stop|restart|status]"
      echo ""
      echo "Commands:"
      echo "  start    Start Console + Orchestra + seed data (default)"
      echo "  stop     Stop Console and Orchestra"
      echo "  restart  Stop then start (wipes database)"
      echo "  status   Show service status"
      echo ""
      echo "Environment:"
      echo "  ORCHESTRA_REPO_PATH   Path to orchestra repo (default: ../orchestra)"
      echo "  CONSOLE_PORT          Console port (default: 3333)"
      echo "  ORCHESTRA_PORT        Orchestra port (default: 8000)"
      echo ""
      echo "Test credentials:"
      echo "  Email:    test@example.com"
      echo "  Password: testpass123"
      ;;
    *)
      log_error "Unknown command: $cmd"
      echo "Run '$0 help' for usage"
      exit 1
      ;;
  esac
}

main "$@"
