/**
 * Shared Playwright helpers for billing E2E tests.
 *
 * Key pattern: each test file creates one user + an `authedPage` fixture
 * that logs in once and reuses the session (storageState). Every test
 * just navigates — no login. This cuts ~10s per test.
 *
 * Usage:
 * ```ts
 * const user = createTestUser({ ... });
 * const test = createBillingTest(user);
 * test.afterAll(() => cleanupUser(user.id));
 * test('my test', async ({ authedPage: page }) => { ... });
 * ```
 */

import { test as base, expect, type Page, type Browser } from '@playwright/test';
import path from 'path';
import os from 'os';

export { createTestUser, cleanupUser, setUserCredits } from '../helpers/e2e-helpers';
export type { TestUser } from '../helpers/e2e-helpers';

import {
  uniqueEmail,
  dbExec,
  dbExecBlock,
  dbExecStdin,
  createUser,
  createOrg,
  deleteOrg,
  addMember,
  orchestraFetch,
} from '../helpers/seeds/client';
export {
  uniqueEmail,
  dbExec,
  dbExecBlock,
  dbExecStdin,
  createUser,
  createOrg,
  deleteOrg,
  addMember,
  orchestraFetch,
};
export type { SeededOrg } from '../helpers/seeds/types';

import {
  login,
  loginAndWaitForRedirect,
  switchToEmailTab,
  completeAccountOnboardingIfPresent,
} from '../auth/helpers';
import {
  deferCoordinatorAfterAssistantsLoad,
  deferCoordinatorForUser,
  dismissCoordinatorOnboardingIfOpen,
} from '../helpers/coordinator';
import { assistantRail, railUnitySwitcher, waitForAssistantsRail } from '../helpers/shell';
export { login, switchToEmailTab };

/** Wait until the assistants shell is interactive (replaces legacy text=/assistant/i waits). */
export async function waitForAssistantsReady(
  page: Page,
  opts?: { userId: string; apiKey: string }
) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
    } catch {
      /* private mode — ignore */
    }
  });
  await page.goto('/assistants');
  await waitForAssistantsRail(page);
  if (opts) {
    await deferCoordinatorAfterAssistantsLoad(page, opts.userId, opts.apiKey);
    await dismissCoordinatorOnboardingIfOpen(page);
  }
  await expect(railUnitySwitcher(page)).toBeVisible({ timeout: 10_000 });
}

/** Wait until the billing page has loaded (credits self-serve or metered plan layout). */
export async function waitForBillingReady(page: Page) {
  await page.goto('/billing');
  await expect(
    page.getByTestId('metered-plan-section').or(page.getByTestId('credits-balance-section'))
  ).toBeVisible({ timeout: 15_000 });
}

/** Local Orchestra enables manual-top-up mode — credits + top-up only, no Stripe UI. */
export async function isManualTopupMode(page: Page): Promise<boolean> {
  return page
    .getByTestId('topup-section')
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
}

/**
 * Skip UI tests that require the Stripe subscription billing surface (profile,
 * tier picker, referrals, metered layout). No-op in hosted Stripe environments.
 */
export async function skipIfManualTopupBilling(
  testInstance: { skip: (condition: boolean, description: string) => void },
  page: Page
): Promise<void> {
  await waitForBillingReady(page);
  if (await isManualTopupMode(page)) {
    testInstance.skip(
      true,
      'Stripe subscription billing UI is unavailable in manual-top-up mode (local Orchestra).'
    );
  }
}

/** Wait until the usage dashboard has loaded filters and main content. */
export async function waitForUsageReady(page: Page) {
  await page.goto('/usage');
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('usage-filters-bar')).toBeVisible({ timeout: 15_000 });
}

async function openUnitySwitcherDialog(page: Page, opts?: { userId: string; apiKey: string }) {
  const picker = page.getByTestId('rail-unity-switcher-dialog');
  if (!(await picker.isVisible({ timeout: 500 }).catch(() => false))) {
    if (opts) {
      await deferCoordinatorAfterAssistantsLoad(page, opts.userId, opts.apiKey);
    }
    await dismissCoordinatorOnboardingIfOpen(page);
    const switcher = railUnitySwitcher(page);
    await expect(switcher).toBeVisible({ timeout: 10_000 });
    await switcher.click({ timeout: 10_000 });
  }
  await expect(picker).toBeVisible({ timeout: 5_000 });
}

