/**
 * Billing Access Control E2E — auth redirects, page accessibility.
 *
 * Run: npx playwright test src/tests/billing/access-control.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import { createTestUser, cleanupUser, createBillingTest, type TestUser } from './helpers';

// ---------------------------------------------------------------------------
// Unauthenticated redirects
// ---------------------------------------------------------------------------

unauthTest('billing page redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/billing');
  await page.waitForURL('**/login**', { timeout: 15_000 });
  expect(page.url()).toContain('/login');
});

unauthTest('usage page redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/usage');
  await page.waitForURL('**/login**', { timeout: 15_000 });
  expect(page.url()).toContain('/login');
});

// ---------------------------------------------------------------------------
// Authenticated access
// ---------------------------------------------------------------------------

const user = createTestUser({ name: 'Access', lastName: 'Bill', credits: 5_000 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

test('billing page shows all main sections', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await expect(page.locator('text=Balance')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=Auto-Recharge')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('text=Billing Profile')).toBeVisible({ timeout: 10_000 });
});

test('usage page loads for authenticated users', async ({ authedPage: page }) => {
  await page.goto('/usage');

  const usageMain = page.getByTestId('usage-page-main');
  await expect(usageMain).toBeVisible({ timeout: 15_000 });
});
