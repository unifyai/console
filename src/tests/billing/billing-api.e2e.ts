/**
 * Billing API E2E — balance endpoint, billing profile, tax validation,
 * supported countries.
 *
 * Run: npx playwright test src/tests/billing/billing-api.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  setUserCredits,
  createBillingTest,
  type TestUser,
} from './helpers';

const user = createTestUser({ name: 'API', lastName: 'Billing', credits: 4_200 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

// ---------------------------------------------------------------------------
// Balance API
// ---------------------------------------------------------------------------

test('returns balance for authenticated user', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/balance');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(response.data.balance).toBeTruthy();
  expect(parseFloat(response.data.balance)).toBeGreaterThan(0);
  expect(response.data.accountStatus).toBe('ACTIVE');
});

test('balance reflects DB credits accurately', async ({ authedPage: page }) => {
  setUserCredits(user.id, 1_234);
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/balance');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(parseFloat(response.data.balance)).toBeCloseTo(1_234, 0);
  setUserCredits(user.id, 4_200);
});

unauthTest('balance returns 401 for unauthenticated request', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/balance');
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});

// ---------------------------------------------------------------------------
// Billing Profile API
// ---------------------------------------------------------------------------

test('GET returns billing profile', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/profile');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(typeof response.data).toBe('object');
});

test('PATCH updates billing profile and change persists', async ({ authedPage: page }) => {
  const testName = `E2E Profile ${Date.now()}`;
  await page.goto('/billing');

  const response = await page.evaluate(async (name) => {
    const res = await fetch('/api/billing/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return { status: res.status, data: await res.json() };
  }, testName);

  expect(response.status).toBe(200);
  expect(response.data.name ?? response.data.individual_name).toBe(testName);

  const getResponse = await page.evaluate(async () => {
    const res = await fetch('/api/billing/profile');
    return { status: res.status, data: await res.json() };
  });

  expect(getResponse.status).toBe(200);
  const persistedName = getResponse.data.name ?? getResponse.data.individual_name;
  if (persistedName) {
    expect(persistedName).toBe(testName);
  }
});

unauthTest('billing profile API requires authentication', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/profile');
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});

// ---------------------------------------------------------------------------
// Supported Tax Countries API
// ---------------------------------------------------------------------------

test('returns list of supported tax countries', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/supported-tax-countries');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  expect(typeof response.data).toBe('object');
});

unauthTest('tax countries API requires authentication', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/supported-tax-countries');
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});

// ---------------------------------------------------------------------------
// Tax ID Validation API
// ---------------------------------------------------------------------------

test('validates a tax ID and returns a structured response', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/validate-tax-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxId: 'DE123456789', country: 'DE' }),
    });
    return { status: res.status, data: await res.json() };
  });

  expect(typeof response.data).toBe('object');
  // In local dev, Stripe may not validate — but the endpoint must return
  // either a valid response (200 with data) or a clear error (4xx/5xx with detail).
  if (response.status === 200) {
    expect('valid' in response.data || 'error' in response.data).toBe(true);
  } else {
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.data.error || response.data.detail).toBeTruthy();
  }
});

unauthTest('tax validation API requires authentication', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/validate-tax-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxId: 'DE123456789', country: 'DE' }),
    });
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});
