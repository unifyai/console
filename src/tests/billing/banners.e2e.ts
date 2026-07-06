/**
 * Assistants Page Banners E2E — out-of-credits and account-status banners.
 *
 * Run: npx playwright test src/tests/billing/banners.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  setUserCredits,
  setAccountStatus,
  insertRechargeRecord,
  createBillingTest,
  setMeteredPlan,
  clearMeteredPlan,
  waitForAssistantsReady,
} from './helpers';

const oocUser = createTestUser({ name: 'Banner', lastName: 'OOC', credits: 100 });
insertRechargeRecord(oocUser.id, 25);
const oocTest = createBillingTest(oocUser);

oocTest.afterAll(() => {
  setUserCredits(oocUser.id, 100);
  cleanupUser(oocUser.id);
});

oocTest(
  'out-of-credits banner appears at zero or negative balance and hides when funded @critical @area(billing.wallet)',
  async ({ authedPage: page }) => {
    for (const balance of [-5, 0]) {
      setUserCredits(oocUser.id, balance);
      await page.goto('/assistants');
      const banner = page.getByTestId('out-of-credits-banner');
      await expect(banner).toBeVisible({ timeout: 15_000 });
      const bannerText = await banner.textContent();
      expect(bannerText).toMatch(/depleted|credit/i);
      expect(bannerText).toMatch(/billing/i);
    }

    setUserCredits(oocUser.id, 500);
    await page.goto('/assistants');
    await waitForAssistantsReady(page);
    await expect(page.getByTestId('out-of-credits-banner')).not.toBeVisible({ timeout: 5_000 });
  }
);

const meteredZeroUser = createTestUser({
  name: 'Banner',
  lastName: 'Metered',
  credits: 0,
});
setMeteredPlan(meteredZeroUser.id, {
  templateName: `E2E Metered Banner ${meteredZeroUser.id.slice(0, 8)}`,
  commitAmount: 1000,
  commitPeriod: 'MONTHLY',
});
const meteredZeroTest = createBillingTest(meteredZeroUser);

meteredZeroTest.afterAll(() => {
  clearMeteredPlan(meteredZeroUser.id);
  cleanupUser(meteredZeroUser.id);
});

meteredZeroTest(
  'does not show out-of-credits banner for zero-balance metered account @critical @area(billing.wallet)',
  async ({ authedPage: page }) => {
    await page.goto('/assistants');
    await waitForAssistantsReady(page);
    await expect(page.getByTestId('out-of-credits-banner')).not.toBeVisible({ timeout: 5_000 });
  }
);

const suspendedUser = createTestUser({ name: 'Banner', lastName: 'Suspended', credits: 5_000 });
const suspendedTest = createBillingTest(suspendedUser);

suspendedTest.afterAll(() => {
  setAccountStatus(suspendedUser.id, 'ACTIVE');
  cleanupUser(suspendedUser.id);
});

suspendedTest('shows account status banner for suspended account', async ({ authedPage: page }) => {
  setAccountStatus(suspendedUser.id, 'SUSPENDED');
  await page.goto('/assistants');
  await waitForAssistantsReady(page);

  const banner = page.getByTestId('account-status-banner');
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText(/suspended/i);
});
