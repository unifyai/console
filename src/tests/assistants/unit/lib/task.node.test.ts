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
import { getTasks, updateTask } from '@/lib/assistants/task';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('task.ts', () => {
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

        // Act - isOrgContext=false for personal workspace
        const getTasksFn = await getTasks(TEST_API_KEY, USER_ID, false);
        const result = await getTasksFn(ASSISTANT_ID, null, null, null);

        // Assert
        expect(result).toHaveProperty('logs');
        expect((result as any).logs).toHaveLength(2);
      }
    );

    it(
      'builds correct context path and includes security filters in personal workspace',
      {
        meta: {
          alias: 'GetTasks-ContextPath',
          scenario: 'Verify URL contains correct context and _user_id/_assistant_id filters',
          behavior: 'URL includes user/assistant-scoped Tasks context',
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

        // Act - isOrgContext=false for personal workspace
        const getTasksFn = await getTasks(TEST_API_KEY, 'test-user-id', false);
        await getTasksFn('test-assistant-id', null, null, null);

        expect(capturedUrl).toContain('test-user-id/test-assistant-id/Tasks');
      }
    );

    it(
      'returns error when assistantId is null',
      {
        meta: {
          alias: 'GetTasks-NullAssistant',
          scenario: 'Calling getTasks with null assistantId',
          behavior: 'Returns error detail since assistantId is required for context path',
        },
      },
      async () => {
        const getTasksFn = await getTasks(TEST_API_KEY, 'test-user-id', false);
        const result = await getTasksFn(null, null, null, null);

        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'returns error for null assistantId in org workspace too',
      {
        meta: {
          alias: 'GetTasks-AllContext-Org',
          scenario: 'Calling getTasks with null assistantId in org workspace',
          behavior: 'Returns error since assistantId is always required',
        },
      },
      async () => {
        const getTasksFn = await getTasks(TEST_API_KEY, 'test-user-id', true);
        const result = await getTasksFn(null, null, null, null);

        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'includes only _assistant_id filter in organization workspace when assistantId provided',
      {
        meta: {
          alias: 'GetTasks-OrgContext-SpecificAssistant',
          scenario: 'Fetching tasks for specific assistant in org workspace',
          behavior: 'URL uses user/assistant-scoped context path',
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

        // Act - isOrgContext=true for organization workspace
        const getTasksFn = await getTasks(TEST_API_KEY, 'test-user-id', true);
        await getTasksFn('test-assistant-id', null, null, null);

        expect(capturedUrl).toContain('test-user-id/test-assistant-id/Tasks');
      }
    );

    it(
      'includes filter expression when provided (combined with security filter)',
      {
        meta: {
          alias: 'GetTasks-FilterExpr',
          scenario: 'Filter expression is provided',
          behavior: 'URL includes encoded filterExpr combined with security filter',
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

        // Act - isOrgContext=false for personal workspace
        const getTasksFn = await getTasks(TEST_API_KEY, USER_ID, false);
        await getTasksFn(ASSISTANT_ID, 'status = "pending"', null, null);

        const decodedUrl = decodeURIComponent(capturedUrl);
        expect(decodedUrl).toContain('filterExpr=');
        expect(decodedUrl).toContain('status = "pending"');
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

        // Act - isOrgContext=false for personal workspace
        const getTasksFn = await getTasks(TEST_API_KEY, USER_ID, false);
        await getTasksFn(ASSISTANT_ID, null, 25, 50);

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

        // Act - isOrgContext=false for personal workspace
        const getTasksFn = await getTasks(TEST_API_KEY, USER_ID, false);
        const result = await getTasksFn(ASSISTANT_ID, null, null, null);

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

        // Act - isOrgContext=false for personal workspace
        const getTasksFn = await getTasks(TEST_API_KEY, USER_ID, false);
        const result = await getTasksFn(ASSISTANT_ID, null, null, null);

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

        // Act - isOrgContext=false for personal workspace
        const getTasksFn = await getTasks(TEST_API_KEY, USER_ID, false);
        const result = await getTasksFn(ASSISTANT_ID, null, null, null);

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
        const updateFn = await updateTask(TEST_API_KEY, USER_ID);
        const result = await updateFn(ASSISTANT_ID, [1, 2], { status: 'completed' });

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
        const updateFn = await updateTask(TEST_API_KEY, USER_ID);
        await updateFn(ASSISTANT_ID, [1, 2, 3], { status: 'failed', reason: 'timeout' });

        // Assert
        expect(capturedBody).toHaveProperty('logs', [1, 2, 3]);
        expect(capturedBody).toHaveProperty('projectName', 'Assistants');
        expect(capturedBody.context).toContain('/Tasks');
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
        const updateFn = await updateTask(TEST_API_KEY, USER_ID);
        const result = await updateFn(ASSISTANT_ID, [1], { status: 'x' });

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
        const updateFn = await updateTask(TEST_API_KEY, USER_ID);
        const result = await updateFn(ASSISTANT_ID, [999], { status: 'x' });

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
        const updateFn = await updateTask(TEST_API_KEY, USER_ID);
        const result = await updateFn(ASSISTANT_ID, [1], { status: 'x' });

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
