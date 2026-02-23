/**
 * Usage API Tests
 *
 * Tests for the usage API layer including server actions and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  getUsageMetrics,
  createUsageActions,
  isUsageError,
  getUsageMetricsWithRetry,
} from '@/lib/usage/api';
import { SAMPLE_WEEK_RESPONSE, SAMPLE_HOURLY_RESPONSE } from '@/tests/usage/mocks/data';

// Set up MSW server
const server = setupServer();

beforeAll(() => {
  // Set environment variable for tests
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('Usage API', () => {
  describe('getUsageMetrics', () => {
    it('returns metrics data on successful request', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const result = await getUsageMetrics(
        'test-api-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13' and event_timestamp < '2026-01-20'"
      );

      expect(isUsageError(result)).toBe(false);
      expect(result).toEqual(SAMPLE_WEEK_RESPONSE);
    });

    it('returns hourly data when groupBy is time_hour', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json(SAMPLE_HOURLY_RESPONSE);
        })
      );

      const result = await getUsageMetrics(
        'test-api-key',
        'test-user/All/Events/LLM',
        'time_hour',
        "event_timestamp >= '2026-01-19'"
      );

      expect(isUsageError(result)).toBe(false);
      expect(Object.keys(result).length).toBe(5);
    });

    it('returns error on 401 unauthorized', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json({ detail: 'Invalid API key' }, { status: 401 });
        })
      );

      const result = await getUsageMetrics(
        'invalid-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'"
      );

      expect(isUsageError(result)).toBe(true);
      if (isUsageError(result)) {
        expect(result.detail).toBe('Invalid API key');
      }
    });

    it('returns error on 403 forbidden', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json({ detail: 'Access denied' }, { status: 403 });
        })
      );

      const result = await getUsageMetrics(
        'test-api-key',
        'OtherUser/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'"
      );

      expect(isUsageError(result)).toBe(true);
      if (isUsageError(result)) {
        expect(result.detail).toBe('Access denied');
      }
    });

    it('returns error on 404 not found', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json({ detail: 'Context not found' }, { status: 404 });
        })
      );

      const result = await getUsageMetrics(
        'test-api-key',
        'NonExistent/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'"
      );

      expect(isUsageError(result)).toBe(true);
      if (isUsageError(result)) {
        expect(result.detail).toBe('Context not found');
      }
    });

    it('returns error on 500 server error', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json({ detail: 'Internal server error' }, { status: 500 });
        })
      );

      const result = await getUsageMetrics(
        'test-api-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'"
      );

      expect(isUsageError(result)).toBe(true);
    });

    it('returns empty object when no data', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json({});
        })
      );

      const result = await getUsageMetrics(
        'test-api-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'"
      );

      expect(isUsageError(result)).toBe(false);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('sends correct query parameters', async () => {
      let capturedUrl: URL | null = null;

      server.use(
        http.get('http://localhost:3000/api/logs/sum', ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      await getUsageMetrics(
        'test-api-key',
        'test-user/test-assistant/Events/LLM',
        'time_hour',
        "event_timestamp >= '2026-01-15'"
      );

      expect(capturedUrl).not.toBeNull();
      expect(capturedUrl!.searchParams.get('projectName')).toBe('Assistants');
      expect(capturedUrl!.searchParams.get('context')).toBe('test-user/test-assistant/Events/LLM');
      expect(capturedUrl!.searchParams.get('key')).toBe('billed_cost');
      expect(capturedUrl!.searchParams.get('groupBy')).toBe('time_hour');
      expect(capturedUrl!.searchParams.get('filterExpr')).toBe("event_timestamp >= '2026-01-15'");
    });

    it('sends API key in headers', async () => {
      let capturedApiKey: string | null = null;

      server.use(
        http.get('http://localhost:3000/api/logs/sum', ({ request }) => {
          capturedApiKey = request.headers.get('apiKey');
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      await getUsageMetrics(
        'my-secret-api-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'"
      );

      expect(capturedApiKey).toBe('my-secret-api-key');
    });
  });

  describe('createUsageActions', () => {
    it('creates bound actions with API key', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const actions = createUsageActions('test-api-key');

      const result = await actions.getMetrics(
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'"
      );

      expect(isUsageError(result)).toBe(false);
      expect(result).toEqual(SAMPLE_WEEK_RESPONSE);
    });
  });

  describe('isUsageError', () => {
    it('returns true for error objects', () => {
      expect(isUsageError({ detail: 'Error message' })).toBe(true);
    });

    it('returns false for success responses', () => {
      expect(isUsageError(SAMPLE_WEEK_RESPONSE)).toBe(false);
    });

    it('returns false for empty responses', () => {
      expect(isUsageError({})).toBe(false);
    });

    it('returns false for null', () => {
      expect(isUsageError(null as any)).toBe(false);
    });
  });

  describe('getUsageMetricsWithRetry', () => {
    it('returns data on first successful attempt', async () => {
      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const result = await getUsageMetricsWithRetry(
        'test-api-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'",
        2
      );

      expect(isUsageError(result)).toBe(false);
      expect(result).toEqual(SAMPLE_WEEK_RESPONSE);
    });

    it('retries on server error and succeeds', async () => {
      let attempts = 0;

      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          attempts++;
          if (attempts < 2) {
            return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
          }
          return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
        })
      );

      const result = await getUsageMetricsWithRetry(
        'test-api-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'",
        2
      );

      expect(attempts).toBe(2);
      expect(isUsageError(result)).toBe(false);
    });

    it('does not retry on 401 unauthorized', async () => {
      let attempts = 0;

      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          attempts++;
          return HttpResponse.json({ detail: '401 Invalid API key' }, { status: 401 });
        })
      );

      const result = await getUsageMetricsWithRetry(
        'invalid-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'",
        2
      );

      expect(attempts).toBe(1);
      expect(isUsageError(result)).toBe(true);
    });

    it('does not retry on 404 not found', async () => {
      let attempts = 0;

      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          attempts++;
          return HttpResponse.json({ detail: '404 Not found' }, { status: 404 });
        })
      );

      const result = await getUsageMetricsWithRetry(
        'test-api-key',
        'NonExistent/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'",
        2
      );

      expect(attempts).toBe(1);
      expect(isUsageError(result)).toBe(true);
    });

    it('returns error after max retries exceeded', async () => {
      let attempts = 0;

      server.use(
        http.get('http://localhost:3000/api/logs/sum', () => {
          attempts++;
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
        })
      );

      const result = await getUsageMetricsWithRetry(
        'test-api-key',
        'test-user/All/Events/LLM',
        'time_day',
        "event_timestamp >= '2026-01-13'",
        2
      );

      expect(attempts).toBe(3); // Initial + 2 retries
      expect(isUsageError(result)).toBe(true);
    });
  });
});