/** Assert the rail onboard CTA is enabled (canonical billable action on /assistants). */
export async function expectOnboardButtonEnabled(
  page: Page,
  opts?: { userId: string; apiKey: string }
) {
  await waitForAssistantsReady(page, opts);
  await openUnitySwitcherDialog(page, opts);
  await expect(page.getByTestId('assistant-onboard-button')).toBeEnabled({ timeout: 10_000 });
}

/** Assert the rail onboard CTA is blocked when credits are exhausted. */
export async function expectOnboardButtonDisabled(
  page: Page,
  opts?: { userId: string; apiKey: string }
) {
  await waitForAssistantsReady(page, opts);
  await openUnitySwitcherDialog(page, opts);
  await expect
    .poll(async () => page.locator('[data-testid="billable-action-guard"]').isVisible(), {
      timeout: 20_000,
    })
    .toBe(true);
  await expect(page.getByTestId('assistant-onboard-button')).toBeDisabled({ timeout: 10_000 });
  await expect(page.locator('[data-testid="billable-action-guard"]')).toBeVisible({
    timeout: 5_000,
  });
}

// =============================================================================
// Shared Auth — storageState
// =============================================================================

/**
 * Log in once and persist cookies to a temp file. Returns the path to
 * the storageState JSON so test files can set `test.use({ storageState })`.
 *
 * Call in `test.beforeAll` and store the returned path:
 * ```ts
 * let authFile: string;
 * test.beforeAll(async ({ browser }) => {
 *   authFile = await loginAndSaveState(browser, email, password);
 * });
 * test.use({ storageState: () => authFile });
 * ```
 */
export async function loginAndSaveState(
  browser: Browser,
  email: string,
  password: string,
  opts?: { userId?: string; apiKey?: string }
): Promise<string> {
  if (opts?.userId && opts?.apiKey) {
    await deferCoordinatorForUser(opts.userId, opts.apiKey);
  }
  const stateFile = path.join(os.tmpdir(), `pw-billing-${email.replace(/[^a-z0-9]/gi, '-')}.json`);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 30_000);

  await completeAccountOnboardingIfPresent(page);

  await ctx.storageState({ path: stateFile });
  await ctx.close();
  return stateFile;
}

/**
 * Legacy helper — logs in via the browser every time.
 * Prefer `loginAndSaveState` + `test.use({ storageState })` for speed.
 */
export async function loginAndNavigateTo(
  page: Page,
  email: string,
  password: string,
  targetUrl: string
) {
  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 20_000);

  await completeAccountOnboardingIfPresent(page);

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
}

// =============================================================================
// Authenticated Page Fixture
// =============================================================================

/**
 * Creates a Playwright `test` object with an `authedPage` fixture.
 * The fixture logs in once per worker and reuses the session for every test.
 *
 * For unauthenticated tests, use the built-in `page` fixture (fresh context).
 */
export function createBillingTest(
  user: { id: string; email: string; password: string; apiKey: string },
  opts?: { skipWhenManualTopup?: boolean }
) {
  let authFile: string | undefined;

  return base.extend<{ authedPage: Page }>({
    authedPage: async ({ browser }, use, testInfo) => {
      if (!authFile) {
        testInfo.setTimeout(testInfo.timeout + 30_000);
        authFile = await loginAndSaveState(browser, user.email, user.password, {
          userId: user.id,
          apiKey: user.apiKey,
        });
        const warmCtx = await browser.newContext({ storageState: authFile });
        const warmPage = await warmCtx.newPage();
        await warmPage.addInitScript(() => {
          try {
            window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
          } catch {
            /* private mode — ignore */
          }
        });
        await warmPage.goto('/assistants', { waitUntil: 'domcontentloaded' });
        await deferCoordinatorAfterAssistantsLoad(warmPage, user.id, user.apiKey);
        await dismissCoordinatorOnboardingIfOpen(warmPage);
        await warmCtx.storageState({ path: authFile });
        await warmCtx.close();
      }
      const ctx = await browser.newContext({ storageState: authFile });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('console:assistants:onboarding:disabled', 'true');
        } catch {
          /* private mode — ignore */
        }
      });
      if (opts?.skipWhenManualTopup) {
        await page.goto('/billing');
        const isMetered = await page
          .getByTestId('metered-plan-section')
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        if (!isMetered) {
          await expect(page.getByTestId('credits-balance-section')).toBeVisible({
            timeout: 15_000,
          });
          if (await isManualTopupMode(page)) {
            testInfo.skip(
              true,
              'Stripe subscription billing UI is unavailable in manual-top-up mode (local Orchestra).'
            );
          }
        }
      }
      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(page);
      await ctx.close();
    },
  });
}

