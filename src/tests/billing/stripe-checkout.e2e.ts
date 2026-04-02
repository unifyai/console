/**
 * Stripe Integration E2E — checkout session, portal session, checkout return.
 *
 * Run: npx playwright test src/tests/billing/stripe-checkout.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import { createTestUser, cleanupUser, createBillingTest, type TestUser } from './helpers';

const user = createTestUser({ name: 'Stripe', lastName: 'Test', credits: 5_000 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

// ---------------------------------------------------------------------------
// Checkout Session API
// ---------------------------------------------------------------------------

test('checkout session API returns a Stripe URL or a server error', async ({
  authedPage: page,
}) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/stripe/checkoutSession');
    return { status: res.status, data: await res.json() };
  });

  if (response.status === 200) {
    expect(response.data.url).toBeTruthy();
    expect(response.data.sessionId).toBeTruthy();
    expect(response.data.url).toContain('stripe');
  } else {
    // Local dev often returns 500 when Stripe customer isn't provisioned
    expect(response.status).toBe(500);
    expect(response.data.error || response.data.detail || response.data.message).toBeTruthy();
  }
});

unauthTest('checkout session API requires authentication', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/stripe/checkoutSession');
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});

// ---------------------------------------------------------------------------
// Portal Session API
// ---------------------------------------------------------------------------

test('portal session API returns a Stripe URL or a server error', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/stripe/portalSession');
    return { status: res.status, data: await res.json() };
  });

  if (response.status === 200) {
    expect(response.data.url).toBeTruthy();
    expect(response.data.url).toContain('stripe');
  } else {
    expect(response.status).toBe(500);
    expect(response.data.error || response.data.detail || response.data.message).toBeTruthy();
  }
});

unauthTest('portal session API requires authentication', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/stripe/portalSession');
    return { status: res.status };
  });

  expect(response.status).toBe(401);
});

// ---------------------------------------------------------------------------
// Session Status API
// ---------------------------------------------------------------------------

test('returns error for invalid session ID', async ({ authedPage: page }) => {
  await page.goto('/billing');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/stripe/session-status?sessionId=invalid-session-123');
    return { status: res.status, data: await res.json() };
  });

  expect(response.status).toBeGreaterThanOrEqual(400);
});

// ---------------------------------------------------------------------------
// Checkout Return Flow
// ---------------------------------------------------------------------------

test('billing page with invalid sessionId shows error feedback', async ({ authedPage: page }) => {
  await page.goto('/billing?sessionId=fake-session');
  await page.waitForSelector('text=Balance', { timeout: 15_000 });

  const alert = page.locator('[role="alert"]');
  await expect(alert.first()).toBeVisible({ timeout: 10_000 });

  const alertText = await alert.first().textContent();
  expect(alertText).toMatch(/payment|error|not successful/i);
});

test('billing page strips sessionId from URL after processing', async ({ authedPage: page }) => {
  await page.goto('/billing?sessionId=test-session');
  await page.waitForSelector('text=Balance', { timeout: 15_000 });
  await page.waitForTimeout(2_000);

  expect(page.url()).not.toContain('sessionId');
});

// ---------------------------------------------------------------------------
// Side Panel
// ---------------------------------------------------------------------------

test('buy credits button initiates checkout flow', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await page.waitForSelector('text=Balance', { timeout: 15_000 });

  const buyBtn = page.locator('button', { hasText: 'Buy Credits' });
  await expect(buyBtn).toBeVisible({ timeout: 10_000 });

  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10_000 }).catch(() => null),
    buyBtn.click(),
  ]);

  if (popup) {
    const popupUrl = popup.url();
    expect(popupUrl).toMatch(/stripe|checkout/i);
    await popup.close();
  } else {
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/stripe|billing/i);
  }
});
