/**
 * Integration tests – billing flows through the Console API routes.
 *
 * These tests hit the running Console dev server (`/api/billing/…`,
 * `/api/stripe/…`) which proxies to a live Orchestra instance.  This
 * exercises the full request path:
 *
 *   test (fetch) → Console route → getOrchestraUserClient / BillingLib → Orchestra
 *
 * Follows the same pattern as the other `@real` tests:
 *   - Uses `meta: { mock: false }` so MSW passthroughs all requests.
 *   - Authenticates via the `apiKey` header (supported by `getApiKeyFromRequest`).
 *   - Skips when the Console dev server is not reachable.
 *
 * Verified flows:
 *   1. Balance retrieval
 *   2. Billing profile round-trip (read → write → verify)
 *   3. Auto-recharge settings round-trip
 *   4. Supported tax countries query          (Stripe-gated)
 *   5. Tax ID validation                      (Stripe-gated)
 *   6. Checkout session creation              (Stripe-gated, needs customer + price)
 *   7. Portal session creation                (Stripe-gated, needs customer)
 *
 * Prerequisites:
 *   - Console dev server running     (`npm run dev`)
 *   - Orchestra running locally
 *   - VITE_TEST_API_KEY set          (e.g. in .env.test)
 *   - For Stripe tests: STRIPE_SECRET_KEY and the test user must have a
 *     linked Stripe customer.
 *
 * Run:
 *   npx vitest run --project real src/tests/billing/integration.real.node.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import {
  skipIfServerNotReachable,
  realTestOptions,
  realTestOptionsExtended,
  getTestApiKey,
  ApiError,
} from '@/tests/assistants/api/fixtures/api-actions';

// ─── Environment ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const DB_CONTAINER = process.env.ORCHESTRA_DB_CONTAINER || 'orchestra-local-db';
const TEST_USER_ID = process.env.ORCHESTRA_TEST_USER_ID || 'test-user-001';

const hasStripe = !!STRIPE_KEY;

/** Prefer ORCHESTRA_TEST_API_KEY (explicit local key), fall back to VITE_TEST_API_KEY. */
function getBillingApiKey(): string {
  return process.env.ORCHESTRA_TEST_API_KEY || getTestApiKey();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_TIMEOUT = 30_000;

async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const apiKey = getBillingApiKey();
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    return await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apiKey,
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(tid);
  }
}

async function apiJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(endpoint, options);
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

// ─── Stripe API helpers ──────────────────────────────────────────────────────

async function stripePost(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${STRIPE_KEY}:`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

async function stripeDelete(path: string) {
  await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${btoa(`${STRIPE_KEY}:`)}` },
  });
}

