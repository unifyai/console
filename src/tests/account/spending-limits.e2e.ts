/**
 * Spending Limits E2E — view, set, update, and remove personal spending limit.
 *
 * Tests the spending limit flow via the API (PUT /api/user/spending-limit)
 * which is exactly what the SpendingLimitDialog calls when the user saves.
 * Also verifies the usage page renders the spending limit card.
 *
 * Run: npx playwright test src/tests/account/spending-limits.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAccountTest,
  getUserSpendingCap,
  dbExec,
} from './helpers';

const user = createTestUser({ name: 'Spending', lastName: 'Limit', credits: 5_000 });
const test = createAccountTest(user);
test.setTimeout(90_000);

test.afterAll(() => cleanupUser(user.id));

test('usage page loads and shows spending limit card', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('spending-limit-card')).toBeVisible({ timeout: 15_000 });
});

test('setting a personal spending limit via API persists to DB', async ({ authedPage: page }) => {
  // Ensure no limit is set
  dbExec(`UPDATE "user" SET monthly_spending_cap = NULL WHERE id = '${user.id}'`);

  // Navigate to any authenticated page so session cookies exist
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  // Call the spending limit API — this is what the SpendingLimitDialog does on save
  const response = await page.evaluate(async () => {
    const res = await fetch('/api/user/spending-limit', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlySpendingCap: 100 }),
    });
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(response.data.monthlySpendingCap).toBe(100);

  const cap = getUserSpendingCap(user.id);
  expect(cap).toBe(100);
});

test('updating spending limit changes the value in DB', async ({ authedPage: page }) => {
  dbExec(`UPDATE "user" SET monthly_spending_cap = 100 WHERE id = '${user.id}'`);

  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/user/spending-limit', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlySpendingCap: 250 }),
    });
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(response.data.monthlySpendingCap).toBe(250);

  const cap = getUserSpendingCap(user.id);
  expect(cap).toBe(250);
});

test('removing spending limit (setting null) clears it from DB', async ({ authedPage: page }) => {
  dbExec(`UPDATE "user" SET monthly_spending_cap = 200 WHERE id = '${user.id}'`);

  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/user/spending-limit', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlySpendingCap: null }),
    });
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(response.data.monthlySpendingCap).toBeNull();

  const cap = getUserSpendingCap(user.id);
  expect(cap).toBeNull();
});

test('GET spending-limit reflects the current DB value', async ({ authedPage: page }) => {
  dbExec(`UPDATE "user" SET monthly_spending_cap = 175 WHERE id = '${user.id}'`);

  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/user/spending-limit');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(response.data.monthlySpendingCap).toBe(175);
});
