#!/usr/bin/env bash
# Resolves Console Playwright CI tier and spec lists for push / PR / exhaustive runs.
set -euo pipefail

TIER="${1:-}"
SHARD="${2:-}"

push_specs() {
  cat <<'EOF'
src/tests/auth/login.e2e.ts
src/tests/shell/route-shell-smoke.e2e.ts
src/tests/shell/push-gate.e2e.ts
EOF
}

pr_assistants_specs() {
  cat <<'EOF'
src/tests/assistants/shell.e2e.ts
src/tests/assistants/list.e2e.ts
src/tests/assistants/chat.e2e.ts
src/tests/assistants/live-actions.e2e.ts
src/tests/assistants/brain.e2e.ts
src/tests/assistants/call.e2e.ts
src/tests/assistants/contacts.e2e.ts
EOF
}

pr_billing_specs() {
  cat <<'EOF'
src/tests/billing/access-control.e2e.ts
src/tests/billing/balance.e2e.ts
src/tests/billing/usage.e2e.ts
src/tests/billing/banners.e2e.ts
src/tests/billing/billable-action-guard.e2e.ts
EOF
}

pr_auth_specs() {
  cat <<'EOF'
src/tests/auth/login.e2e.ts
src/tests/auth/signup.e2e.ts
src/tests/auth/session.e2e.ts
src/tests/auth/password-management.e2e.ts
src/tests/auth/mfa-login.e2e.ts
src/tests/auth/mfa-profile.e2e.ts
EOF
}

pr_shell_admin_specs() {
  cat <<'EOF'
src/tests/shell/route-shell-smoke.e2e.ts
src/tests/admin/billing-plans.e2e.ts
src/tests/impersonation/view-as.e2e.ts
EOF
}

# Explicit shard lists balance runtime — alphabetical Playwright sharding put
# call/chat-stream/desktop-link on the same shard and blew the job limit.
exhaustive_assistants_specs() {
  local shard="${1:-}"
  case "$shard" in
    1/5)
      cat <<'EOF'
src/tests/assistants/shell.e2e.ts
src/tests/assistants/list.e2e.ts
src/tests/assistants/delete.e2e.ts
src/tests/assistants/list-grouping.e2e.ts
src/tests/assistants/voice.e2e.ts
src/tests/assistants/photo-video.e2e.ts
src/tests/assistants/onboarding.e2e.ts
src/tests/assistants/tasks.e2e.ts
src/tests/assistants/workspace-file-access.e2e.ts
src/tests/assistants/data-bridge.e2e.ts
src/tests/assistants/provider-integrations.e2e.ts
EOF
      ;;
    2/5)
      cat <<'EOF'
src/tests/assistants/chat.e2e.ts
src/tests/assistants/chat-attachments.e2e.ts
src/tests/assistants/chat-search.e2e.ts
src/tests/assistants/embed.e2e.ts
EOF
      ;;
    3/5)
      cat <<'EOF'
src/tests/assistants/brain.e2e.ts
src/tests/assistants/contacts.e2e.ts
src/tests/assistants/coordinator-sidebar.e2e.ts
src/tests/assistants/permissions.e2e.ts
EOF
      ;;
    4/5)
      cat <<'EOF'
src/tests/assistants/call.e2e.ts
src/tests/assistants/call-working-pose.e2e.ts
src/tests/assistants/chat-stream.e2e.ts
src/tests/assistants/coordinator-onboarding.e2e.ts
EOF
      ;;
    5/5)
      cat <<'EOF'
src/tests/assistants/desktop-filesys.e2e.ts
src/tests/assistants/desktop-link.e2e.ts
src/tests/assistants/dashboards.e2e.ts
src/tests/assistants/edit.e2e.ts
src/tests/assistants/hire.e2e.ts
src/tests/assistants/live-actions.e2e.ts
EOF
      ;;
    *)
      find src/tests/assistants -maxdepth 1 -name '*.e2e.ts' | sort
      ;;
  esac
}

case "$TIER" in
  push-gate)
    push_specs
    ;;
  pr-assistants)
    pr_assistants_specs
    ;;
  pr-account)
    find src/tests/account -maxdepth 1 -name '*.e2e.ts' | sort
    ;;
  pr-billing)
    pr_billing_specs
    ;;
  pr-auth)
    pr_auth_specs
    ;;
  pr-shell-admin)
    pr_shell_admin_specs
    ;;
  exhaustive-assistants)
    exhaustive_assistants_specs "$SHARD"
    ;;
  exhaustive-account)
    find src/tests/account -maxdepth 1 -name '*.e2e.ts' | sort
    ;;
  exhaustive-billing)
    find src/tests/billing -maxdepth 1 -name '*.e2e.ts' | sort
    ;;
  exhaustive-auth)
    find src/tests/auth -maxdepth 1 -name '*.e2e.ts' | sort
    ;;
  exhaustive-shell)
    find src/tests/shell -maxdepth 1 -name '*.e2e.ts' | sort
    ;;
  exhaustive-admin)
    find src/tests/admin -maxdepth 1 -name '*.e2e.ts' | sort
    ;;
  exhaustive-impersonation)
    find src/tests/impersonation -maxdepth 1 -name '*.e2e.ts' | sort
    ;;
  *)
    echo "Unknown tier: $TIER" >&2
    exit 1
    ;;
esac
