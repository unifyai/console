/**
 * Unit tests for src/lib/assistants/credits.ts
 *
 * Tests the credit checking and deduction functions for pre-hire chat
 * and other billable assistant operations.
 *
 * Uses MSW to mock Orchestra API calls.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Must import after environment setup
import { checkCreditsBalance, deductCredits } from '@/lib/user/credits';

// Mock environment variables
const MOCK_ORCHESTRA_URL = 'https://api.unify.ai';

describe('credits.ts', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('ORCHESTRA_URL', MOCK_ORCHESTRA_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  // ==========================================================================
  // checkCreditsBalance tests
  // ==========================================================================

  describe('checkCreditsBalance', () => {
    it(
      'returns hasSufficientCredits=true when balance exceeds required amount',
      {
        meta: {
          alias: 'Credits-SufficientBalance',
          scenario: 'User has 100 credits, requires 0.01',
          behavior: 'Returns hasSufficientCredits=true',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/credits`, () => {
            return HttpResponse.json({ id: 'user-123', credits: 100.0 });
          })
        );

        // Act
        const result = await checkCreditsBalance(TEST_API_KEY, 0.01);

        // Assert
        expect(result.hasSufficientCredits).toBe(true);
        expect(result.currentBalance).toBe(100.0);
        expect(result.error).toBeUndefined();
      }
    );

    it(
      'returns hasSufficientCredits=true when balance equals required amount',
      {
        meta: {
          alias: 'Credits-ExactBalance',
          scenario: 'User has exactly the required credits',
          behavior: 'Returns hasSufficientCredits=true',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/credits`, () => {
            return HttpResponse.json({ id: 'user-123', credits: 0.01 });
          })
        );

        // Act
        const result = await checkCreditsBalance(TEST_API_KEY, 0.01);

        // Assert
        expect(result.hasSufficientCredits).toBe(true);
        expect(result.currentBalance).toBe(0.01);
      }
    );

    it(
      'returns hasSufficientCredits=false when balance is insufficient',
      {
        meta: {
          alias: 'Credits-InsufficientBalance',
          scenario: 'User has 0 credits, requires 0.01',
          behavior: 'Returns hasSufficientCredits=false',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/credits`, () => {
            return HttpResponse.json({ id: 'user-123', credits: 0 });
          })
        );

        // Act
        const result = await checkCreditsBalance(TEST_API_KEY, 0.01);

        // Assert
        expect(result.hasSufficientCredits).toBe(false);
        expect(result.currentBalance).toBe(0);
      }
    );

    it(
      'returns error when API call fails',
      {
        meta: {
          alias: 'Credits-CheckError',
          scenario: 'Orchestra API returns error',
          behavior: 'Returns hasSufficientCredits=false with error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/credits`, () => {
            return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
          })
        );

        // Act
        const result = await checkCreditsBalance(TEST_API_KEY, 0.01);

        // Assert
        expect(result.hasSufficientCredits).toBe(false);
        expect(result.currentBalance).toBe(0);
        expect(result.error).toBeDefined();
      }
    );

    it(
      'handles missing credits field gracefully',
      {
        meta: {
          alias: 'Credits-MissingField',
          scenario: 'API response missing credits field',
          behavior: 'Defaults to 0 credits',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/credits`, () => {
            return HttpResponse.json({ id: 'user-123' });
          })
        );

        // Act
        const result = await checkCreditsBalance(TEST_API_KEY, 0.01);

        // Assert
        expect(result.hasSufficientCredits).toBe(false);
        expect(result.currentBalance).toBe(0);
      }
    );

    it(
      'handles network errors gracefully',
      {
        meta: {
          alias: 'Credits-NetworkError',
          scenario: 'Network request fails',
          behavior: 'Returns error without throwing',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/credits`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const result = await checkCreditsBalance(TEST_API_KEY, 0.01);

        // Assert
        expect(result.hasSufficientCredits).toBe(false);
        expect(result.error).toBeDefined();
      }
    );
  });

  // ==========================================================================
  // deductCredits tests
  // ==========================================================================

  describe('deductCredits', () => {
    it(
      'returns success with deduction details on successful deduction',
      {
        meta: {
          alias: 'Credits-DeductSuccess',
          scenario: 'Deduction of 0.01 credits succeeds',
          behavior: 'Returns success=true with details',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/credits/deduct`, () => {
            return HttpResponse.json({
              previous_credits: 10.0,
              deducted: 0.01,
              current_credits: 9.99,
            });
          })
        );

        // Act
        const result = await deductCredits(TEST_API_KEY, 0.01);

        // Assert
        expect(result.success).toBe(true);
        expect(result.previousCredits).toBe(10.0);
        expect(result.deducted).toBe(0.01);
        expect(result.currentCredits).toBe(9.99);
        expect(result.error).toBeUndefined();
      }
    );

    it(
      'returns INSUFFICIENT_CREDITS error when balance is too low',
      {
        meta: {
          alias: 'Credits-DeductInsufficient',
          scenario: 'User has insufficient credits for deduction',
          behavior: 'Returns success=false with INSUFFICIENT_CREDITS error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/credits/deduct`, () => {
            return HttpResponse.json(
              { detail: 'Insufficient credits. Available: 0.0, requested: 0.01' },
              { status: 400 }
            );
          })
        );

        // Act
        const result = await deductCredits(TEST_API_KEY, 0.01);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe('INSUFFICIENT_CREDITS');
      }
    );

    it(
      'rejects non-positive amounts',
      {
        meta: {
          alias: 'Credits-DeductNonPositive',
          scenario: 'Attempting to deduct 0 or negative amount',
          behavior: 'Returns error without API call',
        },
      },
      async () => {
        // Act - zero amount
        const resultZero = await deductCredits(TEST_API_KEY, 0);

        // Assert
        expect(resultZero.success).toBe(false);
        expect(resultZero.error).toBe('Amount must be positive');

        // Act - negative amount
        const resultNegative = await deductCredits(TEST_API_KEY, -1);

        // Assert
        expect(resultNegative.success).toBe(false);
        expect(resultNegative.error).toBe('Amount must be positive');
      }
    );

    it(
      'returns error on API failure (non-400)',
      {
        meta: {
          alias: 'Credits-DeductApiError',
          scenario: 'Orchestra API returns 500 error',
          behavior: 'Returns success=false with error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/credits/deduct`, () => {
            return HttpResponse.json({ detail: 'Internal server error' }, { status: 500 });
          })
        );

        // Act
        const result = await deductCredits(TEST_API_KEY, 0.01);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe('Internal server error');
      }
    );

    it(
      'handles network errors gracefully',
      {
        meta: {
          alias: 'Credits-DeductNetworkError',
          scenario: 'Network request fails',
          behavior: 'Returns error without throwing',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/credits/deduct`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const result = await deductCredits(TEST_API_KEY, 0.01);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    );

    it(
      'sends correct amount in request body',
      {
        meta: {
          alias: 'Credits-DeductRequestBody',
          scenario: 'Verify request body format',
          behavior: 'Request body contains amount field',
        },
      },
      async () => {
        // Arrange
        let capturedBody: unknown = null;
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/credits/deduct`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({
              previous_credits: 10.0,
              deducted: 0.05,
              current_credits: 9.95,
            });
          })
        );

        // Act
        await deductCredits(TEST_API_KEY, 0.05);

        // Assert
        expect(capturedBody).toEqual({ amount: 0.05 });
      }
    );
  });

  // ==========================================================================
  // Integration scenarios
  // ==========================================================================

  describe('credit flow scenarios', () => {
    it(
      'check then deduct flow works correctly',
      {
        meta: {
          alias: 'Credits-CheckThenDeduct',
          scenario: 'Full check-then-deduct workflow',
          behavior: 'Both operations succeed in sequence',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/credits`, () => {
            return HttpResponse.json({ id: 'user-123', credits: 50.0 });
          }),
          http.post(`${MOCK_ORCHESTRA_URL}/v0/credits/deduct`, () => {
            return HttpResponse.json({
              previous_credits: 50.0,
              deducted: 0.01,
              current_credits: 49.99,
            });
          })
        );

        // Act - Check first
        const checkResult = await checkCreditsBalance(TEST_API_KEY, 0.01);
        expect(checkResult.hasSufficientCredits).toBe(true);

        // Act - Then deduct
        const deductResult = await deductCredits(TEST_API_KEY, 0.01);
        expect(deductResult.success).toBe(true);
        expect(deductResult.currentCredits).toBe(49.99);
      }
    );

    it(
      'handles organization API key correctly',
      {
        meta: {
          alias: 'Credits-OrgApiKey',
          scenario: 'Using organization API key',
          behavior: 'Deduction uses org billing user credits',
        },
      },
      async () => {
        // Arrange
        const ORG_API_KEY = 'org-api-key-123';
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/credits`, ({ request }) => {
            const authHeader = request.headers.get('Authorization');
            expect(authHeader).toBe(`Bearer ${ORG_API_KEY}`);
            return HttpResponse.json({ id: 'billing-user-456', credits: 1000.0 });
          })
        );

        // Act
        const result = await checkCreditsBalance(ORG_API_KEY, 0.01);

        // Assert
        expect(result.hasSufficientCredits).toBe(true);
        expect(result.currentBalance).toBe(1000.0);
      }
    );
  });
});