// =============================================================================
// DB Seed Helpers
// =============================================================================

/**
 * Toggle subscription auto-increment for a user's billing account.
 *
 * Replaces the legacy ``setAutoRecharge`` helper: the one-time
 * auto-recharge columns (``autorecharge`` / ``autorecharge_threshold`` /
 * ``autorecharge_qty``) were dropped in the self-serve subscription
 * overhaul. ``auto_increment`` is the surviving "top me up automatically
 * on depletion" toggle (bumps to the next tier).
 */
export function setAutoIncrement(userId: string, enabled: boolean) {
  dbExec(
    `UPDATE billing_account SET auto_increment = ${enabled}
     WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}')`
  );
}

export function setAccountStatus(
  userId: string,
  status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CLOSED'
) {
  dbExec(
    `UPDATE billing_account SET account_status = '${status}'
     WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}')`
  );
}

export function getBillingAccountId(userId: string): number {
  return parseInt(dbExec(`SELECT billing_account_id FROM "user" WHERE id = '${userId}'`), 10);
}

/**
 * Mark (or clear) a subscription as scheduled to cancel at period end —
 * the post-`customer.subscription.updated` state the console renders as
 * "Canceling / Cancels on …" with a "Resume subscription" affordance.
 *
 * Mirrors the `subscription_cancel_at_period_end` flag the webhook flips
 * when a holder cancels (Stripe keeps the sub active until the period end).
 * `/v0/billing/account-info` only surfaces it when the account is actually
 * subscribed, so call this *after* {@link subscribeUserToTier}.
 */
export function setCancelAtPeriodEnd(userId: string, scheduled: boolean) {
  dbExec(
    `UPDATE billing_account SET subscription_cancel_at_period_end = ${scheduled} ` +
      `WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}')`
  );
}

// =============================================================================
// Self-serve subscription seed helpers
// =============================================================================

/**
 * Resolve a seeded self-serve tier template id by its canonical name
 * (e.g. `tier_50`, `tier_200_annual`). These rows are created by the
 * `self_serve_sub_tiers` / `annual_sub_tiers` migrations, so the lookup
 * fails loudly if migrations haven't run against the local DB.
 */
export function getTierTemplateId(tierName: string): number {
  const raw = dbExec(`SELECT id FROM billing_plan_template WHERE name = '${tierName}' LIMIT 1`);
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id)) {
    throw new Error(
      `Tier template '${tierName}' not found — run Orchestra migrations against the local DB.`
    );
  }
  return id;
}

export interface SubscribeTierOptions {
  /** Seeded tier template name, e.g. `tier_50` (monthly) or `tier_200_annual`. */
  tierName: string;
  /** Wallet balance (canonical USD value) to show as remaining this cycle. */
  credits?: number;
  /** Days until the current period ends (renewal). Defaults 30 (monthly) / 365 (annual). */
  periodEndDays?: number;
  /** Stripe subscription id to attach (any non-empty value marks the account subscribed). */
  subscriptionId?: string;
  /** Opt into auto-increment-on-depletion. */
  autoIncrement?: boolean;
}

/**
 * Put a user's billing account onto a live self-serve subscription tier —
 * the post-`invoice.paid` steady state the console renders for a
 * subscribed account.
 *
 * Mirrors what the subscribe + `invoice.paid` webhook path leaves behind:
 *   * an active `billing_plan_assignment` pointing at the tier template;
 *   * `billing_account.stripe_subscription_id` set (the backend's
 *     `is_subscribed` gate requires BOTH this AND a CREDITS /
 *     STRIPE_SUBSCRIPTION tier — see `/v0/billing/account-info`);
 *   * `current_period_end` (drives the "Renews on …" date);
 *   * `plan_credits_granted_period` = the tier's commit amount (so a later
 *     upgrade grants only the delta);
 *   * a wallet balance to render against the allowance meter.
 *
 * The credit-grant *ledger* itself (the ×400-framed grant rows) is written
 * by the backend webhook and is covered by the Orchestra `test_billing`
 * suite; here we seed the account-level facts the console reads back.
 */
