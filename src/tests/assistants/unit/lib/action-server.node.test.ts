/**
 * Unit tests for src/lib/assistants/action.ts
 *
 * Tests the server action factory functions for fetching action events.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import { getManagerMethodEvents, getToolLoopEvents } from '@/lib/assistants/action';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('action.ts server actions', () => {
  const TEST_API_KEY = 'test-api-key';
  const TEST_ASSISTANT_ID = 'assistant-123';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('getManagerMethodEvents', () => {
    it(
      'returns logs response on success (paginated when limit=null)',
      {
        meta: {
          alias: 'GetManagerMethodEvents-Success',
          scenario: 'API returns valid events list within one page',
          behavior: 'Returns ActionsLogsResponse with all logs',
        },
      },
      async () => {
        // Arrange — count=1 fits in a single page so only one request
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [
                {
                  id: 1,
                  ts: '2024-01-15T10:30:00.000Z',
                  entries: { manager: 'ContactManager', method: 'ask' },
                },
              ],
              count: 1,
            });
          })
        );

        // Act
        const getEventsFn = await getManagerMethodEvents(TEST_API_KEY);
        const result = await getEventsFn(TEST_ASSISTANT_ID, null, null);

        // Assert
        expect(result).toHaveProperty('logs');
        expect((result as any).logs).toHaveLength(1);
      }
    );

    it(
      'paginates across multiple pages when limit=null and count > page size',
      {
        meta: {
          alias: 'GetManagerMethodEvents-Pagination',
          scenario: 'Total count exceeds page size, requiring multiple fetches',
          behavior: 'Accumulates logs from all pages',
        },
      },
      async () => {
        // Arrange — simulate 150 total logs (page size 100 → 2 requests)
        let callCount = 0;
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, ({ request }) => {
            callCount++;
            const url = new URL(request.url);
            const offset = parseInt(url.searchParams.get('offset') || '0', 10);

            if (offset === 0) {
              // First page: 100 logs
              const logs = Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                ts: '2024-01-15T10:30:00.000Z',
                entries: { manager: 'TestManager', method: 'run' },
              }));
              return HttpResponse.json({ logs, count: 150 });
            }
            // Second page: remaining 50 logs
            const logs = Array.from({ length: 50 }, (_, i) => ({
              id: 101 + i,
              ts: '2024-01-15T10:31:00.000Z',
              entries: { manager: 'TestManager', method: 'run' },
            }));
            return HttpResponse.json({ logs, count: 150 });
          })
        );

        // Act
        const getEventsFn = await getManagerMethodEvents(TEST_API_KEY);
        const result = await getEventsFn(TEST_ASSISTANT_ID, null, null);

        // Assert
        expect(result).toHaveProperty('logs');
        expect((result as any).logs).toHaveLength(150);
        expect((result as any).count).toBe(150);
        expect(callCount).toBe(2);
      }
    );

    it(
      'uses offset=0 and explicit limit for single-page fetch',
      {
        meta: {
          alias: 'GetManagerMethodEvents-ExplicitLimit',
          scenario: 'Explicit limit provided (e.g. loadMore)',
          behavior: 'Single fetch with the given limit and offset=0',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ logs: [], count: 0 });
          })
        );

        // Act
        const getEventsFn = await getManagerMethodEvents(TEST_API_KEY);
        await getEventsFn(TEST_ASSISTANT_ID, null, 50);

        // Assert
        expect(capturedUrl).toContain('limit=50');
        expect(capturedUrl).toContain('offset=0');
      }
    );

    it(
      'builds correct context path and includes security filter',
      {
        meta: {
          alias: 'GetManagerMethodEvents-ContextPath',
          scenario: 'Verify URL contains correct context and _assistant_id filter',
          behavior: 'URL includes All/Events/ManagerMethod with security filterExpr',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ logs: [], count: 0 });
          })
        );

        // Act
        const getEventsFn = await getManagerMethodEvents(TEST_API_KEY);
        await getEventsFn(TEST_ASSISTANT_ID, null, null);

        // Assert - URL should contain context path and security filter
        expect(capturedUrl).toContain('All/Events/ManagerMethod');
        const decodedUrl = decodeURIComponent(capturedUrl);
        expect(decodedUrl).toContain("_assistant_id == 'assistant-123'");
      }
    );

    it(
      'includes timestamp filter when startTime provided',
      {
        meta: {
          alias: 'GetManagerMethodEvents-TimestampFilter',
          scenario: 'startTime parameter is provided',
          behavior: 'URL includes timestamp filter',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ logs: [], count: 0 });
          })
        );

        // Act
        const getEventsFn = await getManagerMethodEvents(TEST_API_KEY);
        await getEventsFn(TEST_ASSISTANT_ID, '2024-01-15T10:00:00.000Z', null);

        // Assert
        const decodedUrl = decodeURIComponent(capturedUrl);
        expect(decodedUrl).toContain("event_timestamp >= '2024-01-15T10:00:00.000Z'");
      }
    );

    it(
      'returns error for non-JSON response',
      {
        meta: {
          alias: 'GetManagerMethodEvents-NonJSON',
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
        const getEventsFn = await getManagerMethodEvents(TEST_API_KEY);
        const result = await getEventsFn(TEST_ASSISTANT_ID, null, null);

        // Assert
        expect(result).toHaveProperty('detail');
        expect((result as any).detail).toContain('invalid response');
      }
    );

    it(
      'returns error when API fails',
      {
        meta: {
          alias: 'GetManagerMethodEvents-Error',
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
        const getEventsFn = await getManagerMethodEvents(TEST_API_KEY);
        const result = await getEventsFn(TEST_ASSISTANT_ID, null, null);

        // Assert
        expect(result).toHaveProperty('detail', 'Access denied');
      }
    );

    it(
      'returns error on network failure',
      {
        meta: {
          alias: 'GetManagerMethodEvents-NetworkError',
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
        const getEventsFn = await getManagerMethodEvents(TEST_API_KEY);
        const result = await getEventsFn(TEST_ASSISTANT_ID, null, null);

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('getToolLoopEvents', () => {
    it(
      'returns logs response on success (paginated when limit=null)',
      {
        meta: {
          alias: 'GetToolLoopEvents-Success',
          scenario: 'API returns valid tool loop events within one page',
          behavior: 'Returns ActionsLogsResponse',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [
                {
                  id: 1,
                  ts: '2024-01-15T10:30:00.000Z',
                  entries: { message: { role: 'assistant', content: 'Thinking...' } },
                },
              ],
              count: 1,
            });
          })
        );

        // Act
        const getEventsFn = await getToolLoopEvents(TEST_API_KEY);
        const result = await getEventsFn(TEST_ASSISTANT_ID, ['CodeActActor.act'], null);

        // Assert
        expect(result).toHaveProperty('logs');
        expect((result as any).logs).toHaveLength(1);
      }
    );

    it(
      'builds correct context path with hierarchy prefix filter',
      {
        meta: {
          alias: 'GetToolLoopEvents-ContextPath',
          scenario: 'Verify URL contains correct context and hierarchy filter',
          behavior:
            'URL includes All/Events/ToolLoop with hierarchy_label.startswith filter from joined hierarchy array',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ logs: [], count: 0 });
          })
        );

        // Act
        const getEventsFn = await getToolLoopEvents(TEST_API_KEY);
        await getEventsFn(TEST_ASSISTANT_ID, ['CodeActActor.act', 'ContactManager.ask'], null);

        // Assert - URL should contain context path and hierarchy filter
        expect(capturedUrl).toContain('All/Events/ToolLoop');
        const decodedUrl = decodeURIComponent(capturedUrl);
        expect(decodedUrl).toContain("_assistant_id == 'assistant-123'");
        expect(decodedUrl).toContain(
          "hierarchy_label.startswith('CodeActActor.act->ContactManager.ask')"
        );
      }
    );

    it(
      'uses offset=0 and explicit limit for single-page fetch',
      {
        meta: {
          alias: 'GetToolLoopEvents-ExplicitLimit',
          scenario: 'Explicit limit provided',
          behavior: 'Single fetch with the given limit',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ logs: [], count: 0 });
          })
        );

        // Act
        const getEventsFn = await getToolLoopEvents(TEST_API_KEY);
        await getEventsFn(TEST_ASSISTANT_ID, ['CodeActActor.act'], 20);

        // Assert
        expect(capturedUrl).toContain('limit=20');
        expect(capturedUrl).toContain('offset=0');
      }
    );

    it(
      'returns error when API fails',
      {
        meta: {
          alias: 'GetToolLoopEvents-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
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
        const getEventsFn = await getToolLoopEvents(TEST_API_KEY);
        const result = await getEventsFn(TEST_ASSISTANT_ID, ['CodeActActor.act'], null);

        // Assert
        expect(result).toHaveProperty('detail', 'Not found');
      }
    );
  });
});
