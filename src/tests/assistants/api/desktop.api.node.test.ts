/**
 * API Route tests for Desktop proxy endpoints
 *
 * Tests the desktop-related API routes for proper handling of:
 * - Proxy forwarding to desktop agents
 * - Liveview URL retrieval
 * - System event sending
 * - Error handling for unreachable desktops
 *
 * Uses MSW to mock backend services.
 *
 * @group api
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Mock environment variables
const MOCK_ADAPTERS_URL = 'http://adapters-service';

describe('Desktop API Routes', () => {
  const TEST_API_KEY = 'test-api-key';
  const TEST_ASSISTANT_ID = 'assistant-123';

  beforeEach(() => {
    vi.stubEnv('ADAPTERS_URL', MOCK_ADAPTERS_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('GET /api/assistant/desktop/liveview', () => {
    it(
      'returns liveview URL for active desktop',
      {
        meta: {
          alias: 'Desktop-LiveviewURL',
          scenario: 'Desktop is active and reachable',
          behavior: 'Returns liveview URL',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ADAPTERS_URL}/desktop/:id/liveview`, () => {
            return HttpResponse.json({
              liveviewUrl: 'https://liveview.example.com/session-123',
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/liveview`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.liveviewUrl).toContain('https://liveview.example.com');
      }
    );

    it(
      'handles desktop not available',
      {
        meta: {
          alias: 'Desktop-NotAvailable',
          scenario: 'Desktop agent is offline',
          behavior: 'Returns 503 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ADAPTERS_URL}/desktop/:id/liveview`, () => {
            return HttpResponse.json({ detail: 'Desktop agent is not available' }, { status: 503 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/liveview`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });

        // Assert
        expect(response.status).toBe(503);
      }
    );

    it(
      'handles assistant without desktop',
      {
        meta: {
          alias: 'Desktop-NoDesktop',
          scenario: 'Assistant has no desktop configured',
          behavior: 'Returns 404 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ADAPTERS_URL}/desktop/:id/liveview`, () => {
            return HttpResponse.json(
              { detail: 'No desktop configured for this assistant' },
              { status: 404 }
            );
          })
        );

        // Act
        const response = await fetch(`${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/liveview`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });

        // Assert
        expect(response.status).toBe(404);
      }
    );
  });

  describe('POST /api/assistant/desktop/system-event', () => {
    it(
      'sends user remote control started event',
      {
        meta: {
          alias: 'Desktop-SystemEvent',
          scenario: 'Valid system event',
          behavior: 'Returns success response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/desktop/:id/system-event`, () => {
            return HttpResponse.json({ success: true });
          })
        );

        // Act
        const response = await fetch(
          `${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/system-event`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TEST_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventType: 'user_remote_control_started',
              message: 'User took remote control of assistant desktop',
            }),
          }
        );
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.success).toBe(true);
      }
    );

    it(
      'sends user remote control stopped event',
      {
        meta: {
          alias: 'Desktop-ResumeActor',
          scenario: 'User releases remote control event',
          behavior: 'Returns success response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/desktop/:id/system-event`, () => {
            return HttpResponse.json({ success: true });
          })
        );

        // Act
        const response = await fetch(
          `${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/system-event`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TEST_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventType: 'user_remote_control_stopped',
              message: 'User released remote control of assistant desktop',
            }),
          }
        );
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.success).toBe(true);
      }
    );

    it(
      'handles desktop connection timeout',
      {
        meta: {
          alias: 'Desktop-Timeout',
          scenario: 'Desktop agent times out',
          behavior: 'Returns 504 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/desktop/:id/system-event`, () => {
            return HttpResponse.json(
              { detail: 'Desktop agent connection timed out' },
              { status: 504 }
            );
          })
        );

        // Act
        const response = await fetch(
          `${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/system-event`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TEST_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventType: 'user_remote_control_started',
              message: 'User took remote control of assistant desktop',
            }),
          }
        );

        // Assert
        expect(response.status).toBe(504);
      }
    );

    it(
      'handles invalid event type',
      {
        meta: {
          alias: 'Desktop-InvalidEventType',
          scenario: 'Unknown event type',
          behavior: 'Returns 400 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/desktop/:id/system-event`, () => {
            return HttpResponse.json(
              { detail: 'Invalid event type: unknown_event' },
              { status: 400 }
            );
          })
        );

        // Act
        const response = await fetch(
          `${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/system-event`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TEST_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventType: 'unknown_event',
              message: 'test',
            }),
          }
        );

        // Assert
        expect(response.status).toBe(400);
      }
    );
  });

  describe('POST /api/assistant/desktop/proxy/*', () => {
    it(
      'forwards request to desktop agent',
      {
        meta: {
          alias: 'Desktop-ProxyForward',
          scenario: 'Valid proxy request',
          behavior: 'Forwards to desktop and returns response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/desktop/:id/proxy/*`, () => {
            return HttpResponse.json({
              result: 'command executed',
            });
          })
        );

        // Act
        const response = await fetch(
          `${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/proxy/execute`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TEST_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              command: 'open_browser',
              args: { url: 'https://example.com' },
            }),
          }
        );
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.result).toBe('command executed');
      }
    );

    it(
      'handles proxy error',
      {
        meta: {
          alias: 'Desktop-ProxyError',
          scenario: 'Desktop agent returns error',
          behavior: 'Returns error response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ADAPTERS_URL}/desktop/:id/proxy/*`, () => {
            return HttpResponse.json({ detail: 'Command execution failed' }, { status: 500 });
          })
        );

        // Act
        const response = await fetch(
          `${MOCK_ADAPTERS_URL}/desktop/${TEST_ASSISTANT_ID}/proxy/execute`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TEST_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              command: 'invalid_command',
            }),
          }
        );

        // Assert
        expect(response.status).toBe(500);
      }
    );
  });
});