export function subscribeUserToTier(
  userId: string,
  opts: SubscribeTierOptions
): { templateId: number; assignmentId: number; commitAmount: number } {
  const isAnnual = opts.tierName.endsWith('_annual');
  const periodEndDays = opts.periodEndDays ?? (isAnnual ? 365 : 30);
  const credits = opts.credits ?? 0;
  const subId = opts.subscriptionId ?? `sub_e2e_${require('crypto').randomUUID().slice(0, 8)}`;
  const autoInc = opts.autoIncrement ?? false;

  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
  _template_id bigint;
  _commit numeric;
  _assignment_id bigint;
BEGIN
  SELECT billing_account_id INTO _ba_id FROM "user" WHERE id = '${userId}';

  SELECT id, commit_amount INTO _template_id, _commit
  FROM billing_plan_template
  WHERE name = '${opts.tierName}'
  LIMIT 1;

  IF _template_id IS NULL THEN
    RAISE EXCEPTION 'Tier template % not found (run migrations?)', '${opts.tierName}';
  END IF;

  UPDATE billing_plan_assignment
     SET ended_at = NOW()
   WHERE billing_account_id = _ba_id
     AND ended_at IS NULL;

  INSERT INTO billing_plan_assignment (billing_account_id, template_id, started_at, change_reason)
  VALUES (_ba_id, _template_id, NOW(), 'e2e subscribeUserToTier')
  RETURNING id INTO _assignment_id;

  UPDATE billing_account
     SET plan_assignment_id = _assignment_id,
         stripe_subscription_id = '${subId}',
         stripe_customer_id = COALESCE(stripe_customer_id, 'cus_e2e_' || _ba_id::text),
         current_period_end = NOW() + (INTERVAL '1 day' * ${periodEndDays}),
         plan_credits_granted_period = _commit,
         auto_increment = ${autoInc},
         credits = ${credits}
   WHERE id = _ba_id;
END
\\$\\$;
`);

  const templateId = getTierTemplateId(opts.tierName);
  const assignmentId = parseInt(
    dbExec(
      `SELECT id FROM billing_plan_assignment ` +
        `WHERE billing_account_id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}') ` +
        `AND ended_at IS NULL ORDER BY id DESC LIMIT 1`
    ),
    10
  );
  const commitAmount = parseFloat(
    dbExec(`SELECT commit_amount FROM billing_plan_template WHERE id = ${templateId}`)
  );
  return { templateId, assignmentId, commitAmount };
}

/**
 * Seed an expiring **trial** credit grant on a (still-unsubscribed)
 * account — the signup grant the console surfaces as a countdown.
 *
 * Writes the same expiring-grant ledger shape `compute_grant_lots` reads
 * (`amount > 0`, `detail.grant_kind = 'trial'`, `detail.expires_at`) and
 * sets the wallet balance to match. Pass a negative `daysUntilExpiry` to
 * model the *pre-sweep* expired state (remainder still on the wallet, so
 * `/v0/billing/account-info` still reports `trialExpiresAt` in the past →
 * the console shows the "expired" copy). The forfeiting sweep + the
 * pre-expiry reminder email are backend routines covered by the Orchestra
 * `test_billing` suite.
 */
