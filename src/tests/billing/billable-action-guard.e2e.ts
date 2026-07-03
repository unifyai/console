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
  expectOnboardButtonDisabled,
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

noCreditTest(
  'blocks the onboard CTA when user has no credits @critical @area(billing.wallet)',
  async ({ authedPage: page }) => {
    await expectOnboardButtonDisabled(page, {
      userId: noCreditUser.id,
      apiKey: noCreditUser.apiKey,
    });
  }
);

// ---------------------------------------------------------------------------
// With Credits — buttons enabled
// ---------------------------------------------------------------------------

const withCreditUser = createTestUser({ name: 'Guard', lastName: 'WithCredits', credits: 5_000 });
const withCreditTest = createBillingTest(withCreditUser);

withCreditTest.afterAll(() => cleanupUser(withCreditUser.id));

withCreditTest(
  'buttons are enabled when user has credits @push @critical @area(billing.wallet)',
  async ({ authedPage: page }) => {
    await expectOnboardButtonEnabled(page, {
      userId: withCreditUser.id,
      apiKey: withCreditUser.apiKey,
    });
  }
);

// ---------------------------------------------------------------------------
// METERED — guard bypassed even at $0 wallet
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
  'METERED account with $0 wallet keeps billable actions enabled @critical @area(billing.wallet)',
  async ({ authedPage: page }) => {
    await waitForAssistantsReady(page, {
      userId: meteredUser.id,
      apiKey: meteredUser.apiKey,
    });

    await expectOnboardButtonEnabled(page, {
      userId: meteredUser.id,
      apiKey: meteredUser.apiKey,
    });

    // And the guard's tooltip wrapper (which only renders when blocked)
    // must NOT appear anywhere on the page.
    await expect(page.locator('[data-testid="billable-action-guard"]')).toHaveCount(0);
  }
);
