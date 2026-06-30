/**
 * Manual Top-Up E2E — staging billing mode (free, no-charge credit top-up).
 *
 * Verifies that in manual-top-up mode the billing page exposes a self-serve
 * "Top up" control that grants credits with no Stripe/card, that the granted
 * credits land in the database, and that the out-of-credits banner gates work
 * and recover after a top-up.
 *
 * Requires the stack to run in manual-top-up mode so Console resolves
 * `features.manualTopup` (and `features.billing`) to true:
 *
 *   MANUAL_TOPUP=1 ./scripts/local.sh start
 *
 * When the mode is off the billing page renders "billing unavailable", so the
 * tests skip themselves with a clear message rather than failing spuriously.
 *
 * Run: npx playwright test src/tests/billing/manual-topup.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  setUserCredits,
  createBillingTest,
  getBillingAccountId,
  dbExec,
  waitForAssistantsReady,
} from './helpers';

function readCredits(userId: string): number {
  const baId = getBillingAccountId(userId);
  return parseFloat(dbExec(`SELECT credits FROM billing_account WHERE id = ${baId}`));
}

// ---------------------------------------------------------------------------
// Top up from a positive balance
// ---------------------------------------------------------------------------

const topupUser = createTestUser({ name: 'Manual', lastName: 'Topup', credits: 5 });
const topupTest = createBillingTest(topupUser);

topupTest.afterAll(() => {
  setUserCredits(topupUser.id, 5);
  cleanupUser(topupUser.id);
});

topupTest('tops up credits with no charge and persists to the DB', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const section = page.getByTestId('topup-section');
  if (!(await section.isVisible({ timeout: 10_000 }).catch(() => false))) {
    topupTest.skip(true, 'Manual-top-up mode not enabled (set MANUAL_TOPUP=1 on Orchestra).');
    return;
  }

  const before = readCredits(topupUser.id);

  await page.getByTestId('topup-amount-input').fill('25');
  await page.getByTestId('topup-submit').click();

  // UI feedback: success toast carries the granted amount.
  await expect(page.getByText(/topped up 25 credits/i)).toBeVisible({ timeout: 15_000 });

  // DB is the source of truth for the mutation (UI can be optimistic).
  await expect.poll(() => readCredits(topupUser.id), { timeout: 15_000 }).toBe(before + 25);
});

// ---------------------------------------------------------------------------
// Out-of-credits banner gates, then recovers after a top-up
// ---------------------------------------------------------------------------

const gateUser = createTestUser({ name: 'Manual', lastName: 'Gate', credits: 0 });
const gateTest = createBillingTest(gateUser);

gateTest.afterAll(() => {
  setUserCredits(gateUser.id, 0);
  cleanupUser(gateUser.id);
});

gateTest(
  'shows out-of-credits banner at zero, clears after top-up',
  async ({ authedPage: page }) => {
    // Confirm manual-top-up mode is active via the billing page first.
    await page.goto('/billing');
    const section = page.getByTestId('topup-section');
    if (!(await section.isVisible({ timeout: 10_000 }).catch(() => false))) {
      gateTest.skip(true, 'Manual-top-up mode not enabled (set MANUAL_TOPUP=1 on Orchestra).');
      return;
    }

    // Depleted balance → assistants page shows the out-of-credits banner with
    // manual-top-up copy.
    setUserCredits(gateUser.id, 0);
    await page.goto('/assistants');
    const banner = page.getByTestId('out-of-credits-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    expect(await banner.textContent()).toMatch(/top up/i);

    // Top up from the billing page restores the balance.
    await page.goto('/billing');
    await page.getByTestId('topup-amount-input').fill('50');
    await page.getByTestId('topup-submit').click();
    await expect(page.getByText(/topped up 50 credits/i)).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => readCredits(gateUser.id), { timeout: 15_000 }).toBe(50);

    // Banner is gone now that there are credits again.
    await page.goto('/assistants');
    await waitForAssistantsReady(page);
    await expect(page.getByTestId('out-of-credits-banner')).not.toBeVisible({ timeout: 5_000 });
  }
);
