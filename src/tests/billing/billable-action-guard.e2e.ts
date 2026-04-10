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
  await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

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
  await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

  const newBtn = page.locator('button', { hasText: 'New' });
  await expect(newBtn).toBeEnabled({ timeout: 10_000 });
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
    await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

    setUserCredits(restoreUser.id, 5_000);
    await page.reload();
    await page.waitForSelector('text=/assistant/i', { timeout: 15_000 });

    const newBtn = page.locator('button', { hasText: 'New' });
    await expect(newBtn).toBeEnabled({ timeout: 10_000 });
  }
);
