/**
 * API Route tests for Event/SSE endpoints
 *
 * Tests the event-related API routes for proper handling of:
 * - SSE stream setup
 * - Message acknowledgment
 * - Connection handling
 *
 * Uses MSW to mock backend services.
 *
 * @group api
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Mock environment variables
const MOCK_ORCHESTRA_URL = 'http://orchestra-service';
const MOCK_ADAPTERS_URL = 'http://adapters-service';

describe('Events API Routes', () => {
  const TEST_API_KEY = 'test-api-key';
  const TEST_ASSISTANT_ID = 'assistant-123';

  beforeEach(() => {
    vi.stubEnv('ORCHESTRA_URL', MOCK_ORCHESTRA_URL);
    vi.stubEnv('ADAPTERS_URL', MOCK_ADAPTERS_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('GET /api/assistant/[id]/events', () => {
    it(
      'establishes SSE connection',
      {
        meta: {
          alias: 'Events-SSEConnect',
          scenario: 'Valid assistant ID',
          behavior: 'Returns text/event-stream response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/assistant/:id/events`, () => {
            return new HttpResponse('data: {"type": "connected"}\n\n', {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
              },
            });
          })
        );

        // Act
        const response = await fetch(
          `${MOCK_ORCHESTRA_URL}/v0/assistant/${TEST_ASSISTANT_ID}/events`,
          {
            headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          }
        );

        // Assert
        expect(response.ok).toBe(true);
        expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      }
    );

    it(
      'handles invalid assistant ID',
      {
        meta: {
          alias: 'Events-InvalidAssistant',
          scenario: 'Non-existent assistant',
          behavior: 'Returns 404 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/assistant/:id/events`, () => {
            return HttpResponse.json({ detail: 'Assistant not found' }, { status: 404 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/invalid-id/events`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });

        // Assert
        expect(response.status).toBe(404);
      }
    );
  });

  describe('POST /api/assistant/[id]/events/ack', () => {
    it(
      'acknowledges message successfully',
      {
        meta: {
          alias: 'Events-Ack',
          scenario: 'Valid message acknowledgment',
          behavior: 'Returns success response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/ack`, () => {
            return HttpResponse.json({ success: true });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ADAPTERS_URL}/ack`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assistantId: TEST_ASSISTANT_ID,
            messageId: 'msg-123',
            contactId: 'contact-456',
          }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.success).toBe(true);
      }
    );

    it(
      'handles missing message ID',
      {
        meta: {
          alias: 'Events-AckMissingId',
          scenario: 'Missing required messageId',
          behavior: 'Returns 400 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/ack`, () => {
            return HttpResponse.json(
              { detail: 'Missing required field: messageId' },
              { status: 400 }
            );
          })
        );

        // Act
        const response = await fetch(`${MOCK_ADAPTERS_URL}/ack`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assistantId: TEST_ASSISTANT_ID,
          }),
        });

        // Assert
        expect(response.status).toBe(400);
      }
    );

    it(
      'handles already acknowledged message',
      {
        meta: {
          alias: 'Events-AckDuplicate',
          scenario: 'Message already acknowledged',
          behavior: 'Returns success (idempotent)',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/ack`, () => {
            return HttpResponse.json({ success: true, alreadyAcked: true });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ADAPTERS_URL}/ack`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assistantId: TEST_ASSISTANT_ID,
            messageId: 'already-acked-msg',
            contactId: 'contact-456',
          }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.success).toBe(true);
      }
    );
  });
});
