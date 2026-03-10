/**
 * Tests for Stripe live/test mode conflict handling.
 *
 * When a billing account stores a live-mode Stripe customer ID but the
 * environment uses a test-mode Stripe key (or vice versa), the Stripe API
 * rejects requests with a StripeInvalidRequestError. These tests verify that:
 *
 *  1. createCheckoutSession retries without the customer ID so Stripe creates
 *     a fresh one (the webhook then overwrites the stale ID in Orchestra).
 *  2. createCustomerPortalSession throws a user-friendly error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────
// vi.mock factories are hoisted above imports, so any variables they reference
// must also be hoisted via vi.hoisted().

const {
  mockCheckoutSessionsCreate,
  mockCustomersRetrieve,
  mockCustomersUpdate,
  mockCustomersListTaxIds,
  mockCustomersCreateTaxId,
  mockBillingPortalSessionsCreate,
  mockAdminGet,
} = vi.hoisted(() => ({
  mockCheckoutSessionsCreate: vi.fn(),
  mockCustomersRetrieve: vi.fn(),
  mockCustomersUpdate: vi.fn(),
  mockCustomersListTaxIds: vi.fn(),
  mockCustomersCreateTaxId: vi.fn(),
  mockBillingPortalSessionsCreate: vi.fn(),
  mockAdminGet: vi.fn(),
}));

// ─── Stripe SDK mock ────────────────────────────────────────────────────────

vi.mock('@/lib/user/billing/stripe/stripe-instance', () => ({
  stripe: {
    checkout: {
      sessions: { create: mockCheckoutSessionsCreate },
    },
    customers: {
      retrieve: mockCustomersRetrieve,
      update: mockCustomersUpdate,
      listTaxIds: mockCustomersListTaxIds,
      createTaxId: mockCustomersCreateTaxId,
    },
    billingPortal: {
      sessions: { create: mockBillingPortalSessionsCreate },
    },
  },
}));

// ─── Orchestra client mock ──────────────────────────────────────────────────

vi.mock('@/lib/orchestra/orchestra-client', () => ({
  OrchestraAdminClient: { get: mockAdminGet },
}));

// ─── Import subjects after mocks ────────────────────────────────────────────

import {
  createCheckoutSession,
  createCustomerPortalSession,
} from '@/lib/user/billing/stripe/stripe';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Builds a Stripe-like mode-conflict error (live customer + test key). */
function makeModeConflictError(customerId = 'cus_live_ABC123') {
  const err: any = new Error(
    `No such customer: '${customerId}'; a similar object exists in live mode, ` +
    'but a test mode key was used to make this request.',
  );
  err.type = 'StripeInvalidRequestError';
  return err;
}

/** Builds a generic Stripe error that is NOT a mode conflict. */
function makeGenericStripeError() {
  const err: any = new Error('Something went wrong');
  err.type = 'StripeInvalidRequestError';
  return err;
}

