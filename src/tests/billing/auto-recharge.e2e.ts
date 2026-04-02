/**
 * Auto-Recharge E2E — toggle, save settings, validation.
 *
 * Run: npx playwright test src/tests/billing/auto-recharge.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  setAutoRecharge,
  createBillingTest,
  dbExec,
  type TestUser,
} from './helpers';

// ---------------------------------------------------------------------------
// Auto-Recharge Settings (pre-enabled via DB seed)
// ---------------------------------------------------------------------------

const settingsUser = createTestUser({ name: 'ARSettings', lastName: 'Test', credits: 5_000 });
setAutoRecharge(settingsUser.id, { enabled: true, threshold: 10, qty: 25 });
const test = createBillingTest(settingsUser);

test.afterAll(() => {
  setAutoRecharge(settingsUser.id, { enabled: false });
  cleanupUser(settingsUser.id);
});

test('shows min balance and recharge amount fields when enabled', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await page.waitForSelector('text=Auto-Recharge', { timeout: 15_000 });

  await expect(page.locator('#minBalance')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#rechargeAmount')).toBeVisible({ timeout: 5_000 });
});

test('save button is disabled when no changes are made', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await page.waitForSelector('text=Auto-Recharge', { timeout: 15_000 });
  await page.waitForSelector('#minBalance', { timeout: 10_000 });

  const saveBtn = page.locator('button', { hasText: 'Save Changes' });
  await expect(saveBtn).toBeDisabled({ timeout: 5_000 });
});

test('save button enables when values change', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await page.waitForSelector('text=Auto-Recharge', { timeout: 15_000 });
  await page.waitForSelector('#minBalance', { timeout: 10_000 });

  await page.locator('#minBalance').fill('50');

  const saveBtn = page.locator('button', { hasText: 'Save Changes' });
  await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
});

test('saves new auto-recharge settings and persists to DB', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await page.waitForSelector('text=Auto-Recharge', { timeout: 15_000 });
  await page.waitForSelector('#minBalance', { timeout: 10_000 });

  await page.locator('#minBalance').fill('20');
  await page.locator('#rechargeAmount').fill('50');

  await page.locator('button', { hasText: 'Save Changes' }).click();
  await expect(page.locator('text=/updated|success/i')).toBeVisible({ timeout: 10_000 });

  const threshold = dbExec(
    `SELECT autorecharge_threshold FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${settingsUser.id}')`
  );
  expect(parseFloat(threshold)).toBe(20);

  const qty = dbExec(
    `SELECT autorecharge_qty FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${settingsUser.id}')`
  );
  expect(parseFloat(qty)).toBe(50);
});
