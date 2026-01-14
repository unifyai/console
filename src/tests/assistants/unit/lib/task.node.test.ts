/**
 * Unit tests for src/lib/assistants/task.ts
 *
 * Tests the server action factory functions for task operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import { getTasks, getUniqueFieldValues, updateTask } from '@/lib/assistants/task';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('task.ts', () => {
  const TEST_API_KEY = 'test-api-key';
  const USER_CONTEXT = 'user-123';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('getTasks', () => {
    it(
      'returns logs response on success',
      {
        meta: {
          alias: 'GetTasks-Success',
          scenario: 'API returns valid tasks list',
          behavior: 'Returns LogsResponseProps',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [
                { id: '1', entries: { status: 'pending', title: 'Task 1' } },
                { id: '2', entries: { status: 'completed', title: 'Task 2' } },
              ],
              total: 2,
            });
          })
        );

        // Act
        const getTasksFn = await getTasks(TEST_API_KEY, USER_CONTEXT);
        const result = await getTasksFn('assistant-ctx', null, null, null);

        // Assert
        expect(result).toHaveProperty('logs');
        expect((result as any).logs).toHaveLength(2);
      }
    );

    it(
      'builds correct context path',
      {
        meta: {
          alias: 'GetTasks-ContextPath',
          scenario: 'Verify URL contains correct context',
          behavior: 'URL includes userContext/assistantContext/Tasks',
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
        const getTasksFn = await getTasks(TEST_API_KEY, 'owner-ctx');
        await getTasksFn('agent-ctx', null, null, null);

        // Assert - URL may or may not be encoded depending on fetch implementation
        expect(capturedUrl).toContain('owner-ctx/agent-ctx/Tasks');
      }
    );

    it(
      'includes filter expression when provided',
      {
        meta: {
          alias: 'GetTasks-FilterExpr',
          scenario: 'Filter expression is provided',
          behavior: 'URL includes encoded filterExpr',
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
        const getTasksFn = await getTasks(TEST_API_KEY, USER_CONTEXT);
        await getTasksFn('assistant-ctx', 'status = "pending"', null, null);

        // Assert
        expect(capturedUrl).toContain('filterExpr=');
        expect(capturedUrl).toContain(encodeURIComponent('status = "pending"'));
      }
    );

    it(
      'includes limit and offset when provided',
      {
        meta: {
          alias: 'GetTasks-Pagination',
          scenario: 'Limit and offset are provided',
          behavior: 'URL includes limit and offset params',
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
        const getTasksFn = await getTasks(TEST_API_KEY, USER_CONTEXT);
        await getTasksFn('assistant-ctx', null, 25, 50);

        // Assert
        expect(capturedUrl).toContain('limit=25');
        expect(capturedUrl).toContain('offset=50');
      }
    );

    it(
      'returns error for non-JSON response',
      {
        meta: {
          alias: 'GetTasks-NonJSON',
          scenario: 'API returns non-JSON content',
          behavior: 'Returns error about invalid response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return new HttpResponse('<html>Error</html>', {
              headers: { 'Content-Type': 'text/html' },
            });
          })
        );

        // Act
        const getTasksFn = await getTasks(TEST_API_KEY, USER_CONTEXT);
        const result = await getTasksFn('assistant-ctx', null, null, null);

        // Assert
        expect(result).toHaveProperty('detail');
        expect((result as any).detail).toContain('invalid response');
      }
    );

    it(
      'returns error when API fails',
      {
        meta: {
          alias: 'GetTasks-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ detail: 'Access denied' }, { status: 403 });
          })
        );

        // Act
        const getTasksFn = await getTasks(TEST_API_KEY, USER_CONTEXT);
        const result = await getTasksFn('assistant-ctx', null, null, null);

        // Assert
        expect(result).toHaveProperty('detail', 'Access denied');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'GetTasks-NetworkError',
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
        const getTasksFn = await getTasks(TEST_API_KEY, USER_CONTEXT);
        const result = await getTasksFn('assistant-ctx', null, null, null);

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('getUniqueFieldValues', () => {
    it(
      'returns unique values for grouped field',
      {
        meta: {
          alias: 'GetUniqueValues-Success',
          scenario: 'API returns grouped data',
          behavior: 'Returns array of unique field values',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: {
                status: {
                  group: [
                    { key: 'pending', value: 5 },
                    { key: 'completed', value: 10 },
                    { key: 'failed', value: 2 },
                  ],
                  groupCount: 3,
                  count: 17,
                },
              },
            });
          })
        );

        // Act
        const getValuesFn = await getUniqueFieldValues(TEST_API_KEY, USER_CONTEXT);
        const result = await getValuesFn('assistant-ctx', 'status');

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toContain('pending');
        expect(result).toContain('completed');
        expect(result).toContain('failed');
      }
    );

    it(
      'includes groupBy and groupDepth params',
      {
        meta: {
          alias: 'GetUniqueValues-Params',
          scenario: 'Verify URL contains grouping params',
          behavior: 'URL includes groupBy and groupDepth=0',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({
              logs: { priority: { group: [], groupCount: 0, count: 0 } },
            });
          })
        );

        // Act
        const getValuesFn = await getUniqueFieldValues(TEST_API_KEY, USER_CONTEXT);
        await getValuesFn('assistant-ctx', 'priority');

        // Assert
        expect(capturedUrl).toContain('groupBy=priority');
        expect(capturedUrl).toContain('groupDepth=0');
      }
    );

    it(
      'returns empty array when no groups exist',
      {
        meta: {
          alias: 'GetUniqueValues-Empty',
          scenario: 'API returns empty group data',
          behavior: 'Returns empty array',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: { status: { group: [], groupCount: 0, count: 0 } },
            });
          })
        );

        // Act
        const getValuesFn = await getUniqueFieldValues(TEST_API_KEY, USER_CONTEXT);
        const result = await getValuesFn('assistant-ctx', 'status');

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(0);
      }
    );

    it(
      'filters out null/undefined keys',
      {
        meta: {
          alias: 'GetUniqueValues-FilterNulls',
          scenario: 'API returns groups with null keys',
          behavior: 'Filters out null/undefined values',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: {
                category: {
                  group: [
                    { key: 'valid', value: 5 },
                    { key: null, value: 3 },
                    { key: undefined, value: 2 },
                  ],
                  groupCount: 3,
                  count: 10,
                },
              },
            });
          })
        );

        // Act
        const getValuesFn = await getUniqueFieldValues(TEST_API_KEY, USER_CONTEXT);
        const result = await getValuesFn('assistant-ctx', 'category');

        // Assert
        expect(result).toEqual(['valid']);
      }
    );

    it(
      'returns error when API fails',
      {
        meta: {
          alias: 'GetUniqueValues-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ detail: 'Invalid field' }, { status: 400 });
          })
        );

        // Act
        const getValuesFn = await getUniqueFieldValues(TEST_API_KEY, USER_CONTEXT);
        const result = await getValuesFn('assistant-ctx', 'invalid_field');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'GetUniqueValues-NetworkError',
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
        const getValuesFn = await getUniqueFieldValues(TEST_API_KEY, USER_CONTEXT);
        const result = await getValuesFn('assistant-ctx', 'status');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('updateTask', () => {
    it(
      'updates task and returns success',
      {
        meta: {
          alias: 'UpdateTask-Success',
          scenario: 'API successfully updates task',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.put(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ info: 'Logs updated' });
          })
        );

        // Act
        const updateFn = await updateTask(TEST_API_KEY, USER_CONTEXT);
        const result = await updateFn('assistant-ctx', [1, 2], { status: 'completed' });

        // Assert
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'sends correct payload structure',
      {
        meta: {
          alias: 'UpdateTask-Payload',
          scenario: 'Verify request body structure',
          behavior: 'Request contains logs array, projectName, context, entries',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.put(`${MOCK_BASE_URL}/api/logs`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const updateFn = await updateTask(TEST_API_KEY, 'owner-ctx');
        await updateFn('agent-ctx', [1, 2, 3], { status: 'failed', reason: 'timeout' });

        // Assert
        expect(capturedBody).toHaveProperty('logs', [1, 2, 3]);
        expect(capturedBody).toHaveProperty('projectName', 'Assistants');
        expect(capturedBody).toHaveProperty('context', 'owner-ctx/agent-ctx/Tasks');
        expect(capturedBody.entries).toHaveProperty('status', 'failed');
        expect(capturedBody.entries).toHaveProperty('reason', 'timeout');
        expect(capturedBody).toHaveProperty('overwrite', true);
      }
    );

    it(
      'returns error for non-JSON response',
      {
        meta: {
          alias: 'UpdateTask-NonJSON',
          scenario: 'API returns non-JSON content',
          behavior: 'Returns error about invalid response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.put(`${MOCK_BASE_URL}/api/logs`, () => {
            return new HttpResponse('<html>Error</html>', {
              headers: { 'Content-Type': 'text/html' },
            });
          })
        );

        // Act
        const updateFn = await updateTask(TEST_API_KEY, USER_CONTEXT);
        const result = await updateFn('assistant-ctx', [1], { status: 'x' });

        // Assert
        expect(result).toHaveProperty('detail');
        expect((result as any).detail).toContain('invalid response');
      }
    );

    it(
      'returns error when update fails',
      {
        meta: {
          alias: 'UpdateTask-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.put(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ detail: 'Tasks not found' }, { status: 404 });
          })
        );

        // Act
        const updateFn = await updateTask(TEST_API_KEY, USER_CONTEXT);
        const result = await updateFn('assistant-ctx', [999], { status: 'x' });

        // Assert
        expect(result).toHaveProperty('detail', 'Tasks not found');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'UpdateTask-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.put(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const updateFn = await updateTask(TEST_API_KEY, USER_CONTEXT);
        const result = await updateFn('assistant-ctx', [1], { status: 'x' });

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
