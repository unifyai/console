/**
 * Phase 9b coverage registry — source of truth for check-test-coverage-map.ts.
 * Each capability maps to title substrings that must exist in surviving E2E specs.
 * Update when merging/deleting tests.
 */

export type AreaPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface CapabilityDef {
  id: string;
  areaId: string;
  priority: AreaPriority;
  description: string;
  /** Substrings matched against test('...') titles in the given files (any file, any match). */
  matchers: { files: string[]; titleIncludes: string }[];
}

export interface AreaDef {
  id: string;
  priority: AreaPriority;
  minCriticalCapabilities: number;
}

export const areas: AreaDef[] = [
  { id: 'auth.core', priority: 'P0', minCriticalCapabilities: 5 },
  { id: 'auth.mfa', priority: 'P0', minCriticalCapabilities: 4 },
  { id: 'billing.wallet', priority: 'P0', minCriticalCapabilities: 5 },
  { id: 'billing.subscription', priority: 'P0', minCriticalCapabilities: 4 },
  { id: 'billing.access', priority: 'P0', minCriticalCapabilities: 2 },
  { id: 'workspace', priority: 'P0', minCriticalCapabilities: 3 },
  { id: 'assistants.core', priority: 'P0', minCriticalCapabilities: 4 },
  { id: 'admin.impersonation', priority: 'P0', minCriticalCapabilities: 1 },
  { id: 'billing.referrals', priority: 'P1', minCriticalCapabilities: 4 },
  { id: 'billing.credit-grants', priority: 'P1', minCriticalCapabilities: 4 },
  { id: 'billing.auto-increment', priority: 'P1', minCriticalCapabilities: 1 },
  { id: 'billing.metered', priority: 'P1', minCriticalCapabilities: 2 },
  { id: 'billing.usage', priority: 'P1', minCriticalCapabilities: 2 },
  { id: 'billing.api-parity', priority: 'P1', minCriticalCapabilities: 1 },
  { id: 'account.security', priority: 'P1', minCriticalCapabilities: 2 },
  { id: 'account.profile', priority: 'P1', minCriticalCapabilities: 1 },
  { id: 'account.contact', priority: 'P1', minCriticalCapabilities: 2 },
  { id: 'account.org', priority: 'P1', minCriticalCapabilities: 2 },
  { id: 'assistants.permissions', priority: 'P1', minCriticalCapabilities: 2 },
  { id: 'admin.billing-plans', priority: 'P1', minCriticalCapabilities: 2 },
  { id: 'account.support', priority: 'P1', minCriticalCapabilities: 1 },
  { id: 'account.reset', priority: 'P1', minCriticalCapabilities: 1 },
  { id: 'assistants.integrations', priority: 'P1', minCriticalCapabilities: 2 },
  { id: 'assistants.workflows', priority: 'P1', minCriticalCapabilities: 1 },
];

