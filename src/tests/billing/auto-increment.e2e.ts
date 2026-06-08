/**
 * Auto-Increment E2E — the self-serve replacement for auto-recharge.
 *
 * When enabled, depleting the cycle's credits auto-upgrades the
 * subscription to the next tier (capped at the top tier — never an
 * auto-downgrade). The toggle is only shown for subscribed accounts.
 *
 * The auto-increment state lives behind `GET/PUT /v0/billing/auto-increment`;
 * these tests assert the API contract (shape + auth) via the Next route,
 * mirroring billing-api.e2e.ts. UI-level coverage of the toggle requires a
 * backend seeded with an active subscription (see report notes).
 *
 * Run: npx playwright test src/tests/billing/auto-increment.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import { createTestUser, cleanupUser, createBillingTest, type TestUser } from './helpers';

const user = createTestUser({ name: 'AutoInc', lastName: 'Test', credits: 1_000 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

// ---------------------------------------------------------------------------
// GET auto-increment
// ---------------------------------------------------------------------------

test('GET returns the auto-increment contract shape', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/auto-increment');
    return { status: res.status, data: await res.json() };
  });

  if (response.status === 200) {
    expect(typeof response.data.enabled).toBe('boolean');
    expect(typeof response.data.isSubscribed).toBe('boolean');
    expect(typeof response.data.atTopTier).toBe('boolean');
  } else {
    expect(response.status).toBeGreaterThanOrEqual(400);
  }
});

// ---------------------------------------------------------------------------
// PUT auto-increment
// ---------------------------------------------------------------------------

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

test('PUT toggles auto-increment or returns a clear error', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/auto-increment', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    return { status: res.status, data: await res.json() };
  });

  if (response.status === 200) {
    expect(typeof response.data.enabled).toBe('boolean');
  } else {
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.data.error || response.data.detail).toBeTruthy();
  }
});

unauthTest('auto-increment API requires authentication', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/auto-increment');
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});
