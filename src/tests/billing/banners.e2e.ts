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
  type TestUser,
} from './helpers';

// ---------------------------------------------------------------------------
// Out of Credits Banner
// ---------------------------------------------------------------------------

const oocUser = createTestUser({ name: 'Banner', lastName: 'OOC', credits: 100 });
insertRechargeRecord(oocUser.id, 25);
const oocTest = createBillingTest(oocUser);

oocTest.afterAll(() => {
  setUserCredits(oocUser.id, 100);
  cleanupUser(oocUser.id);
});

oocTest('shows out-of-credits banner when balance is negative', async ({ authedPage: page }) => {
  setUserCredits(oocUser.id, -5);
  await page.goto('/assistants');

  const banner = page.getByTestId('out-of-credits-banner');
  await expect(banner).toBeVisible({ timeout: 15_000 });

  const bannerText = await banner.textContent();
  expect(bannerText).toMatch(/depleted|credit/i);
  expect(bannerText).toMatch(/billing/i);
});

oocTest('does not show banner when balance is positive', async ({ authedPage: page }) => {
  setUserCredits(oocUser.id, 500);
  await page.goto('/assistants');
  await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

  const banner = page.getByTestId('out-of-credits-banner');
  await expect(banner).not.toBeVisible({ timeout: 5_000 });
});

oocTest('shows out-of-credits banner when balance is zero', async ({ authedPage: page }) => {
  setUserCredits(oocUser.id, 0);
  await page.goto('/assistants');

  const banner = page.getByTestId('out-of-credits-banner');
  await expect(banner).toBeVisible({ timeout: 15_000 });

  const bannerText = await banner.textContent();
  expect(bannerText).toMatch(/depleted|credit/i);
  expect(bannerText).toMatch(/billing/i);
});

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
  'does not show out-of-credits banner for zero-balance metered account',
  async ({ authedPage: page }) => {
    await page.goto('/assistants');
    await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

    const banner = page.getByTestId('out-of-credits-banner');
    await expect(banner).not.toBeVisible({ timeout: 5_000 });
  }
);

// ---------------------------------------------------------------------------
// Account Status Banner — Active
// ---------------------------------------------------------------------------

const activeUser = createTestUser({ name: 'Banner', lastName: 'Active', credits: 5_000 });
const activeTest = createBillingTest(activeUser);

activeTest.afterAll(() => cleanupUser(activeUser.id));

activeTest(
  'does not show account status banner for active account',
  async ({ authedPage: page }) => {
    await page.goto('/assistants');
    await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

    const banner = page.getByTestId('account-status-banner');
    await expect(banner).not.toBeVisible({ timeout: 5_000 });
  }
);

// ---------------------------------------------------------------------------
// Account Status Banner — Suspended
// ---------------------------------------------------------------------------

const suspendedUser = createTestUser({ name: 'Banner', lastName: 'Suspended', credits: 5_000 });
const suspendedTest = createBillingTest(suspendedUser);

suspendedTest.afterAll(() => {
  setAccountStatus(suspendedUser.id, 'ACTIVE');
  cleanupUser(suspendedUser.id);
});

suspendedTest('shows account status banner for suspended account', async ({ authedPage: page }) => {
  setAccountStatus(suspendedUser.id, 'SUSPENDED');
  await page.goto('/assistants');
  await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

  const banner = page.getByTestId('account-status-banner');
  await expect(banner).toBeVisible({ timeout: 15_000 });

  const bannerText = await banner.textContent();
  expect(bannerText).toMatch(/suspended/i);
});

// ---------------------------------------------------------------------------
// Account Status Banner — Closed
// ---------------------------------------------------------------------------

const closedUser = createTestUser({ name: 'Banner', lastName: 'Closed', credits: 5_000 });
const closedTest = createBillingTest(closedUser);

closedTest.afterAll(() => {
  setAccountStatus(closedUser.id, 'ACTIVE');
  cleanupUser(closedUser.id);
});

closedTest('shows account status banner for closed account', async ({ authedPage: page }) => {
  setAccountStatus(closedUser.id, 'CLOSED');
  await page.goto('/assistants');
  await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

  const banner = page.getByTestId('account-status-banner');
  await expect(banner).toBeVisible({ timeout: 15_000 });

  const bannerText = await banner.textContent();
  expect(bannerText).toMatch(/closed/i);
});