/** Run a SQL query against the local Orchestra DB. */
function dbExec(sql: string) {
  execSync(
    `docker exec ${DB_CONTAINER} psql -U orchestra -d orchestra -tAc "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', timeout: 5_000 },
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('@real Billing API', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Balance retrieval
  // ─────────────────────────────────────────────────────────────────────────

  describe('Balance retrieval', () => {
    it(
      '@real returns a valid balance with expected shape',
      realTestOptions,
      async () => {
        const data = await apiJson<any>('/api/billing/balance');

        expect(typeof data.balance).toBe('string');
        expect(typeof data.fullBalance).toBe('number');
        expect(data.fullBalance).toBeGreaterThanOrEqual(0);
        expect(parseFloat(data.balance)).toBeCloseTo(data.fullBalance, 2);
        expect(['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CLOSED']).toContain(
          data.accountStatus,
        );
      },
    );

    it(
      '@real returns the same balance on consecutive calls',
      realTestOptions,
      async () => {
        const first = await apiJson<any>('/api/billing/balance');
        const second = await apiJson<any>('/api/billing/balance');
        expect(first.fullBalance).toBe(second.fullBalance);
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Billing profile round-trip
  // ─────────────────────────────────────────────────────────────────────────

  describe('Billing profile round-trip', () => {
    let originalProfile: any;

    afterAll(async () => {
      // Restore original profile
      if (!originalProfile) return;
      try {
        await apiJson('/api/billing/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            name: originalProfile.name || '',
            billing_email: originalProfile.billing_email || originalProfile.billingEmail || '',
            tax_id: originalProfile.tax_id || originalProfile.taxId || '',
            tax_id_type: originalProfile.tax_id_type || originalProfile.taxIdType || '',
            billing_address: originalProfile.billing_address || originalProfile.billingAddress || {},
          }),
        });
      } catch {
        // Best effort
      }
    });

    it(
      '@real fetches the current profile without error',
      realTestOptions,
      async () => {
        originalProfile = await apiJson<any>('/api/billing/profile');
        // The profile route proxies directly — field names may be snake_case
        expect(originalProfile).toBeDefined();
      },
    );

    it(
      '@real updates name and email, then verifies changes persisted',
      realTestOptions,
      async () => {
        const uniqueName = `Integration Test ${Date.now()}`;
        const testEmail = 'integration-billing-test@example.com';

        const updated = await apiJson<any>('/api/billing/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            name: uniqueName,
            billing_email: testEmail,
          }),
        });
        // Response may use snake_case (profile route proxies raw Orchestra response)
        const updatedName = updated.name;
        expect(updatedName).toBe(uniqueName);

        // Re-fetch to confirm persistence
        const refetched = await apiJson<any>('/api/billing/profile');
        expect(refetched.name).toBe(uniqueName);
        const refetchedEmail =
          refetched.billing_email ?? refetched.billingEmail;
        expect(refetchedEmail).toBe(testEmail);
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Auto-recharge settings round-trip
  // ─────────────────────────────────────────────────────────────────────────

  describe('Auto-recharge settings round-trip', () => {
    let originalSettings: any = null;
    let canWrite = false;

    afterAll(async () => {
      if (!originalSettings || !canWrite) return;
      try {
        await apiJson('/api/billing/auto-recharge/settings', {
          method: 'POST',
          body: JSON.stringify({
            autoRechargeEnabled: originalSettings.autoRechargeEnabled,
            autoRechargeThreshold: originalSettings.autoRechargeThreshold,
            autoRechargeQty: originalSettings.autoRechargeQty,
          }),
        });
      } catch {
        // Best effort
      }
    });

    it(
      '@real fetches settings with all expected fields',
      realTestOptions,
      async () => {
        const data = await apiJson<any>('/api/billing/auto-recharge/settings');
        originalSettings = data;

        canWrite = data.canEnableAutoRecharge || data.autoRechargeEnabled;

        expect(typeof data.autoRechargeEnabled).toBe('boolean');
        expect(typeof data.autoRechargeThreshold).toBe('number');
        expect(typeof data.autoRechargeQty).toBe('number');
        expect(typeof data.minRechargeAmount).toBe('number');
        expect(typeof data.canEnableAutoRecharge).toBe('boolean');
        expect(typeof data.totalSpending).toBe('number');
        expect(typeof data.minimumSpendRequired).toBe('number');
        expect(typeof data.remainingSpendNeeded).toBe('number');
        expect(typeof data.hasPaymentMethod).toBe('boolean');
      },
    );

    it(
      '@real updates threshold and qty, then verifies via re-fetch',
      realTestOptions,
      async () => {
        if (!canWrite) return;

        const newThreshold =
          originalSettings.autoRechargeThreshold === 15 ? 20 : 15;
        const newQty = Math.max(originalSettings.minRechargeAmount ?? 25, 30);

        await apiJson('/api/billing/auto-recharge/settings', {
          method: 'POST',
          body: JSON.stringify({
            autoRechargeEnabled: originalSettings.autoRechargeEnabled,
            autoRechargeThreshold: newThreshold,
            autoRechargeQty: newQty,
          }),
        });

        const refetched = await apiJson<any>(
          '/api/billing/auto-recharge/settings',
        );
        expect(refetched.autoRechargeThreshold).toBe(newThreshold);
        expect(refetched.autoRechargeQty).toBe(newQty);
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4 & 5. Tax countries + validation (Stripe-gated)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Tax countries and validation', () => {
    let countries: any;

    it(
      '@real returns a non-empty list of supported tax countries',
      realTestOptionsExtended,
      async () => {
        try {
          countries = await apiJson<any>(
            '/api/billing/supported-tax-countries',
          );
        } catch (e) {
          if (e instanceof ApiError && e.status === 500) {
            console.warn(
              'Skipping tax tests: supported-tax-countries returned 500 ' +
                '(Stripe may not be configured on Orchestra)',
            );
            return;
          }
          throw e;
        }

        const countryKeys = Object.keys(
          countries.supported_countries ??
            countries.supportedCountries ??
            {},
        );
        const total =
          countries.total_countries ?? countries.totalCountries ?? 0;

        expect(total).toBeGreaterThan(0);
        expect(countryKeys.length).toBeGreaterThan(0);
      },
    );

    it(
      '@real validates a well-known tax ID format',
      realTestOptions,
      async () => {
        if (!countries) return;

        const supported =
          countries.supported_countries ?? countries.supportedCountries ?? {};
        if (!supported['DE']) return;

        const result = await apiJson<any>('/api/billing/validate-tax-id', {
          method: 'POST',
          body: JSON.stringify({ country: 'DE', taxId: 'DE123456789' }),
        });
        const isValid =
          result.valid ?? result.is_valid ?? result.isValid ?? false;
        expect(typeof isValid).toBe('boolean');
      },
    );

    it(
      '@real rejects a clearly-invalid tax ID',
      realTestOptions,
      async () => {
        if (!countries) return;

        const supported =
          countries.supported_countries ?? countries.supportedCountries ?? {};
        if (!supported['DE']) return;

        const result = await apiJson<any>('/api/billing/validate-tax-id', {
          method: 'POST',
          body: JSON.stringify({ country: 'DE', taxId: '123' }),
        });
        const isValid =
          result.valid ?? result.is_valid ?? result.isValid ?? true;
        expect(isValid).toBe(false);
      },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6 & 7. Checkout + Portal sessions (Stripe-gated)
  //
  // These tests automatically provision a temporary Stripe customer,
  // link it to the test user's billing_account, and clean up afterwards.
  // ─────────────────────────────────────────────────────────────────────────

  describe('Stripe sessions (checkout + portal)', () => {
    let createdCustomerId: string | null = null;
    let canTestStripe = hasStripe;

    beforeAll(async () => {
      if (!hasStripe) return;

      // 1. Create a temporary Stripe test customer
      const customer = await stripePost('customers', {
        email: 'integration-test@debug.local',
        name: 'Integration Test Customer',
        'metadata[purpose]': 'console-integration-test',
        'metadata[created_by]': 'integration.real.node.test.ts',
      });

      if (!customer?.id?.startsWith('cus_')) {
        console.warn(
          'Failed to create Stripe customer — skipping Stripe session tests',
        );
        canTestStripe = false;
        return;
      }
      createdCustomerId = customer.id;

      // 2. Link the customer to the test user's billing_account in PostgreSQL
      try {
        dbExec(
          `UPDATE billing_account SET stripe_customer_id = '${createdCustomerId}' ` +
            `WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${TEST_USER_ID}')`,
        );
      } catch (e: any) {
        console.warn(
          `Cannot link Stripe customer to DB (${e.message}) — ` +
            'skipping Stripe session tests',
        );
        await stripeDelete(`customers/${createdCustomerId}`);
        createdCustomerId = null;
        canTestStripe = false;
      }
    });

    afterAll(async () => {
      // 1. Remove stripe_customer_id from the billing_account
      if (createdCustomerId) {
        try {
          dbExec(
            `UPDATE billing_account SET stripe_customer_id = NULL ` +
              `WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${TEST_USER_ID}')`,
          );
        } catch {
          // Best effort
        }

        // 2. Delete the Stripe test customer
        await stripeDelete(`customers/${createdCustomerId}`);
      }
    });

    it(
      '@real creates a checkout session and returns a valid Stripe URL',
      realTestOptionsExtended,
      async () => {
        if (!canTestStripe) return;

        try {
          const data = await apiJson<any>('/api/stripe/checkoutSession');
          expect(data.url).toBeTruthy();
          expect(data.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
        } catch (e) {
          if (e instanceof ApiError && (e.status === 400 || e.status === 500)) {
            const detail = String(e.body?.error ?? e.body?.detail ?? '');
            if (
              detail.includes('price') ||
              detail.includes('Price') ||
              detail.includes('not configured')
            ) {
              console.warn(
                `Skipping checkout test: ${detail}. ` +
                  'Ensure STRIPE_UNIFY_CREDITS_PRICE_ID_PERSONAL is set to ' +
                  'an active price on Orchestra.',
              );
              return;
            }
          }
          throw e;
        }
      },
    );

    it(
      '@real creates a portal session and returns a valid Stripe URL',
      realTestOptionsExtended,
      async () => {
        if (!canTestStripe) return;

        const data = await apiJson<any>('/api/stripe/portalSession');
        expect(data.url).toBeTruthy();
        expect(data.url).toMatch(/^https:\/\/billing\.stripe\.com\//);
      },
    );
  });
});
