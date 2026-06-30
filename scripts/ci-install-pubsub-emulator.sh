#!/usr/bin/env bash
# =============================================================================
# ci-install-pubsub-emulator.sh — Ensure the Google Cloud Pub/Sub emulator
# =============================================================================
#
# GitHub-hosted runners ship `gcloud`, but the component manager is disabled and
# the emulator component is not present, so `gcloud beta emulators pubsub start`
# fails with "You need the [pubsub-emulator] component". The runner image build
# also removes the Google Cloud apt source after installing the CLI, so a bare
# `apt-get install google-cloud-cli-pubsub-emulator` cannot resolve the package.
#
# This script guarantees a usable emulator by:
#   1. Probing the active gcloud SDK root for the emulator files (functional
#      check — not a package-presence check).
#   2. If missing, re-adding the Google Cloud apt repo and installing
#      `google-cloud-cli-pubsub-emulator` with output visible in CI.
#   3. Re-running the functional check and failing loudly if still missing.
#
# Safe to run repeatedly; it no-ops once the emulator is available.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[pubsub]${NC} $*"; }
log_success() { echo -e "${GREEN}[pubsub]${NC} $*"; }
log_error()   { echo -e "${RED}[pubsub]${NC} $*"; }

APT_LOG="/tmp/pubsub-emulator-apt.log"

if ! command -v gcloud &>/dev/null; then
  log_error "gcloud is required for the Pub/Sub emulator but was not found on PATH"
  exit 1
fi

# Functional availability: does the active SDK actually contain the emulator?
emulator_available() {
  local sdk_root
  sdk_root="$(gcloud info --format='value(installation.sdk_root)' 2>/dev/null || echo "")"
  local candidate
  for candidate in \
    "${sdk_root:+$sdk_root/platform/pubsub-emulator}" \
    "/usr/lib/google-cloud-sdk/platform/pubsub-emulator" \
    "$HOME/google-cloud-sdk/platform/pubsub-emulator"; do
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

if emulator_available; then
  log_success "Pub/Sub emulator already available"
  exit 0
fi

log_info "Pub/Sub emulator not found; installing google-cloud-cli-pubsub-emulator..."

# The runner image deletes /etc/apt/sources.list.d/google-cloud-sdk.list after
# installing the CLI, so re-add the repo + signing key before installing.
if [[ ! -f /usr/share/keyrings/cloud.google.gpg ]]; then
  curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
    | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
fi
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
  | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list >/dev/null

if ! sudo apt-get update -o Dir::Etc::sourcelist="sources.list.d/google-cloud-sdk.list" \
  -o Dir::Etc::sourceparts="-" -o APT::Get::List-Cleanup="0" >"$APT_LOG" 2>&1; then
  log_error "apt-get update for the Google Cloud repo failed"
  cat "$APT_LOG" || true
  exit 1
fi

if ! sudo apt-get install -y google-cloud-cli-pubsub-emulator >>"$APT_LOG" 2>&1; then
  log_error "apt-get install google-cloud-cli-pubsub-emulator failed"
  cat "$APT_LOG" || true
  exit 1
fi

if ! emulator_available; then
  log_error "Pub/Sub emulator still not available after install"
  cat "$APT_LOG" || true
  exit 1
fi

log_success "Pub/Sub emulator installed and available"
