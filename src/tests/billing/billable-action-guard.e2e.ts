/**
 * BillableActionGuard E2E — gates billable actions when credits are
 * insufficient, shows tooltip, unblocks when credits restored.
 *
 * Run: npx playwright test src/tests/billing/billable-action-guard.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  setUserCredits,
  insertRechargeRecord,
  createBillingTest,
  setMeteredPlan,
  clearMeteredPlan,
  waitForAssistantsReady,
  expectOnboardButtonEnabled,
  type TestUser,
} from './helpers';

// ---------------------------------------------------------------------------
// No Credits — buttons disabled
// ---------------------------------------------------------------------------

const noCreditUser = createTestUser({ name: 'Guard', lastName: 'NoCredits', credits: 0 });
insertRechargeRecord(noCreditUser.id, 25);
setUserCredits(noCreditUser.id, -1);
const noCreditTest = createBillingTest(noCreditUser);

noCreditTest.afterAll(() => {
  setUserCredits(noCreditUser.id, 100);
  cleanupUser(noCreditUser.id);
});

noCreditTest('disabled buttons appear when user has no credits', async ({ authedPage: page }) => {
  await page.goto('/assistants');
  await waitForAssistantsReady(page);

  const disabledBtns = page.locator('button[disabled]');
  const count = await disabledBtns.count();
  expect(count).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// With Credits — buttons enabled
// ---------------------------------------------------------------------------

const withCreditUser = createTestUser({ name: 'Guard', lastName: 'WithCredits', credits: 5_000 });
const withCreditTest = createBillingTest(withCreditUser);

withCreditTest.afterAll(() => cleanupUser(withCreditUser.id));

withCreditTest('buttons are enabled when user has credits', async ({ authedPage: page }) => {
  await page.goto('/assistants');
  await expectOnboardButtonEnabled(page);
});

// ---------------------------------------------------------------------------
// Credits Restored — buttons re-enable on reload
// ---------------------------------------------------------------------------

const restoreUser = createTestUser({ name: 'Guard', lastName: 'Restore', credits: 5_000 });
insertRechargeRecord(restoreUser.id, 25);
const restoreTest = createBillingTest(restoreUser);

restoreTest.afterAll(() => {
  setUserCredits(restoreUser.id, 5_000);
  cleanupUser(restoreUser.id);
});

restoreTest(
  'buttons become enabled after credits are restored and page reloads',
  async ({ authedPage: page }) => {
    setUserCredits(restoreUser.id, -1);
    await page.goto('/assistants');
    await waitForAssistantsReady(page);

    setUserCredits(restoreUser.id, 5_000);
    await page.reload();
    await expectOnboardButtonEnabled(page);
  }
);

// ---------------------------------------------------------------------------
// METERED — guard bypassed even at $0 wallet
//
// METERED accounts are invoiced monthly (managed-billing). They
// intentionally hold a $0 credits balance — `deduct_credits` writes to
// the ledger without mutating the wallet — so the legacy "no credits"
// gate would block every billable action. The guard must read the
// ``billing_mode`` flag from the balance endpoint and skip the check.
// ---------------------------------------------------------------------------

const meteredUser = createTestUser({
  name: 'Guard',
  lastName: 'Metered',
  credits: 0,
});
setMeteredPlan(meteredUser.id, {
  templateName: `E2E Guard Metered ${meteredUser.id.slice(0, 8)}`,
  commitAmount: 1000,
  commitPeriod: 'MONTHLY',
});
const meteredTest = createBillingTest(meteredUser);

meteredTest.afterAll(() => {
  clearMeteredPlan(meteredUser.id);
  cleanupUser(meteredUser.id);
});

meteredTest(
  'METERED account with $0 wallet keeps billable actions enabled',
  async ({ authedPage: page }) => {
    await page.goto('/assistants');
    await waitForAssistantsReady(page);

    await expectOnboardButtonEnabled(page);

    // And the guard's tooltip wrapper (which only renders when blocked)
    // must NOT appear anywhere on the page.
    await expect(page.locator('[data-testid="billable-action-guard"]')).toHaveCount(0);
  }
);
