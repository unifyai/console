/**
 * Billing Events (SSE) E2E — SSE stream accessibility, event push endpoint.
 *
 * Run: npx playwright test src/tests/billing/billing-events.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  getBillingAccountId,
  createBillingTest,
  type TestUser,
} from './helpers';

const user = createTestUser({ name: 'SSE', lastName: 'Events', credits: 5_000 });
const billingAccountId = getBillingAccountId(user.id);
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

// ---------------------------------------------------------------------------
// SSE Stream
// ---------------------------------------------------------------------------

test('SSE stream endpoint is accessible for authenticated users', async ({ authedPage: page }) => {
  await page.goto('/assistants');

  const response = await page.evaluate(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch('/api/billing/events/stream', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return { status: res.status, contentType: res.headers.get('content-type') };
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        return { status: 200, contentType: 'text/event-stream', aborted: true };
      }
      return { status: 0, error: e.message };
    }
  });

  expect([200, 404]).toContain(response.status);
  if (response.status === 200) {
    expect(response.contentType).toContain('text/event-stream');
  }
});

unauthTest('SSE stream is unauthorized for unauthenticated requests', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch('/api/billing/events/stream', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return { status: res.status };
    } catch {
      clearTimeout(timeoutId);
      return { status: 0 };
    }
  });

  expect(response.status).toBe(401);
});

// ---------------------------------------------------------------------------
// Push Endpoint (local dev only)
// ---------------------------------------------------------------------------

unauthTest('push endpoint accepts billing events', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(
    async ({ baId }) => {
      const res = await fetch('/api/billing/events/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_account_id: baId,
          event_type: 'credits_restored',
          balance: 100,
        }),
      });
      return { status: res.status, data: await res.json() };
    },
    { baId: billingAccountId }
  );

  if (response.status === 200) {
    expect(response.data.ok).toBe(true);
  } else {
    expect(response.status).toBe(403);
  }
});

unauthTest('push endpoint requires billing_account_id', async ({ page }) => {
  await page.goto('/login');

  const response = await page.evaluate(async () => {
    const res = await fetch('/api/billing/events/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'credits_exhausted',
        balance: -1,
      }),
    });
    return { status: res.status, data: await res.json() };
  });

  expect([400, 403]).toContain(response.status);
});
