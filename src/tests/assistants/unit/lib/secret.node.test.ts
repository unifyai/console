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
  const USER_ID = 'user-id-456';
  const ASSISTANT_ID = 'assistant-id-789';

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
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_ID);
        const result = await getSecretsFn(ASSISTANT_ID);

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect((result as any[])[0]).toHaveProperty('logId', 1);
        expect((result as any[])[0]).toHaveProperty('name', 'API_KEY');
        expect((result as any[])[1]).toHaveProperty('description', 'Database');
      }
    );

    it(
      'builds correct context path and includes security filters',
      {
        meta: {
          alias: 'GetSecrets-ContextPath',
          scenario: 'Verify URL contains correct context and _user_id/_assistant_id filters',
          behavior: 'URL includes All/Secrets context with security filterExpr',
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
        const getSecretsFn = await getSecrets(TEST_API_KEY, 'test-user-id');
        await getSecretsFn('test-assistant-id');

        // Assert - URL should contain All/Secrets context and security filters
        expect(capturedUrl).toContain('All/Secrets');
        // Check for security filter parameters (URL encoded)
        const decodedUrl = decodeURIComponent(capturedUrl);
        expect(decodedUrl).toContain("_user_id == 'test-user-id'");
        expect(decodedUrl).toContain("_assistant_id == 'test-assistant-id'");
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
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_ID);
        const result = await getSecretsFn(ASSISTANT_ID);

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
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_ID);
        const result = await getSecretsFn(ASSISTANT_ID);

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
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_ID);
        const result = await getSecretsFn(ASSISTANT_ID);

        // Assert
        expect(result).toHaveProperty('detail', 'Database error');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'GetSecrets-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const getSecretsFn = await getSecrets(TEST_API_KEY, USER_ID);
        const result = await getSecretsFn(ASSISTANT_ID);

        // Assert
        expect(result).toHaveProperty('detail');
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
        const createFn = await createSecret(TEST_API_KEY, USER_ID);
        const result = await createFn(ASSISTANT_ID, {
          name: 'NEW_SECRET',
          value: 'secret-value',
        });

        // Assert
        expect(result).toHaveProperty('info', 'Secret created successfully.');
      }
    );

    it(
      'sends correct payload structure with all private fields',
      {
        meta: {
          alias: 'CreateSecret-Payload',
          scenario: 'Verify request body structure includes all private fields like Unity',
          behavior:
            'Request contains projectName, context, entries with _user, _user_id, _assistant, _assistant_id',
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
        const createFn = await createSecret(TEST_API_KEY, 'test-user-id');
        await createFn('test-assistant-id', {
          name: 'API_KEY',
          value: 'secret123',
          description: 'My API key',
        });

        // Assert
        expect(capturedBody).toHaveProperty('projectName', 'Assistants');
        expect(capturedBody).toHaveProperty('context', 'All/Secrets');
        expect(capturedBody.entries).toHaveLength(1);
        expect(capturedBody.entries[0]).toHaveProperty('name', 'API_KEY');
        expect(capturedBody.entries[0]).toHaveProperty('value', 'secret123');
        // Verify all private fields are included (matching Unity's log_utils injection)
        // Note: These use Unity's underscore-prefixed naming convention (_user_id, _assistant_id)
        /* eslint-disable @typescript-eslint/naming-convention */
        expect(capturedBody.entries[0]).toHaveProperty('_user_id', 'test-user-id');
        expect(capturedBody.entries[0]).toHaveProperty('_assistant_id', 'test-assistant-id');
        /* eslint-enable @typescript-eslint/naming-convention */
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
        const createFn = await createSecret(TEST_API_KEY, USER_ID);
        const result = await createFn(ASSISTANT_ID, {
          name: 'EXISTING',
          value: 'value',
        });

        // Assert
        expect(result).toHaveProperty('detail', 'Duplicate secret name');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'CreateSecret-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const createFn = await createSecret(TEST_API_KEY, USER_ID);
        const result = await createFn(ASSISTANT_ID, {
          name: 'SECRET',
          value: 'value',
        });

        // Assert
        expect(result).toHaveProperty('detail');
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
        const deleteFn = await deleteSecret(TEST_API_KEY);
        const result = await deleteFn(1);

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
        const deleteFn = await deleteSecret(TEST_API_KEY);
        await deleteFn(42);

        // Assert
        expect(capturedBody).toHaveProperty('projectName', 'Assistants');
        expect(capturedBody).toHaveProperty('context', 'All/Secrets');
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
        const deleteFn = await deleteSecret(TEST_API_KEY);
        const result = await deleteFn(999);

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
        const deleteFn = await deleteSecret(TEST_API_KEY);
        const result = await deleteFn(1);

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'DeleteSecret-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const deleteFn = await deleteSecret(TEST_API_KEY);
        const result = await deleteFn(1);

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