export function grantTrialCredits(
  userId: string,
  opts: { usd: number; daysUntilExpiry: number }
): void {
  const expiresAt = new Date(Date.now() + opts.daysUntilExpiry * 86_400_000)
    .toISOString()
    .replace('Z', '+00:00');
  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
BEGIN
  SELECT billing_account_id INTO _ba_id FROM "user" WHERE id = '${userId}';
  INSERT INTO credit_transaction (billing_account_id, amount, category, at, description, detail)
  VALUES (
    _ba_id, ${opts.usd}, 'grant', NOW() - INTERVAL '7 days', 'e2e trial grant',
    jsonb_build_object('grant_kind', 'trial', 'expires_at', '${expiresAt}')
  );
  UPDATE billing_account SET credits = ${opts.usd} WHERE id = _ba_id;
END
\\$\\$;
`);
}

/**
 * Toggle the subscribe-time tax gate for a user's billing account.
 *
 * Billing address PII now lives on the Stripe customer, not locally — the
 * subscribe gate (backend) and the Subscribe CTA gate (FE `hasBillingAddress`)
 * both key off the derived `billing_setup_complete` flag, which the
 * `PATCH /billing/billing-profile` endpoint sets once a *complete* address
 * (line1 + city + postal_code + country) has been synced to Stripe.
 *
 * This helper mirrors that: a full address sets the flag (CTA enabled), an
 * incomplete one clears it (gated state) — without needing a live Stripe
 * customer in the e2e environment.
 */
export function setBillingAddress(
  userId: string,
  addr: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }
): void {
  const complete = Boolean(addr.line1 && addr.city && addr.postalCode && addr.country);
  dbExec(
    `UPDATE billing_account SET billing_setup_complete = ${complete} ` +
      `WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}')`
  );
}

export function createCreditGrantLink(opts: {
  credits: number;
  maxClaims?: number | null;
  token?: string;
}): string {
  const { randomUUID } = require('crypto');
  const token = opts.token ?? `test-grant-${randomUUID().slice(0, 8)}`;
  const linkId = randomUUID();
  const maxClaimsVal = opts.maxClaims === null ? 'NULL' : (opts.maxClaims ?? 1);

  dbExecBlock(`
DO \\$\\$
BEGIN
  INSERT INTO one_time_credit_grant_link (id, token, credit_amount, max_claims, expires_at, created_at)
  VALUES ('${linkId}', '${token}', ${opts.credits}, ${maxClaimsVal}, NOW() + INTERVAL '1 day', NOW())
  ON CONFLICT DO NOTHING;
END
\\$\\$;
`);
  return token;
}

export function deleteCreditGrantLink(token: string) {
  try {
    dbExec(`DELETE FROM one_time_credit_grant_link WHERE token = '${token}'`);
  } catch {
    /* best effort */
  }
}

export function hasUserClaimedGrant(userId: string): boolean {
  const count = dbExec(`SELECT count(*) FROM credit_grant_link_claim WHERE user_id = '${userId}'`);
  return parseInt(count, 10) > 0;
}

export function clearUserGrantClaims(userId: string) {
  try {
    dbExec(`DELETE FROM credit_grant_link_claim WHERE user_id = '${userId}'`);
  } catch {
    /* best effort */
  }
}

// =============================================================================
// Referral helpers
// =============================================================================

/** Primary referral code for a user (the one `GET /v0/user/referral` mints). */
export function getReferralCodeFromDb(userId: string): string | null {
  const code = dbExec(
    `SELECT code FROM referral_code WHERE referrer_user_id = '${userId}' ` +
      `AND referrer_organization_id IS NULL ORDER BY created_at ASC LIMIT 1`
  );
  return code?.trim() ? code.trim() : null;
}

/** Status of the (unique) attribution for a referred user, or null. */
export function getReferralAttributionStatus(refereeUserId: string): string | null {
  const s = dbExec(
    `SELECT status FROM referral_attribution WHERE referee_user_id = '${refereeUserId}' LIMIT 1`
  );
  return s?.trim() ? s.trim() : null;
}

/** Insert a referral code owned by `userId` (used to seed a second referrer). */
export function insertReferralCode(userId: string, code: string): void {
  const { randomUUID } = require('crypto');
  dbExecBlock(`
DO \\$\\$
BEGIN
  INSERT INTO referral_code (id, code, referrer_user_id, created_at)
  VALUES ('${randomUUID()}', '${code}', '${userId}', NOW())
  ON CONFLICT DO NOTHING;
END
\\$\\$;
`);
}

/**
 * Seed an already-rewarded referral attribution (the post-first-payment
 * state the backend webhook writes). Lets the dashboard be asserted without
 * driving a real Stripe payment — the reward logic itself is covered by the
 * Orchestra `test_billing` suite.
 */
