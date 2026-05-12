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

import { test as base, type Page, type Browser } from '@playwright/test';
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

import { login, loginAndWaitForRedirect, switchToEmailTab } from '../auth/helpers';
export { login, switchToEmailTab };

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
  password: string
): Promise<string> {
  const stateFile = path.join(os.tmpdir(), `pw-billing-${email.replace(/[^a-z0-9]/gi, '-')}.json`);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/login');
  await loginAndWaitForRedirect(page, email, password, 30_000);

  if (page.url().includes('/login/onboarding')) {
    const personalBtn = page.getByTestId('workspace-personal');
    if (await personalBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await personalBtn.click();
      await page.getByTestId('workspace-continue').click();
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15_000,
      });
    }
  }

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

  if (page.url().includes('/login/onboarding')) {
    const personalBtn = page.getByTestId('workspace-personal');
    if (await personalBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await personalBtn.click();
      await page.getByTestId('workspace-continue').click();
      await page.waitForURL((url) => !url.pathname.includes('onboarding'), {
        timeout: 15_000,
      });
    }
  }

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
export function createBillingTest(user: { email: string; password: string }) {
  let authFile: string | undefined;

  return base.extend<{ authedPage: Page }>({
    authedPage: async ({ browser }, use, testInfo) => {
      if (!authFile) {
        testInfo.setTimeout(testInfo.timeout + 30_000);
        authFile = await loginAndSaveState(browser, user.email, user.password);
      }
      const ctx = await browser.newContext({ storageState: authFile });
      const page = await ctx.newPage();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(page);
      await ctx.close();
    },
  });
}

// =============================================================================
// DB Seed Helpers
// =============================================================================

export function setAutoRecharge(
  userId: string,
  opts: { enabled: boolean; threshold?: number; qty?: number }
) {
  dbExec(
    `UPDATE billing_account SET
       autorecharge = ${opts.enabled},
       autorecharge_threshold = ${opts.threshold ?? 10},
       autorecharge_qty = ${opts.qty ?? 25}
     WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}')`
  );
}

export function setAccountStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED') {
  dbExec(
    `UPDATE billing_account SET account_status = '${status}'
     WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}')`
  );
}

export function getBillingAccountId(userId: string): number {
  return parseInt(dbExec(`SELECT billing_account_id FROM "user" WHERE id = '${userId}'`), 10);
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
  /** Multiplier on raw USD usage WITHIN commit (and on all PAYG usage). */
  basePricingFactor?: number;
  /** Multiplier on raw USD usage ABOVE commit; defaults to basePricingFactor. */
  overagePricingFactor?: number;
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
  const baseFactor = opts.basePricingFactor ?? 1.0;
  const overageFactor = opts.overagePricingFactor ?? baseFactor;

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
    collection_method, base_pricing_factor, overage_pricing_factor,
    is_custom, is_active, currency
  )
  VALUES (
    '${templateName}', 'METERED', ${commitAmountSql}, ${commitPeriodSql},
    'SEND_INVOICE_NET_30', ${baseFactor}, ${overageFactor},
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

export async function pushBillingEvent(
  billingAccountId: number,
  eventType: 'credits_exhausted' | 'credits_restored',
  balance: number
) {
  const res = await fetch('http://localhost:3000/api/billing/events/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      billing_account_id: billingAccountId,
      event_type: eventType,
      balance,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to push billing event: ${res.status}`);
  }
}