const TEST_CTX = { userId: 'user_test_123' };
const LIVE_CUSTOMER_ID = 'cus_live_ABC123';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default Orchestra admin responses for getCheckoutData.
  // The real OrchestraAdminClient response interceptor transforms snake_case
  // keys to camelCase, so mock data must use camelCase to match production.
  mockAdminGet.mockImplementation((url: string) => {
    if (url.includes('/user/by-user-id') || url.includes('/auth-user/by-user-id')) {
      return Promise.resolve({
        data: {
          createdAt: '2024-01-01T00:00:00Z',
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    }
    if (url.includes('/billing_eligibility')) {
      return Promise.resolve({ data: { totalSpending: 0 } });
    }
    if (url.includes('/billing/account-info')) {
      return Promise.resolve({ data: {} });
    }
    return Promise.resolve({ data: {} });
  });

  // Default: prefillCustomerFields should not throw
  mockCustomersRetrieve.mockResolvedValue({
    id: 'cus_test_123',
    email: 'test@example.com',
    name: 'Test User',
  });
  mockCustomersUpdate.mockResolvedValue({});
  mockCustomersListTaxIds.mockResolvedValue({ data: [] });

  // Required env vars for session creation
  process.env.STRIPE_UNIFY_CREDITS_PRICE_ID_PERSONAL = 'price_test_personal';
  process.env.STRIPE_UNIFY_CREDITS_PRICE_ID_BUSINESS = 'price_test_business';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
});

// ─── 1. createCheckoutSession ───────────────────────────────────────────────

describe('createCheckoutSession – mode conflict retry', () => {
  it('retries without customer ID when a mode conflict error occurs', async () => {
    // First call with customer ID → mode conflict
    mockCheckoutSessionsCreate
      .mockRejectedValueOnce(makeModeConflictError(LIVE_CUSTOMER_ID))
      // Second call without customer ID → success
      .mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/c/pay_test',
        id: 'cs_test_retry',
      });

    const result = await createCheckoutSession(TEST_CTX, LIVE_CUSTOMER_ID);

    // Should have called create twice
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(2);

    // First call should include the customer ID
    const firstCallParams = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(firstCallParams.customer).toBe(LIVE_CUSTOMER_ID);

    // Second (retry) call should NOT include customer, and should have customer_creation
    const retryCallParams = mockCheckoutSessionsCreate.mock.calls[1][0];
    expect(retryCallParams.customer).toBeUndefined();
    expect(retryCallParams.customer_update).toBeUndefined();
    expect(retryCallParams.customer_creation).toBe('always');
    expect(retryCallParams.customer_email).toBe('test@example.com');

    // Should return the session from the retry
    expect(result.url).toBe('https://checkout.stripe.com/c/pay_test');
    expect(result.sessionId).toBe('cs_test_retry');
  });

  it('does not retry for non-mode-conflict Stripe errors', async () => {
    mockCheckoutSessionsCreate.mockRejectedValueOnce(makeGenericStripeError());

    await expect(
      createCheckoutSession(TEST_CTX, LIVE_CUSTOMER_ID),
    ).rejects.toThrow('Something went wrong');

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it('does not retry when no customer ID was provided', async () => {
    // Even a mode conflict error shouldn't trigger retry logic when
    // there's no customer ID (no retry path makes sense).
    mockCheckoutSessionsCreate.mockRejectedValueOnce(makeModeConflictError());

    await expect(
      createCheckoutSession(TEST_CTX, null),
    ).rejects.toThrow();

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it('succeeds on first attempt when customer ID is valid', async () => {
    mockCheckoutSessionsCreate.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/c/pay_ok',
      id: 'cs_test_ok',
    });

    const result = await createCheckoutSession(TEST_CTX, 'cus_test_valid');

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('https://checkout.stripe.com/c/pay_ok');
    expect(result.sessionId).toBe('cs_test_ok');
  });

  it('works when no customer ID is provided (first-time buyer)', async () => {
    mockCheckoutSessionsCreate.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/c/pay_new',
      id: 'cs_test_new',
    });

    const result = await createCheckoutSession(TEST_CTX, null);

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
    const params = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(params.customer).toBeUndefined();
    expect(params.customer_creation).toBe('always');
    expect(result.url).toBe('https://checkout.stripe.com/c/pay_new');
  });
});

// ─── 2. createCustomerPortalSession ─────────────────────────────────────────

describe('createCustomerPortalSession – mode conflict', () => {
  it('throws a user-friendly error on mode conflict', async () => {
    mockBillingPortalSessionsCreate.mockRejectedValueOnce(
      makeModeConflictError(LIVE_CUSTOMER_ID),
    );

    await expect(
      createCustomerPortalSession(LIVE_CUSTOMER_ID),
    ).rejects.toThrow(/different environment/);
  });

  it('still throws the original error for non-mode-conflict errors', async () => {
    mockBillingPortalSessionsCreate.mockRejectedValueOnce(makeGenericStripeError());

    await expect(
      createCustomerPortalSession(LIVE_CUSTOMER_ID),
    ).rejects.toThrow('Something went wrong');
  });

  it('returns portal URL for valid test-mode customer', async () => {
    mockBillingPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    });

    const url = await createCustomerPortalSession('cus_test_valid');
    expect(url).toBe('https://billing.stripe.com/session/test');
  });
});

