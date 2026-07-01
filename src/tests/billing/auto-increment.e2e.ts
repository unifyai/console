/**
 * Auto-Increment E2E — API contract and subscribed-account toggle UI.
 *
 * Run: npx playwright test src/tests/billing/auto-increment.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
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

test('GET returns the auto-increment contract shape for a subscribed account', async ({
  authedPage: page,
}) => {
  subscribeUserToTier(user.id, { tierName: 'tier_50', credits: 10, autoIncrement: false });
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/auto-increment');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(typeof response.data.enabled).toBe('boolean');
  expect(response.data.isSubscribed).toBe(true);
  expect(typeof response.data.atTopTier).toBe('boolean');
});

test('PUT rejects a non-boolean enabled flag', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/auto-increment', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: 'yes' }),
    });
    return { status: res.status };
  });

  expect(response.status).toBe(400);
});

test('subscribed account toggle stays in sync with the API', async ({ authedPage: page }) => {
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

unauthTest('auto-increment API requires authentication', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/auto-increment');
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});
