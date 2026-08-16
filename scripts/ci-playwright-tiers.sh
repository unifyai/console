#!/usr/bin/env bash
# Resolves Console Playwright CI tier and spec lists for push / PR / exhaustive runs.
#
# Push and PR tiers use explicit spec lists (curated smoke / merge gates).
# Exhaustive tiers discover every *.e2e.ts under the relevant src/tests/<area>/ dir;
# ci-playwright-run.sh applies Playwright --shard for parallel matrix jobs.
set -euo pipefail

TIER="${1:-}"

push_specs() {
  cat <<'EOF'
src/tests/auth/login.e2e.ts
src/tests/auth/session.e2e.ts
src/tests/shell/push-gate.e2e.ts
src/tests/shell/route-shell-smoke.e2e.ts
src/tests/shell/unified-shell-navigation.e2e.ts
src/tests/assistants/shell.e2e.ts
src/tests/assistants/list.e2e.ts
src/tests/assistants/chat.e2e.ts
src/tests/assistants/floating-chat.e2e.ts
src/tests/assistants/reactions.e2e.ts
src/tests/billing/billable-action-guard.e2e.ts
src/tests/billing/access-control.e2e.ts
src/tests/account/workspace-context.e2e.ts
EOF
}

pr_account_specs() {
  cat <<'EOF'
src/tests/account/profile.e2e.ts
src/tests/account/api-key.e2e.ts
src/tests/account/contact-info.e2e.ts
src/tests/account/workspace-context.e2e.ts
src/tests/account/teams.e2e.ts
src/tests/account/roles.e2e.ts
src/tests/account/org-management.e2e.ts
src/tests/account/spending-limits.e2e.ts
EOF
}

pr_assistants_specs() {
  cat <<'EOF'
src/tests/assistants/shell.e2e.ts
src/tests/assistants/list.e2e.ts
src/tests/assistants/live-actions.e2e.ts
src/tests/assistants/permissions.e2e.ts
src/tests/assistants/coordinator-onboarding.e2e.ts
EOF
}

pr_billing_specs() {
  cat <<'EOF'
src/tests/billing/access-control.e2e.ts
src/tests/billing/balance.e2e.ts
src/tests/billing/banners.e2e.ts
src/tests/billing/billable-action-guard.e2e.ts
src/tests/billing/subscription-billing.e2e.ts
src/tests/billing/subscribe.e2e.ts
src/tests/billing/credit-grants.e2e.ts
src/tests/billing/referrals.e2e.ts
src/tests/billing/auto-increment.e2e.ts
src/tests/billing/metered-billing.e2e.ts
src/tests/billing/usage.e2e.ts
src/tests/billing/billing-api.e2e.ts
src/tests/billing/billing-events.e2e.ts
src/tests/billing/manual-topup.e2e.ts
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
src/tests/shell/unified-shell-navigation.e2e.ts
src/tests/admin/billing-plans.e2e.ts
src/tests/impersonation/view-as.e2e.ts
EOF
}

case "$TIER" in
  push-gate)
    push_specs
    ;;
  pr-assistants)
    pr_assistants_specs
    ;;
  pr-account)
    pr_account_specs
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
    find src/tests/assistants -maxdepth 1 -name '*.e2e.ts' | sort
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
