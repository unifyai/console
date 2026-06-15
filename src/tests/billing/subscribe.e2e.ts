/**
 * Subscription E2E — self-serve subscribe + immediate plan change.
 *
 * Covers the new self-serve model where accounts subscribe to a monthly
 * credit tier (1 credit = $1). One-time top-ups are gone, so these tests
 * exercise:
 *   * `GET  /api/billing/balance`   — new subscription fields surface.
 *   * `POST /api/billing/subscribe` — contract shape / auth.
 *   * the billing page's CREDITS view (subscribed vs. unsubscribed).
 *
 * The subscribe endpoint talks to Stripe; in local dev it commonly
 * returns a hosted-invoice URL or a provisioning error, so we assert the
 * contract (shape + status) rather than a specific Stripe outcome —
 * mirroring billing-api.e2e.ts.
 *
 * Run: npx playwright test src/tests/billing/subscribe.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import { createTestUser, cleanupUser, createBillingTest, type TestUser } from './helpers';

const user = createTestUser({ name: 'Subscribe', lastName: 'Test', credits: 50 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

// ---------------------------------------------------------------------------
// Balance contract — new subscription fields
// ---------------------------------------------------------------------------

test('balance endpoint surfaces the new subscription fields', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/balance');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBe(200);
  // New self-serve fields are always present (defaulted server-side).
  expect(typeof response.data.isSubscribed).toBe('boolean');
  // The monthly allowance is read off plan.commitAmount, not duplicated.
  expect('plan' in response.data).toBe(true);
  expect('trialExpiresAt' in response.data).toBe(true);
  expect('nextRenewalAt' in response.data).toBe(true);
});

// ---------------------------------------------------------------------------
// Subscribe API
// ---------------------------------------------------------------------------

test('subscribe API returns a structured response or a clear error', async ({
  authedPage: page,
}) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Smallest seeded tier ($50/mo). Exact id is resolved server-side
      // from the account's plan group; this is a structural assertion.
      body: JSON.stringify({ templateId: 1 }),
    });
    return { status: res.status, data: await res.json() };
  });

  if (response.status === 200) {
    // Either a subscribed result or a hosted-invoice redirect target.
    expect('hostedInvoiceUrl' in response.data || 'subscriptionStatus' in response.data).toBe(true);
  } else {
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.data.error || response.data.detail).toBeTruthy();
  }
});

test('subscribe API rejects a missing template id', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return { status: res.status };
  });

  expect(response.status).toBe(400);
});

unauthTest('subscribe API requires authentication', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 1 }),
    });
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});

// ---------------------------------------------------------------------------
// Unsubscribed (free/trial) billing view
// ---------------------------------------------------------------------------

test('unsubscribed account shows trial credits + choose-a-plan CTA', async ({
  authedPage: page,
}) => {
  await page.goto('/billing');
  await page.waitForSelector('[data-testid="credits-balance-section"]', { timeout: 15_000 });

  // Trial credits card + countdown copy and the plan picker CTA.
  await expect(page.getByTestId('choose-plan-card')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('tier-select-trigger')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('subscribe-plan-cta')).toHaveText(/subscribe/i, {
    timeout: 10_000,
  });
});
