/**
 * Billing Events (SSE) E2E — SSE stream accessibility and live delivery.
 *
 * With PUBSUB_EMULATOR_HOST set (CI / local.sh --pubsub), events are published
 * to the emulator topic. Without it, the local /billing/events/push bus is used.
 *
 * Run: npx playwright test src/tests/billing/billing-events.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import { createTestUser, cleanupUser, getBillingAccountId, createBillingTest } from './helpers';
import {
  ensureBillingPubSubTopic,
  publishBillingEventToEmulator,
  pubsubEmulatorConfigured,
} from '../assistants/chat-helpers';

const user = createTestUser({ name: 'SSE', lastName: 'Events', credits: 5_000 });
const billingAccountId = getBillingAccountId(user.id);
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

test('SSE stream delivers billing events in real time', async ({ authedPage: page }) => {
  const useEmulator = pubsubEmulatorConfigured();
  if (useEmulator) {
    await ensureBillingPubSubTopic(billingAccountId);
  }

  await page.goto('/assistants');

  const resultPromise = page.evaluate(
    async ({ baId, emulator }) => {
      return new Promise<{ ok: boolean; eventType?: string }>((resolve) => {
        const es = new EventSource('/api/billing/events/stream');
        let settled = false;

        const finish = (payload: { ok: boolean; eventType?: string }) => {
          if (settled) return;
          settled = true;
          es.close();
          resolve(payload);
        };

        const timeoutId = setTimeout(() => finish({ ok: false }), 12_000);

        es.onopen = () => {
          if (emulator) return;
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
            if (!res.ok) {
              clearTimeout(timeoutId);
              finish({ ok: false });
            }
          }, 250);
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event_type === 'credits_restored') {
              clearTimeout(timeoutId);
              finish({ ok: true, eventType: data.event_type });
            }
          } catch {
            /* ignore malformed frames */
          }
        };

        es.onerror = () => {
          clearTimeout(timeoutId);
          finish({ ok: false });
        };
      });
    },
    { baId: billingAccountId, emulator: useEmulator }
  );

  if (useEmulator) {
    // Wait for the browser SSE subscription to attach, then publish from Node.
    await page.waitForTimeout(1_000);
    await publishBillingEventToEmulator(billingAccountId, {
      event_type: 'credits_restored',
      balance: 100,
    });
  }

  const result = await resultPromise;
  expect(result.ok).toBe(true);
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

unauthTest('push endpoint is gated to local-bus mode', async ({ page }) => {
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

  if (pubsubEmulatorConfigured()) {
    expect(response.status).toBe(403);
    return;
  }

  expect(response.status).toBe(400);
  expect(response.data.detail).toMatch(/billing_account_id/i);
});
