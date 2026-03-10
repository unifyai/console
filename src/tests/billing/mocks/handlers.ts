/**
 * MSW handlers for billing-related API mocking.
 *
 * These provide default "happy path" responses.
 * Individual tests can override via `server.use(...)`.
 */

import { http, HttpResponse } from 'msw';

// ─── Default mock data ──────────────────────────────────────────────────────

export const defaultBillingDetails = {
  hasCustomerId: true,
};

export const defaultBalance = {
  balance: '25.00',
  fullBalance: 25,
};

export const defaultCreditGrantClaim = {
  message: 'Credits granted successfully!',
  credits_granted: 10,
  credited_to: 'personal',
};

// ─── Handlers ───────────────────────────────────────────────────────────────

export const billingHandlers = [
  // GET /api/billing/hasCustomerId
  http.get('/api/billing/hasCustomerId', () => {
    return HttpResponse.json(defaultBillingDetails);
  }),

  // GET /api/billing/balance
  http.get('/api/billing/balance', () => {
    return HttpResponse.json(defaultBalance);
  }),

  // POST /api/user/claim-credit-grant-link
  http.post('/api/user/claim-credit-grant-link', () => {
    return HttpResponse.json(defaultCreditGrantClaim);
  }),
];



