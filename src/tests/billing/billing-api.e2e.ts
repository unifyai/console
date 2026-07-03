/**
 * Billing API E2E — balance UI↔API parity (PR tier keeper).
 *
 * Run: npx playwright test src/tests/billing/billing-api.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTestUser, cleanupUser, setUserCredits, createBillingTest } from './helpers';

const user = createTestUser({ name: 'API', lastName: 'Billing', credits: 4_200 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

test('balance UI matches the balance API for authenticated user @critical @area(billing.api-parity)', async ({
  authedPage: page,
}) => {
  setUserCredits(user.id, 1_234);
  await page.goto('/billing');
  await expect(page.getByTestId('credits-balance-section')).toBeVisible({ timeout: 15_000 });

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/balance');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(parseFloat(response.data.balance)).toBeCloseTo(1_234, 0);
  await expect(page.getByText('493,600 credits')).toBeVisible({ timeout: 10_000 });

  setUserCredits(user.id, 4_200);
});
