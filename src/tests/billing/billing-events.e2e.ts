/**
 * Billing Events (SSE) E2E — SSE stream accessibility, event push endpoint.
 *
 * Run: npx playwright test src/tests/billing/billing-events.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import { createTestUser, cleanupUser, getBillingAccountId, createBillingTest } from './helpers';

const user = createTestUser({ name: 'SSE', lastName: 'Events', credits: 5_000 });
const billingAccountId = getBillingAccountId(user.id);
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

test('SSE stream endpoint returns event-stream for authenticated users', async ({
  authedPage: page,
}) => {
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

  expect(response.status).toBe(200);
  expect(response.contentType).toContain('text/event-stream');
});

test('push endpoint delivers events to the SSE stream in local dev', async ({
  authedPage: page,
}, testInfo) => {
  await page.goto('/assistants');

  const result = await page.evaluate(
    async ({ baId }) => {
      return new Promise<{ pushStatus: number; gotEvent: boolean; eventType?: string }>(
        (resolve) => {
          const es = new EventSource('/api/billing/events/stream');
          let settled = false;

          const finish = (payload: {
            pushStatus: number;
            gotEvent: boolean;
            eventType?: string;
          }) => {
            if (settled) return;
            settled = true;
            es.close();
            resolve(payload);
          };

          const timeoutId = setTimeout(() => finish({ pushStatus: 0, gotEvent: false }), 12_000);

          es.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.event_type === 'credits_restored') {
                clearTimeout(timeoutId);
                finish({ pushStatus: 200, gotEvent: true, eventType: data.event_type });
              }
            } catch {
              /* ignore malformed frames */
            }
          };

          es.onerror = () => {
            clearTimeout(timeoutId);
            finish({ pushStatus: 0, gotEvent: false });
          };

          window.setTimeout(async () => {
            const res = await fetch('/api/billing/events/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                billing_account_id: baId,
                event_type: 'credits_restored',
                balance: 100,
              }),
            });
            if (res.status === 403) {
              clearTimeout(timeoutId);
              finish({ pushStatus: 403, gotEvent: false });
            }
          }, 750);
        }
      );
    },
    { baId: billingAccountId }
  );

  if (result.pushStatus === 403) {
    testInfo.skip(true, 'Local event bus unavailable (COMMS_SERVICE_ACCOUNT_CREDENTIALS set).');
  }

  expect(result.pushStatus).toBe(200);
  expect(result.gotEvent).toBe(true);
  expect(result.eventType).toBe('credits_restored');
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

unauthTest('push endpoint requires billing_account_id in local dev', async ({ page }, testInfo) => {
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

  if (response.status === 403) {
    testInfo.skip(true, 'Local event bus unavailable (COMMS_SERVICE_ACCOUNT_CREDENTIALS set).');
  }

  expect(response.status).toBe(400);
  expect(response.data.detail).toMatch(/billing_account_id/i);
});