export function seedRewardedReferral(
  referrerUserId: string,
  refereeUserId: string,
  opts: { code: string; rewardUsd: number }
): void {
  const { randomUUID } = require('crypto');
  dbExecBlock(`
DO \\$\\$
BEGIN
  INSERT INTO referral_attribution
    (id, code, referrer_user_id, referee_user_id, status, created_at, rewarded_at, reward_amount, referee_bonus_amount)
  VALUES
    ('${randomUUID()}', '${opts.code}', '${referrerUserId}', '${refereeUserId}',
     'rewarded', NOW(), NOW(), ${opts.rewardUsd}, 50)
  ON CONFLICT (referee_user_id) DO NOTHING;
END
\\$\\$;
`);
}

export function clearReferralData(userId: string): void {
  try {
    dbExec(
      `DELETE FROM referral_attribution WHERE referrer_user_id = '${userId}' OR referee_user_id = '${userId}'`
    );
    dbExec(`DELETE FROM referral_code WHERE referrer_user_id = '${userId}'`);
  } catch {
    /* best effort */
  }
}

export function insertRechargeRecord(userId: string, amount = 25) {
  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
BEGIN
  SELECT billing_account_id INTO _ba_id FROM "user" WHERE id = '${userId}';
  INSERT INTO recharge (billing_account_id, quantity, amount_usd, at, status, type)
  VALUES (_ba_id, ${amount}, ${amount}, NOW(), 'paid', 'manual');
END
\\$\\$;
`);
}

// =============================================================================
// Managed-billing — METERED plan helpers
// =============================================================================

/**
 * Options for {@link setMeteredPlan}.
 *
 * - ``templateName`` is unique on ``billing_plan_template`` (per-test
 *   names avoid cross-test collisions).
 * - ``commitAmount`` / ``commitPeriod`` define a COMMITMENT plan; omit
 *   both for a pure PAY_AS_YOU_GO + METERED plan.
 *
 * ``plan_type`` is *not* an option — it's derived server-side from
 * ``commit_amount`` (positive = COMMITMENT, NULL = PAYG). There's
 * also no ``monthly_usage_cap`` field anymore: the platform never
 * blocks usage based on plan terms, so cap-shaped tests only make
 * sense at the spending-limit / guard layer.
 */
export interface MeteredPlanOptions {
  templateName?: string;
  commitAmount?: number; // USD; if set, creates a COMMITMENT plan
  commitPeriod?: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
}

/**
 * Move a user's billing account onto a METERED plan, creating a
 * dedicated ``billing_plan_template`` and an active
 * ``billing_plan_assignment`` row, and pointing
 * ``billing_account.plan_assignment_id`` at the new assignment.
 *
 * The function is idempotent within a single test run: re-running with
 * the same ``templateName`` reuses the template (``ON CONFLICT (name)
 * DO NOTHING``) but always creates a fresh assignment, ending any
 * currently active one first.
 *
 * Returns ``{ templateId, assignmentId }`` so tests can assert on
 * downstream rows (recharges, ledger transactions) keyed off the
 * assignment.
 */
export function setMeteredPlan(
  userId: string,
  opts: MeteredPlanOptions = {}
): { templateId: number; assignmentId: number } {
  const templateName =
    opts.templateName ?? `E2E Metered ${require('crypto').randomUUID().slice(0, 8)}`;
  const isCommitment = opts.commitAmount != null;
  const commitAmountSql = isCommitment ? String(opts.commitAmount) : 'NULL';
  const commitPeriodSql = isCommitment ? `'${opts.commitPeriod ?? 'MONTHLY'}'` : 'NULL';

  // Single block: create template (or reuse), end any active assignment,
  // insert a fresh active assignment, sync billing_account.plan_assignment_id.
  // Also clear the wallet to 0 — METERED accounts have no prepaid credits.
  //
  // Schema notes:
  //   * `plan_type` / `monthly_usage_cap` / `overage_policy` /
  //     `overdraft_policy` / `fx_provider` were dropped from the
  //     `billing_plan_template` table — don't reference them here.
  //   * Catalog placement is two booleans: `is_custom=true` (bespoke)
  //     keeps these throw-away test rows out of any future catalog
  //     listings; `is_active=true` makes them assignable.
  //   * `currency` defaults to USD (column was renamed from
  //     `commit_currency`); these e2e plans only ever bill in USD.
  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
  _template_id bigint;
  _assignment_id bigint;
BEGIN
  SELECT billing_account_id INTO _ba_id FROM "user" WHERE id = '${userId}';

  INSERT INTO billing_plan_template (
    name, billing_mode, commit_amount, commit_period,
    collection_method,
    is_custom, is_active, currency
  )
  VALUES (
    '${templateName}', 'METERED', ${commitAmountSql}, ${commitPeriodSql},
    'SEND_INVOICE_NET_30',
    true, true, 'USD'
  )
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO _template_id;

  UPDATE billing_plan_assignment
     SET ended_at = NOW()
   WHERE billing_account_id = _ba_id
     AND ended_at IS NULL;

  INSERT INTO billing_plan_assignment (billing_account_id, template_id, started_at)
  VALUES (_ba_id, _template_id, NOW())
  RETURNING id INTO _assignment_id;

  UPDATE billing_account
     SET plan_assignment_id = _assignment_id, credits = 0
   WHERE id = _ba_id;

  RAISE NOTICE 'METERED %/%', _template_id, _assignment_id;
END
\\$\\$;
`);

  const templateId = parseInt(
    dbExec(`SELECT id FROM billing_plan_template WHERE name = '${templateName}'`),
    10
  );
  const assignmentId = parseInt(
    dbExec(
      `SELECT id FROM billing_plan_assignment ` +
        `WHERE billing_account_id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}') ` +
        `AND ended_at IS NULL`
    ),
    10
  );
  return { templateId, assignmentId };
}

