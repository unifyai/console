/**
 * Auto-Increment E2E — subscribed-account toggle UI syncs with the API.
 *
 * Run: npx playwright test src/tests/billing/auto-increment.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  subscribeUserToTier,
  setAutoIncrement,
} from './helpers';

const user = createTestUser({ name: 'AutoInc', lastName: 'Test', credits: 1_000 });
const test = createBillingTest(user, { skipWhenManualTopup: true });

test.afterAll(() => cleanupUser(user.id));

test('subscribed account toggle stays in sync with the API @critical @area(billing.auto-increment)', async ({
  authedPage: page,
}) => {
  subscribeUserToTier(user.id, { tierName: 'tier_50', credits: 10, autoIncrement: false });
  setAutoIncrement(user.id, false);

  await page.goto('/billing');
  await expect(page.getByTestId('plans-section')).toBeVisible({ timeout: 15_000 });

  const toggle = page.getByTestId('auto-increment-toggle');
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await expect(toggle).toHaveAttribute('data-state', 'unchecked');

  await toggle.click();
  await expect(toggle).toHaveAttribute('data-state', 'checked', { timeout: 10_000 });

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/auto-increment');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(response.data.enabled).toBe(true);
});
