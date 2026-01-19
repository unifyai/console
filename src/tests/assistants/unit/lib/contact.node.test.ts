/**
 * Unit tests for src/lib/assistants/contact.ts
 *
 * Tests the server action factory functions for contact operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import {
  listAllAssistantEmails,
  listAvailablePhoneCountries,
  listAvailableSocialPlatforms,
  verifySocialAccount,
  deleteAssistantContact,
} from '@/lib/assistants/contact';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('contact.ts', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('listAllAssistantEmails', () => {
    it(
      'returns array of emails on success',
      {
        meta: {
          alias: 'ListEmails-Success',
          scenario: 'API returns valid email list',
          behavior: 'Returns string array of emails',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/email`, () => {
            return HttpResponse.json({
              emails: ['assistant1@example.com', 'assistant2@example.com'],
            });
          })
        );

        // Act
        const listFn = await listAllAssistantEmails(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect(result).toContain('assistant1@example.com');
      }
    );

    it(
      'returns error when response format is unexpected',
      {
        meta: {
          alias: 'ListEmails-UnexpectedFormat',
          scenario: 'API returns data without emails array',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/email`, () => {
            return HttpResponse.json({ data: [] });
          })
        );

        // Act
        const listFn = await listAllAssistantEmails(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'returns error when API fails',
      {
        meta: {
          alias: 'ListEmails-Error',
          scenario: 'API returns error response',
          behavior: 'Returns error detail from API',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/email`, () => {
            return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
          })
        );

        // Act
        const listFn = await listAllAssistantEmails(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail', 'Unauthorized');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'ListEmails-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/email`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const listFn = await listAllAssistantEmails(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('listAvailablePhoneCountries', () => {
    it(
      'returns array of available countries',
      {
        meta: {
          alias: 'ListCountries-Success',
          scenario: 'API returns valid country list',
          behavior: 'Returns AvailablePhoneCountry array',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/phone/available-countries`, () => {
            return HttpResponse.json({
              countries: [
                { code: 'US', name: 'United States', flag: '🇺🇸' },
                { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
              ],
            });
          })
        );

        // Act
        const listFn = await listAvailablePhoneCountries(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('code', 'US');
      }
    );

    it(
      'falls back to US when response format is unexpected',
      {
        meta: {
          alias: 'ListCountries-Fallback',
          scenario: 'API returns unexpected format',
          behavior: 'Returns US as default country',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/phone/available-countries`, () => {
            return HttpResponse.json({ data: 'unexpected' });
          })
        );

        // Act
        const listFn = await listAvailablePhoneCountries(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty('code', 'US');
      }
    );

    it(
      'falls back to US when API fails',
      {
        meta: {
          alias: 'ListCountries-ErrorFallback',
          scenario: 'API returns error',
          behavior: 'Returns US as fallback',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/phone/available-countries`, () => {
            return HttpResponse.json({}, { status: 500 });
          })
        );

        // Act
        const listFn = await listAvailablePhoneCountries(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty('code', 'US');
      }
    );
  });

  describe('listAvailableSocialPlatforms', () => {
    it(
      'returns array of available platforms',
      {
        meta: {
          alias: 'ListPlatforms-Success',
          scenario: 'API returns valid platform list',
          behavior: 'Returns AvailableSocialPlatform array',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/social/available-platforms`, () => {
            return HttpResponse.json({
              platforms: [
                { name: 'twitter', displayName: 'Twitter' },
                { name: 'instagram', displayName: 'Instagram' },
              ],
            });
          })
        );

        // Act
        const listFn = await listAvailableSocialPlatforms(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect((result as any[])[0]).toHaveProperty('name', 'twitter');
      }
    );

    it(
      'returns error when response format is unexpected',
      {
        meta: {
          alias: 'ListPlatforms-UnexpectedFormat',
          scenario: 'API returns data without platforms array',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/social/available-platforms`, () => {
            return HttpResponse.json({ data: [] });
          })
        );

        // Act
        const listFn = await listAvailableSocialPlatforms(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'returns error when API fails',
      {
        meta: {
          alias: 'ListPlatforms-Error',
          scenario: 'API returns error response',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/social/available-platforms`, () => {
            return HttpResponse.json({ detail: 'Service unavailable' }, { status: 503 });
          })
        );

        // Act
        const listFn = await listAvailableSocialPlatforms(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail', 'Service unavailable');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'ListPlatforms-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/contact/social/available-platforms`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const listFn = await listAvailableSocialPlatforms(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('verifySocialAccount', () => {
    it(
      'sends verification request and returns code',
      {
        meta: {
          alias: 'VerifySocial-Success',
          scenario: 'API successfully sends verification',
          behavior: 'Returns verificationCode and sentAt',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/contact/social/verify`, () => {
            return HttpResponse.json({
              verificationCode: 'ABC123',
              sentAt: '2024-01-01T12:00:00Z',
            });
          })
        );

        // Act
        const verifyFn = await verifySocialAccount(TEST_API_KEY);
        const result = await verifyFn('twitter', '@username');

        // Assert
        expect(result).toHaveProperty('verificationCode', 'ABC123');
        expect(result).toHaveProperty('sentAt');
      }
    );

    it(
      'sends correct payload',
      {
        meta: {
          alias: 'VerifySocial-Payload',
          scenario: 'Verify request body structure',
          behavior: 'Request contains platform and accountIdentifier',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.post(`${MOCK_BASE_URL}/api/contact/social/verify`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({
              verificationCode: 'ABC123',
              sentAt: '2024-01-01T12:00:00Z',
            });
          })
        );

        // Act
        const verifyFn = await verifySocialAccount(TEST_API_KEY);
        await verifyFn('instagram', 'user123');

        // Assert
        expect(capturedBody).toHaveProperty('platform', 'instagram');
        expect(capturedBody).toHaveProperty('accountIdentifier', 'user123');
      }
    );

    it(
      'returns error when verification fails',
      {
        meta: {
          alias: 'VerifySocial-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/contact/social/verify`, () => {
            return HttpResponse.json({ detail: 'Account not found' }, { status: 404 });
          })
        );

        // Act
        const verifyFn = await verifySocialAccount(TEST_API_KEY);
        const result = await verifyFn('twitter', '@nonexistent');

        // Assert
        expect(result).toHaveProperty('detail', 'Account not found');
      }
    );

    it(
      'returns error for unexpected response format',
      {
        meta: {
          alias: 'VerifySocial-UnexpectedFormat',
          scenario: 'API returns success without expected fields',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/contact/social/verify`, () => {
            return HttpResponse.json({ success: true });
          })
        );

        // Act
        const verifyFn = await verifySocialAccount(TEST_API_KEY);
        const result = await verifyFn('twitter', '@user');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'VerifySocial-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/contact/social/verify`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const verifyFn = await verifySocialAccount(TEST_API_KEY);
        const result = await verifyFn('twitter', '@user');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('deleteAssistantContact', () => {
    it(
      'deletes contact and returns updated assistant',
      {
        meta: {
          alias: 'DeleteContact-Success',
          scenario: 'API successfully deletes contact',
          behavior: 'Returns info message and updated assistant',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/:id/contact`, () => {
            return HttpResponse.json({
              info: { agent_id: 'a1', first_name: 'Jane' },
            });
          })
        );

        // Act
        const deleteFn = await deleteAssistantContact(TEST_API_KEY);
        const result = await deleteFn('a1', 'phone');

        // Assert
        expect(result).toHaveProperty('info');
        expect(result).toHaveProperty('assistant');
        expect(result.assistant).toHaveProperty('agentId', 'a1');
      }
    );

    it(
      'sends correct payload with contactType',
      {
        meta: {
          alias: 'DeleteContact-Payload',
          scenario: 'Verify request body structure',
          behavior: 'Request contains contactType',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/:id/contact`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: { agent_id: 'a1' } });
          })
        );

        // Act
        const deleteFn = await deleteAssistantContact(TEST_API_KEY);
        await deleteFn('a1', 'email');

        // Assert
        expect(capturedBody).toHaveProperty('contactType', 'email');
      }
    );

    it(
      'returns error when delete fails',
      {
        meta: {
          alias: 'DeleteContact-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/:id/contact`, () => {
            return HttpResponse.json({ detail: 'Contact not found' }, { status: 404 });
          })
        );

        // Act
        const deleteFn = await deleteAssistantContact(TEST_API_KEY);
        const result = await deleteFn('a1', 'whatsapp');

        // Assert
        expect(result).toHaveProperty('detail', 'Contact not found');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'DeleteContact-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/:id/contact`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const deleteFn = await deleteAssistantContact(TEST_API_KEY);
        const result = await deleteFn('a1', 'phone');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
