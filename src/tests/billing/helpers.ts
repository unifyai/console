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