export const capabilities: CapabilityDef[] = [
  {
    id: 'auth.login.valid',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'Valid login redirects',
    matchers: [
      {
        files: ['src/tests/auth/login.e2e.ts'],
        titleIncludes: 'completes login with valid credentials',
      },
    ],
  },
  {
    id: 'auth.login.invalid',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'Invalid password error',
    matchers: [
      { files: ['src/tests/auth/login.e2e.ts'], titleIncludes: 'shows error for invalid password' },
    ],
  },
  {
    id: 'auth.login.unregistered',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'Unregistered email error',
    matchers: [
      {
        files: ['src/tests/auth/login.e2e.ts'],
        titleIncludes: 'shows error when email is not registered',
      },
    ],
  },
  {
    id: 'auth.login.oauth-conflict',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'OAuth-only email conflict',
    matchers: [
      {
        files: ['src/tests/auth/login.e2e.ts'],
        titleIncludes: 'shows provider conflict when email is registered with OAuth only',
      },
    ],
  },
  {
    id: 'auth.signup.flow',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'Full signup flow',
    matchers: [
      { files: ['src/tests/auth/signup.e2e.ts'], titleIncludes: 'completes full registration' },
    ],
  },
  {
    id: 'auth.signup.onboard',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'Onboarding to assistants',
    matchers: [
      {
        files: ['src/tests/auth/signup.e2e.ts'],
        titleIncludes: 'selects personal workspace and redirects to assistants',
      },
    ],
  },
  {
    id: 'auth.signup.heard-about',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'Required onboarding acquisition step',
    matchers: [
      {
        files: ['src/tests/auth/signup.e2e.ts'],
        titleIncludes: 'requires how-did-you-hear before workspace setup',
      },
    ],
  },
  {
    id: 'auth.session.signout',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'Stale session signout',
    matchers: [
      {
        files: ['src/tests/auth/session.e2e.ts'],
        titleIncludes: 'clears session and shows login form when signout=true with active session',
      },
    ],
  },
  {
    id: 'auth.password.change',
    areaId: 'auth.core',
    priority: 'P0',
    description: 'Password change + re-login',
    matchers: [
      {
        files: ['src/tests/auth/password-management.e2e.ts'],
        titleIncludes: 'changes password successfully and can re-login with new password',
      },
    ],
  },
  {
    id: 'auth.mfa.totp',
    areaId: 'auth.mfa',
    priority: 'P0',
    description: 'MFA TOTP login',
    matchers: [
      {
        files: ['src/tests/auth/mfa-login.e2e.ts'],
        titleIncludes: 'completes TOTP verification and redirects after login',
      },
    ],
  },
  {
    id: 'auth.mfa.invalid',
    areaId: 'auth.mfa',
    priority: 'P0',
    description: 'Invalid TOTP',
    matchers: [
      {
        files: ['src/tests/auth/mfa-login.e2e.ts'],
        titleIncludes: 'shows error for invalid TOTP code',
      },
    ],
  },
  {
    id: 'auth.mfa.setup',
    areaId: 'auth.mfa',
    priority: 'P0',
    description: 'MFA setup from profile',
    matchers: [
      { files: ['src/tests/auth/mfa-profile.e2e.ts'], titleIncludes: 'completes full MFA setup' },
    ],
  },
  {
    id: 'auth.mfa.disable',
    areaId: 'auth.mfa',
    priority: 'P0',
    description: 'MFA disable',
    matchers: [
      {
        files: ['src/tests/auth/mfa-profile.e2e.ts'],
        titleIncludes: 'disables 2FA with a valid TOTP code',
      },
    ],
  },
  {
    id: 'billing.balance.ui-db',
    areaId: 'billing.wallet',
    priority: 'P0',
    description: 'Balance UI matches DB',
    matchers: [
      {
        files: ['src/tests/billing/balance.e2e.ts'],
        titleIncludes: 'billing page balance matches DB and refreshes after credits change',
      },
    ],
  },
  {
    id: 'billing.guard.block',
    areaId: 'billing.wallet',
    priority: 'P0',
    description: 'Guard blocks at zero credits',
    matchers: [
      {
        files: ['src/tests/billing/billable-action-guard.e2e.ts'],
        titleIncludes: 'blocks the onboard CTA when user has no credits',
      },
    ],
  },
  {
    id: 'billing.guard.enable',
    areaId: 'billing.wallet',
    priority: 'P0',
    description: 'Guard enabled with credits',
    matchers: [
      {
        files: ['src/tests/billing/billable-action-guard.e2e.ts'],
        titleIncludes: 'buttons are enabled when user has credits',
      },
    ],
  },
  {
    id: 'billing.guard.metered',
    areaId: 'billing.wallet',
    priority: 'P0',
    description: 'Metered bypass at zero wallet',
    matchers: [
      {
        files: ['src/tests/billing/billable-action-guard.e2e.ts'],
        titleIncludes: 'METERED account with $0 wallet keeps billable actions enabled',
      },
    ],
  },
  {
    id: 'billing.banner.ooc',
    areaId: 'billing.wallet',
    priority: 'P0',
    description: 'Out-of-credits banner',
    matchers: [
      {
        files: ['src/tests/billing/banners.e2e.ts'],
        titleIncludes: 'out-of-credits banner appears at zero or negative balance',
      },
    ],
  },
  {
    id: 'billing.banner.metered',
    areaId: 'billing.wallet',
    priority: 'P0',
    description: 'No OOC banner for metered zero balance',
    matchers: [
      {
        files: ['src/tests/billing/banners.e2e.ts'],
        titleIncludes: 'does not show out-of-credits banner for zero-balance metered account',
      },
    ],
  },
  {
    id: 'billing.access.redirect',
    areaId: 'billing.access',
    priority: 'P0',
    description: 'Billing redirect unauthenticated',
    matchers: [
      {
        files: ['src/tests/billing/access-control.e2e.ts'],
        titleIncludes: 'billing page redirects unauthenticated users to login',
      },
    ],
  },
  {
    id: 'billing.access.page',
    areaId: 'billing.access',
    priority: 'P0',
    description: 'Billing page sections',
    matchers: [
      {
        files: ['src/tests/billing/access-control.e2e.ts'],
        titleIncludes: 'billing page shows all main sections',
      },
    ],
  },
  {
    id: 'billing.subscription.render',
    areaId: 'billing.subscription',
    priority: 'P0',
    description: 'Subscribed tier rendering',
    matchers: [
      {
        files: ['src/tests/billing/subscription-billing.e2e.ts'],
        titleIncludes: 'monthly subscription renders tier, renewal',
      },
    ],
  },
  {
    id: 'billing.subscription.subscribe',
    areaId: 'billing.subscription',
    priority: 'P0',
    description: 'Subscribe flow',
    matchers: [
      {
        files: [
          'src/tests/billing/subscription-billing.e2e.ts',
          'src/tests/billing/subscribe.e2e.ts',
        ],
        titleIncludes: 'subscribed account shows current tier',
      },
    ],
  },
  {
    id: 'billing.subscription.tier-change',
    areaId: 'billing.subscription',
    priority: 'P0',
    description: 'Tier change confirm',
    matchers: [
      {
        files: ['src/tests/billing/subscription-billing.e2e.ts'],
        titleIncludes: 'changing tier keeps a confirm dialog',
      },
    ],
  },
  {
    id: 'billing.subscription.cancel',
    areaId: 'billing.subscription',
    priority: 'P0',
    description: 'Cancel subscription',
    matchers: [
      {
        files: ['src/tests/billing/subscription-billing.e2e.ts'],
        titleIncludes: 'cancel keeps access until period end',
      },
    ],
  },
  {
    id: 'billing.subscription.past-due',
    areaId: 'billing.subscription',
    priority: 'P0',
    description: 'PAST_DUE banner',
    matchers: [
      {
        files: ['src/tests/billing/subscription-billing.e2e.ts'],
        titleIncludes: 'PAST_DUE shows a soft banner',
      },
    ],
  },
  {
    id: 'workspace.api-keys',
    areaId: 'workspace',
    priority: 'P0',
    description: 'Distinct workspace API keys',
    matchers: [
      {
        files: ['src/tests/account/workspace-context.e2e.ts'],
        titleIncludes: 'personal and org workspaces expose distinct API keys',
      },
    ],
  },
  {
    id: 'workspace.org-balance',
    areaId: 'workspace',
    priority: 'P0',
    description: 'Org billing balance',
    matchers: [
      {
        files: ['src/tests/account/workspace-context.e2e.ts'],
        titleIncludes: 'switching to org workspace returns org billing balance',
      },
    ],
  },
  {
    id: 'workspace.teams.crud',
    areaId: 'workspace',
    priority: 'P0',
    description: 'Team lifecycle',
    matchers: [
      {
        files: ['src/tests/account/teams.e2e.ts'],
        titleIncludes: 'team lifecycle via UI creates',
      },
    ],
  },
  {
    id: 'assistants.shell.rail',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'Rail renders',
    matchers: [
      {
        files: ['src/tests/assistants/shell.e2e.ts', 'src/tests/shell/push-gate.e2e.ts'],
        titleIncludes: 'rail renders with brand and unity switcher',
      },
    ],
  },
  {
    id: 'assistants.list.hire',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'Hire updates list',
    matchers: [
      {
        files: ['src/tests/assistants/list.e2e.ts'],
        titleIncludes: 'list updates after hiring a new assistant without page reload',
      },
    ],
  },
  {
    id: 'assistants.list.onboard',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'Onboard dialog',
    matchers: [
      {
        files: ['src/tests/assistants/list.e2e.ts'],
        titleIncludes: 'Onboard button opens the hire dialog',
      },
    ],
  },
  {
    id: 'assistants.list.render',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'Seeded list renders',
    matchers: [
      {
        files: ['src/tests/assistants/list.e2e.ts'],
        titleIncludes: 'seeded assistants appear in the list with correct names',
      },
    ],
  },
  {
    id: 'shell.route.favourites',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'Favourites route in rail shell',
    matchers: [
      {
        files: ['src/tests/shell/route-shell-smoke.e2e.ts'],
        titleIncludes: '/favourites renders inside the rail shell',
      },
    ],
  },
  {
    id: 'shell.route.interfaces',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'Interfaces route in rail shell',
    matchers: [
      {
        files: ['src/tests/shell/route-shell-smoke.e2e.ts'],
        titleIncludes: '/interfaces renders inside the rail shell for a Unify member',
      },
    ],
  },
  {
    id: 'shell.route.unified-navigation',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'Unified shell navigation preserves assistant state',
    matchers: [
      {
        files: ['src/tests/shell/unified-shell-navigation.e2e.ts'],
        titleIncludes:
          'settings/admin/assistants switch without document reload and preserve assistant state',
      },
    ],
  },
  {
    id: 'assistants.list.select',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'List selection',
    matchers: [
      {
        files: ['src/tests/assistants/list.e2e.ts'],
        titleIncludes: 'clicking an assistant in the list selects it',
      },
    ],
  },
  {
    id: 'assistants.chat.send',
    areaId: 'assistants.chat',
    priority: 'P2',
    description: 'Send chat message',
    matchers: [
      {
        files: ['src/tests/assistants/chat.e2e.ts'],
        titleIncludes: 'sending a message shows it as a user message in the chat',
      },
    ],
  },
  {
    id: 'assistants.chat.historical',
    areaId: 'assistants.chat',
    priority: 'P2',
    description: 'Load historical transcript',
    matchers: [
      {
        files: ['src/tests/assistants/chat.e2e.ts'],
        titleIncludes: 'historical transcript messages load when navigating to an assistant',
      },
    ],
  },
  {
    id: 'assistants.chat.credits',
    areaId: 'assistants.chat',
    priority: 'P2',
    description: 'Chat input credit guard',
    matchers: [
      {
        files: ['src/tests/assistants/chat.e2e.ts'],
        titleIncludes:
          'chat input is disabled when credits are exhausted and re-enables after funding',
      },
    ],
  },
  {
    id: 'admin.impersonation.view-as',
    areaId: 'admin.impersonation',
    priority: 'P0',
    description: 'View-as flow',
    matchers: [
      {
        files: ['src/tests/impersonation/view-as.e2e.ts'],
        titleIncludes: 'Unify member can view as another user and return',
      },
    ],
  },
  {
    id: 'billing.referrals.link',
    areaId: 'billing.referrals',
    priority: 'P1',
    description: 'Referral link',
    matchers: [
      {
        files: ['src/tests/billing/referrals.e2e.ts'],
        titleIncludes: 'returns a referral link and code for the caller',
      },
    ],
  },
  {
    id: 'billing.referrals.attribute',
    areaId: 'billing.referrals',
    priority: 'P1',
    description: 'Friend attribution',
    matchers: [
      {
        files: ['src/tests/billing/referrals.e2e.ts'],
        titleIncludes: 'attributes a referred friend to the referrer code',
      },
    ],
  },
  {
    id: 'billing.referrals.self',
    areaId: 'billing.referrals',
    priority: 'P1',
    description: 'Self-referral block',
    matchers: [
      { files: ['src/tests/billing/referrals.e2e.ts'], titleIncludes: 'blocks self-referral' },
    ],
  },
  {
    id: 'billing.referrals.dashboard',
    areaId: 'billing.referrals',
    priority: 'P1',
    description: 'Referrer dashboard',
    matchers: [
      {
        files: ['src/tests/billing/referrals.e2e.ts'],
        titleIncludes: 'referrer dashboard reflects a rewarded referral',
      },
    ],
  },
  {
    id: 'billing.grants.ui-claim',
    areaId: 'billing.credit-grants',
    priority: 'P1',
    description: 'Claim grant via assistants URL',
    matchers: [
      {
        files: ['src/tests/billing/credit-grants.e2e.ts'],
        titleIncludes: '?token= on assistants auto-claims credits',
      },
    ],
  },
  {
    id: 'billing.grants.claim',
    areaId: 'billing.credit-grants',
    priority: 'P1',
    description: 'Claim grant',
    matchers: [
      {
        files: ['src/tests/billing/credit-grants.e2e.ts'],
        titleIncludes: 'claims a credit grant link and credits are applied',
      },
    ],
  },
  {
    id: 'billing.grants.double',
    areaId: 'billing.credit-grants',
    priority: 'P1',
    description: 'Double claim',
    matchers: [
      {
        files: ['src/tests/billing/credit-grants.e2e.ts'],
        titleIncludes: 'second claim by same user returns already-claimed message',
      },
    ],
  },
  {
    id: 'billing.grants.max',
    areaId: 'billing.credit-grants',
    priority: 'P1',
    description: 'Max claims',
    matchers: [
      {
        files: ['src/tests/billing/credit-grants.e2e.ts'],
        titleIncludes: 'link with max_claims=1 rejects second user',
      },
    ],
  },
  {
    id: 'billing.usage.ledger',
    areaId: 'billing.usage',
    priority: 'P1',
    description: 'Ledger categories',
    matchers: [
      {
        files: ['src/tests/billing/usage.e2e.ts'],
        titleIncludes: 'ledger displays seeded transactions with correct category descriptions',
      },
    ],
  },
  {
    id: 'billing.usage.auth',
    areaId: 'billing.usage',
    priority: 'P1',
    description: 'Usage auth redirect',
    matchers: [
      {
        files: ['src/tests/billing/usage.e2e.ts'],
        titleIncludes: 'redirects to login when not authenticated',
      },
    ],
  },
  {
    id: 'account.apikey.mask',
    areaId: 'account.security',
    priority: 'P1',
    description: 'API key masked',
    matchers: [
      {
        files: ['src/tests/account/api-key.e2e.ts'],
        titleIncludes: 'Security tab masks the API key until revealed',
      },
    ],
  },
  {
    id: 'account.apikey.regen',
    areaId: 'account.security',
    priority: 'P1',
    description: 'API key regenerate',
    matchers: [
      {
        files: ['src/tests/account/api-key.e2e.ts'],
        titleIncludes: 'regenerating API key produces a new key in the database',
      },
    ],
  },
  {
    id: 'account.profile.autosave',
    areaId: 'account.profile',
    priority: 'P1',
    description: 'Profile auto-save reload',
    matchers: [
      {
        files: ['src/tests/account/profile.e2e.ts'],
        titleIncludes: 'auto-saved profile name persists after page reload',
      },
    ],
  },
  {
    id: 'admin.billing-plans.create',
    areaId: 'admin.billing-plans',
    priority: 'P1',
    description: 'Create billing template',
    matchers: [
      {
        files: ['src/tests/admin/billing-plans.e2e.ts'],
        titleIncludes: 'billing plans page creates a BESPOKE template',
      },
    ],
  },
  {
    id: 'admin.billing-plans.assign',
    areaId: 'admin.billing-plans',
    priority: 'P1',
    description: 'Assign template to org',
    matchers: [
      {
        files: ['src/tests/admin/billing-plans.e2e.ts'],
        titleIncludes: 'organizations page sets the new template on the target org',
      },
    ],
  },
  {
    id: 'billing.auto-increment.toggle',
    areaId: 'billing.auto-increment',
    priority: 'P1',
    description: 'Auto-increment toggle syncs with API',
    matchers: [
      {
        files: ['src/tests/billing/auto-increment.e2e.ts'],
        titleIncludes: 'subscribed account toggle stays in sync with the API',
      },
    ],
  },
  {
    id: 'account.support.submit',
    areaId: 'account.support',
    priority: 'P1',
    description: 'Support ticket submission',
    matchers: [
      {
        files: ['src/tests/account/support-ticket.e2e.ts'],
        titleIncludes: 'submits ticket and shows success toast',
      },
    ],
  },
  {
    id: 'account.reset.flow',
    areaId: 'account.reset',
    priority: 'P1',
    description: 'Account reset when mode active',
    matchers: [
      {
        files: ['src/tests/account/reset-account.e2e.ts'],
        titleIncludes: 'Unify member resets their account back to fresh-signup state',
      },
    ],
  },
  {
    id: 'assistants.integrations.connected-apps',
    areaId: 'assistants.integrations',
    priority: 'P1',
    description: 'Connected apps integrations UI',
    matchers: [
      {
        files: ['src/tests/assistants/provider-integrations.e2e.ts'],
        titleIncludes: 'mock connected-apps page shows dynamic apps',
      },
    ],
  },
  {
    id: 'assistants.integrations.workspace-card',
    areaId: 'assistants.integrations',
    priority: 'P1',
    description: 'Workspace provider card',
    matchers: [
      {
        files: ['src/tests/assistants/workspace-provider-card.e2e.ts'],
        titleIncludes: 'workspace card shows the connected Microsoft provider',
      },
    ],
  },
  {
    id: 'assistants.workflows.install-journey',
    areaId: 'assistants.workflows',
    priority: 'P1',
    description: 'Workflows shelf install/uninstall journey',
    matchers: [
      {
        files: ['src/tests/assistants/workflows.e2e.ts'],
        titleIncludes: 'workflows rail section opens the shelf and installs a curated workflow',
      },
    ],
  },
  {
    id: 'assistants.coordinator-onboarding.picker',
    areaId: 'assistants.coordinator-onboarding',
    priority: 'P2',
    description: 'Fresh-visit picker with no skip or resume affordance',
    matchers: [
      {
        files: ['src/tests/assistants/coordinator-onboarding.e2e.ts'],
        titleIncludes: 'picker shows on first visit with no skip or resume affordance',
      },
    ],
  },
  {
    id: 'assistants.coordinator-onboarding.pick-chat',
    areaId: 'assistants.coordinator-onboarding',
    priority: 'P2',
    description: 'Chat choice lands in the platform with the checklist in Assistant info',
    matchers: [
      {
        files: ['src/tests/assistants/coordinator-onboarding.e2e.ts'],
        titleIncludes:
          'picking chat lands in the full platform with the checklist in Assistant info',
      },
    ],
  },
  {
    id: 'assistants.coordinator-onboarding.start-call',
    areaId: 'assistants.coordinator-onboarding',
    priority: 'P2',
    description: 'Call choice connects and docks the call in the platform',
    matchers: [
      {
        files: ['src/tests/assistants/coordinator-onboarding.e2e.ts'],
        titleIncludes: 'starting a call connects and docks the call in the platform',
      },
    ],
  },
  {
    id: 'assistants.coordinator-onboarding.intro-watched',
    areaId: 'assistants.coordinator-onboarding',
    priority: 'P2',
    description: 'Resolved picker persists intro_watched and survives reload',
    matchers: [
      {
        files: ['src/tests/assistants/coordinator-onboarding.e2e.ts'],
        titleIncludes:
          'resolving the picker persists intro_watched and reload lands on T-W1N without auto-opening Assistant info',
      },
    ],
  },
  {
    id: 'assistants.shell.switcher',
    areaId: 'assistants.core',
    priority: 'P0',
    description: 'Unity switcher drives section host',
    matchers: [
      {
        files: ['src/tests/assistants/shell.e2e.ts'],
        titleIncludes: 'the unity switcher opens and selecting a unity drives the section host',
      },
    ],
  },
  {
    id: 'assistants.live-actions.historical',
    areaId: 'assistants.live-actions',
    priority: 'P2',
    description: 'Historical actions on load',
    matchers: [
      {
        files: ['src/tests/assistants/live-actions.e2e.ts'],
        titleIncludes: 'historical events seeded in Orchestra appear on initial load',
      },
    ],
  },
  {
    id: 'assistants.live-actions.live',
    areaId: 'assistants.live-actions',
    priority: 'P2',
    description: 'Live action SSE delivery',
    matchers: [
      {
        files: ['src/tests/assistants/live-actions.e2e.ts'],
        titleIncludes: 'live events appear in real time over the Actions SSE path',
      },
    ],
  },
  {
    id: 'billing.api-parity.balance',
    areaId: 'billing.api-parity',
    priority: 'P1',
    description: 'Balance UI matches API',
    matchers: [
      {
        files: ['src/tests/billing/billing-api.e2e.ts'],
        titleIncludes: 'balance UI matches the balance API for authenticated user',
      },
    ],
  },
  {
    id: 'billing.metered.card',
    areaId: 'billing.metered',
    priority: 'P1',
    description: 'METERED plan card',
    matchers: [
      {
        files: ['src/tests/billing/metered-billing.e2e.ts'],
        titleIncludes: 'shows the METERED plan card and hides self-serve credits UI',
      },
    ],
  },
  {
    id: 'billing.metered.invoices',
    areaId: 'billing.metered',
    priority: 'P1',
    description: 'Metered invoices table',
    matchers: [
      {
        files: ['src/tests/billing/metered-billing.e2e.ts'],
        titleIncludes: 'renders the invoices table with rows ordered newest-first',
      },
    ],
  },
  {
    id: 'account.contact.verify',
    areaId: 'account.contact',
    priority: 'P1',
    description: 'Phone verify persists E.164',
    matchers: [
      {
        files: ['src/tests/account/contact-info.e2e.ts'],
        titleIncludes: 'verifying a number eagerly persists it with no Save button',
      },
    ],
  },
  {
    id: 'account.contact.hydrate',
    areaId: 'account.contact',
    priority: 'P1',
    description: 'Saved E.164 hydration',
    matchers: [
      {
        files: ['src/tests/account/contact-info.e2e.ts'],
        titleIncludes: 'a saved E.164 number is split back into country + national parts',
      },
    ],
  },
  {
    id: 'account.org.roles',
    areaId: 'account.org',
    priority: 'P1',
    description: 'Custom role lifecycle',
    matchers: [
      {
        files: ['src/tests/account/roles.e2e.ts'],
        titleIncludes: 'creating a custom role via UI persists it in the database',
      },
    ],
  },
  {
    id: 'account.org.members',
    areaId: 'account.org',
    priority: 'P1',
    description: 'Org member management',
    matchers: [
      {
        files: ['src/tests/account/org-management.e2e.ts'],
        titleIncludes: 'inviting a member via UI creates an invite record in DB',
      },
    ],
  },
  {
    id: 'assistants.permissions.member-deny',
    areaId: 'assistants.permissions',
    priority: 'P1',
    description: 'Member denied hire',
    matchers: [
      {
        files: ['src/tests/assistants/permissions.e2e.ts'],
        titleIncludes: 'member cannot see the "New" hire button in the assistant list',
      },
    ],
  },
  {
    id: 'assistants.permissions.member-edit',
    areaId: 'assistants.permissions',
    priority: 'P1',
    description: 'Member cannot open edit on others assistants',
    matchers: [
      {
        files: ['src/tests/assistants/permissions.e2e.ts'],
        titleIncludes: "member cannot open edit dialog on owner's assistant",
      },
    ],
  },
];

