/**
 * Unit tests for src/lib/assistants/secret.ts
 *
 * Tests the server action factory functions for secret operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import { getSecrets, createSecret, deleteSecret } from '@/lib/assistants/secret';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('secret.ts', () => {
  const TEST_API_KEY = 'test-api-key';
  const USER_CONTEXT = 'user-123';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('getSecrets', () => {
    it(
      'returns array of secrets on success',
      {
        meta: {
          alias: 'GetSecrets-Success',
          scenario: 'API returns valid secrets list',
          behavior: 'Returns mapped Secret array',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [
                { id: '1', entries: { name: 'API_KEY', value: 'secret123' } },
                {
                  id: '2',
                  entries: { name: 'DB_PASSWORD', value: 'password', description: 'Database' },
                },
              ],
            });
          })
        );

        // Act
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_CONTEXT);
        const result = await getSecretsFn('assistant-ctx');

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect((result as any[])[0]).toHaveProperty('logId', 1);
        expect((result as any[])[0]).toHaveProperty('name', 'API_KEY');
        expect((result as any[])[1]).toHaveProperty('description', 'Database');
      }
    );

    it(
      'builds correct context path',
      {
        meta: {
          alias: 'GetSecrets-ContextPath',
          scenario: 'Verify URL contains correct context',
          behavior: 'URL includes userContext/assistantContext/Secrets',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ logs: [] });
          })
        );

        // Act
        const getSecretsFn = await getSecrets(TEST_API_KEY, 'user-ctx');
        await getSecretsFn('assistant-ctx');

        // Assert - URL may or may not be encoded depending on fetch implementation
        expect(capturedUrl).toContain('user-ctx/assistant-ctx/Secrets');
      }
    );

    it(
      'returns empty array when no secrets exist (404)',
      {
        meta: {
          alias: 'GetSecrets-Empty404',
          scenario: 'API returns 404',
          behavior: 'Returns empty array instead of error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
          })
        );

        // Act
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_CONTEXT);
        const result = await getSecretsFn('new-assistant');

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(0);
      }
    );

    it(
      'filters out logs with invalid structure',
      {
        meta: {
          alias: 'GetSecrets-FilterInvalid',
          scenario: 'API returns some invalid log entries',
          behavior: 'Filters out entries without required fields',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [
                { id: '1', entries: { name: 'VALID', value: 'secret' } },
                { id: '2', entries: { name: 'NO_VALUE' } }, // Missing value
                { id: 'invalid', entries: { name: 'BAD_ID', value: 'x' } }, // Non-numeric ID
                { id: '4', entries: {} }, // Missing both
              ],
            });
          })
        );

        // Act
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_CONTEXT);
        const result = await getSecretsFn('assistant-ctx');

        // Assert
        expect(result).toHaveLength(1);
        expect((result as any[])[0]).toHaveProperty('name', 'VALID');
      }
    );

    it(
      'returns error when API fails',
      {
        meta: {
          alias: 'GetSecrets-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ detail: 'Database error' }, { status: 500 });
          })
        );

        // Act
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_CONTEXT);
        const result = await getSecretsFn('assistant-ctx');

        // Assert
        expect(result).toHaveProperty('detail', 'Database error');
      }
    );
  });

  describe('createSecret', () => {
    it(
      'creates secret and returns success',
      {
        meta: {
          alias: 'CreateSecret-Success',
          scenario: 'API successfully creates secret',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ info: 'Log created' });
          })
        );

        // Act
        const createFn = await createSecret(TEST_API_KEY, USER_CONTEXT);
        const result = await createFn('assistant-ctx', {
          name: 'NEW_SECRET',
          value: 'secret-value',
        });

        // Assert
        expect(result).toHaveProperty('info', 'Secret created successfully.');
      }
    );

    it(
      'sends correct payload structure',
      {
        meta: {
          alias: 'CreateSecret-Payload',
          scenario: 'Verify request body structure',
          behavior: 'Request contains projectName, context, entries',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.post(`${MOCK_BASE_URL}/api/logs`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const createFn = await createSecret(TEST_API_KEY, 'user-ctx');
        await createFn('assistant-ctx', {
          name: 'API_KEY',
          value: 'secret123',
          description: 'My API key',
        });

        // Assert
        expect(capturedBody).toHaveProperty('projectName', 'Assistants');
        expect(capturedBody).toHaveProperty('context', 'user-ctx/assistant-ctx/Secrets');
        expect(capturedBody.entries).toHaveLength(1);
        expect(capturedBody.entries[0]).toHaveProperty('name', 'API_KEY');
        expect(capturedBody.entries[0]).toHaveProperty('value', 'secret123');
      }
    );

    it(
      'returns error when creation fails',
      {
        meta: {
          alias: 'CreateSecret-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ detail: 'Duplicate secret name' }, { status: 409 });
          })
        );

        // Act
        const createFn = await createSecret(TEST_API_KEY, USER_CONTEXT);
        const result = await createFn('assistant-ctx', {
          name: 'EXISTING',
          value: 'value',
        });

        // Assert
        expect(result).toHaveProperty('detail', 'Duplicate secret name');
      }
    );
  });

  describe('deleteSecret', () => {
    it(
      'deletes secret and returns success',
      {
        meta: {
          alias: 'DeleteSecret-Success',
          scenario: 'API successfully deletes secret',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ info: 'Logs deleted' });
          })
        );

        // Act
        const deleteFn = await deleteSecret(TEST_API_KEY, USER_CONTEXT);
        const result = await deleteFn('assistant-ctx', 1);

        // Assert
        expect(result).toHaveProperty('info', 'Secret deleted successfully.');
      }
    );

    it(
      'sends correct payload with idsAndFields',
      {
        meta: {
          alias: 'DeleteSecret-Payload',
          scenario: 'Verify request body structure',
          behavior: 'Request contains logId in idsAndFields',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/logs`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const deleteFn = await deleteSecret(TEST_API_KEY, 'user-ctx');
        await deleteFn('assistant-ctx', 42);

        // Assert
        expect(capturedBody).toHaveProperty('projectName', 'Assistants');
        expect(capturedBody).toHaveProperty('context', 'user-ctx/assistant-ctx/Secrets');
        expect(capturedBody.idsAndFields).toEqual([[42, null]]);
      }
    );

    it(
      'returns error when deletion fails',
      {
        meta: {
          alias: 'DeleteSecret-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ detail: 'Secret not found' }, { status: 404 });
          })
        );

        // Act
        const deleteFn = await deleteSecret(TEST_API_KEY, USER_CONTEXT);
        const result = await deleteFn('assistant-ctx', 999);

        // Assert
        expect(result).toHaveProperty('detail', 'Secret not found');
      }
    );

    it(
      'handles empty response body gracefully',
      {
        meta: {
          alias: 'DeleteSecret-EmptyBody',
          scenario: 'API returns error with empty body',
          behavior: 'Uses statusText as error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/logs`, () => {
            return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
          })
        );

        // Act
        const deleteFn = await deleteSecret(TEST_API_KEY, USER_CONTEXT);
        const result = await deleteFn('assistant-ctx', 1);

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