/**
 * Revert a user back to the default (CREDITS) plan: end any
 * active custom assignment and insert a fresh default plan assignment
 * row (template id = 1). The previous custom template is left in place
 * — it's ``BESPOKE`` and harmless, and dropping it could break audit
 * links from ledger rows or recharges.
 *
 * Mirrors what ``BillingPlanAssignmentDAO.set_plan(template_id=1)``
 * would do via the admin endpoint: every account always has a real
 * active assignment, so cancellation = close-and-insert (not "clear
 * the pointer").
 */
export function clearMeteredPlan(userId: string): void {
  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
  _new_assignment_id bigint;
BEGIN
  SELECT billing_account_id INTO _ba_id FROM "user" WHERE id = '${userId}';

  UPDATE billing_plan_assignment
     SET ended_at = NOW()
   WHERE billing_account_id = _ba_id
     AND ended_at IS NULL;

  INSERT INTO billing_plan_assignment (
    billing_account_id, template_id, started_at, change_reason
  )
  VALUES (
    _ba_id, 1, NOW(),
    'Cancelled custom plan in e2e test (clearMeteredPlan)'
  )
  RETURNING id INTO _new_assignment_id;

  UPDATE billing_account
     SET plan_assignment_id = _new_assignment_id
   WHERE id = _ba_id;
END
\\$\\$;
`);
}

/**
 * Insert a fully-formed METERED invoice row directly on the user's
 * billing account. Mirrors what ``monthly_metered_invoicer`` would
 * write at month end, sufficient for the Billing page's invoices
 * table to render a row.
 */
export function insertMeteredInvoice(
  userId: string,
  opts: {
    amountUsd: number;
    invoiceMonth: string; // 'YYYY-MM-01'
    planAssignmentId: number;
    status?: 'PAID' | 'INVOICE_CREATED' | 'FAILED';
    stripeInvoiceId?: string;
  }
): void {
  const status = opts.status ?? 'INVOICE_CREATED';
  const stripeId = opts.stripeInvoiceId ? `'${opts.stripeInvoiceId}'` : 'NULL';
  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
BEGIN
  SELECT billing_account_id INTO _ba_id FROM "user" WHERE id = '${userId}';
  INSERT INTO recharge (
    billing_account_id, quantity, amount_usd, at, status, type,
    invoice_group, stripe_invoice_id, plan_id
  )
  VALUES (
    _ba_id, ${opts.amountUsd}, ${opts.amountUsd}, NOW(), '${status}',
    'metered_invoice', '${opts.invoiceMonth}', ${stripeId}, ${opts.planAssignmentId}
  );
END
\\$\\$;
`);
}