/** Spec files removed from the suite — excluded from inventory sync requirements. */
export const removedSpecFiles = [
  'src/tests/account/timezone-sync.e2e.ts',
  'src/tests/assistants/list-grouping.e2e.ts',
  'src/tests/assistants/photo-video.e2e.ts',
  'src/tests/shell/responsive-drawer-layout.e2e.ts',
];

export function areaKeyForSpec(specPath: string): string {
  if (specPath.includes('/auth/')) return 'auth';
  if (specPath.includes('/billing/')) return 'billing';
  if (specPath.includes('/account/')) return 'account';
  if (specPath.includes('/assistants/')) return 'assistants';
  if (specPath.includes('/shell/')) return 'shell';
  if (specPath.includes('/admin/')) return 'admin';
  if (specPath.includes('/impersonation/')) return 'impersonation';
  return 'shell';
}

/** Default area priority for CI sampling when a test has no @area tag. */
export function defaultPriorityForSpec(specPath: string): AreaPriority {
  const key = areaKeyForSpec(specPath);
  if (key === 'auth' || key === 'billing') return 'P0';
  if (key === 'account' || key === 'admin' || key === 'impersonation') return 'P1';
  if (key === 'assistants') return 'P2';
  return 'P3';
}

export function parseTestTags(title: string): {
  critical: boolean;
  push: boolean;
  areaId?: string;
} {
  const critical = title.includes('@critical');
  const push = title.includes('@push');
  const areaMatch = title.match(/@area\(([^)]+)\)/);
  return { critical, push, areaId: areaMatch?.[1] };
}
