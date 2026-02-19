/**
 * Unit tests for src/lib/assistants/call.ts
 *
 * Tests the server action factory functions for call operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Mock React's cache function before importing call.ts (which imports user.ts that uses cache)
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    cache: (fn: any) => fn, // cache is just a pass-through in tests
  };
});

import { dispatchAssistantToCall } from '@/lib/assistants/call';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('call.ts', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  // Note: getCallConnectionDetails uses LiveKit SDK directly and requires mocking
  // the SDK itself, not HTTP calls. Those tests would be more complex and are
  // covered by integration tests.

  describe('dispatchAssistantToCall', () => {
    it(
      'dispatches assistant and returns success response',
      {
        meta: {
          alias: 'DispatchCall-Success',
          scenario: 'API successfully dispatches assistant to call',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, () => {
            return HttpResponse.json({ info: 'Assistant dispatched to call' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(result).toHaveProperty('info', 'Assistant dispatched to call');
      }
    );

    it(
      'sends correct payload to dispatch endpoint',
      {
        meta: {
          alias: 'DispatchCall-Payload',
          scenario: 'Verify request body structure',
          behavior: 'Request contains assistantId and roomName',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(capturedBody).toEqual({
          assistantId: 'assistant-123',
          roomName: 'room-abc',
        });
      }
    );

    it(
      'includes apiKey in request headers',
      {
        meta: {
          alias: 'DispatchCall-ApiKey',
          scenario: 'Verify authorization header',
          behavior: 'Request includes apiKey header',
        },
      },
      async () => {
        // Arrange
        let capturedApiKey = '';
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, ({ request }) => {
            capturedApiKey = request.headers.get('apiKey') || '';
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(capturedApiKey).toBe(TEST_API_KEY);
      }
    );

    it(
      'returns error when dispatch fails',
      {
        meta: {
          alias: 'DispatchCall-Error',
          scenario: 'API returns error response',
          behavior: 'Returns error detail from API',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, () => {
            return HttpResponse.json({ detail: 'Room not found' }, { status: 404 });
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(result).toHaveProperty('detail', 'Room not found');
      }
    );

    it(
      'returns error when network fails',
      {
        meta: {
          alias: 'DispatchCall-NetworkError',
          scenario: 'Network error during dispatch',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/call/dispatch`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const dispatchFn = await dispatchAssistantToCall(TEST_API_KEY);
        const result = await dispatchFn('assistant-123', 'room-abc');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
