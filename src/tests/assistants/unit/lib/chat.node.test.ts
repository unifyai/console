/**
 * Unit tests for src/lib/assistants/chat.ts
 *
 * Tests the server action factory functions for chat operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import {
  getContactIdByEmail,
  getTranscripts,
  messageAssistant,
  triggerContactSync,
} from '@/lib/assistants/chat';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';
vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
vi.stubEnv('ORCHESTRA_URL', 'https://orchestra.example.com');
vi.stubEnv('ORCHESTRA_ADMIN_KEY', 'admin-key-123');

describe('chat.ts', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('getContactIdByEmail', () => {
    it(
      'returns contact ID when contact exists',
      {
        meta: {
          alias: 'GetContactId-Success',
          scenario: 'Contact exists in database',
          behavior: 'Returns numeric contact ID',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [{ entries: { contactId: 5, emailAddress: 'user@example.com' } }],
            });
          })
        );

        // Act
        const getContactFn = await getContactIdByEmail(TEST_API_KEY);
        const result = await getContactFn('OwnerContext', 'AssistantContext', 'user@example.com');

        // Assert
        expect(result).toBe(5);
      }
    );

    it(
      'returns null when contact not found (404)',
      {
        meta: {
          alias: 'GetContactId-NotFound404',
          scenario: 'Contact table does not exist',
          behavior: 'Returns null',
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
        const getContactFn = await getContactIdByEmail(TEST_API_KEY);
        const result = await getContactFn(
          'OwnerContext',
          'AssistantContext',
          'unknown@example.com'
        );

        // Assert
        expect(result).toBeNull();
      }
    );

    it(
      'returns null when no matching contact found',
      {
        meta: {
          alias: 'GetContactId-EmptyResult',
          scenario: 'Query returns empty logs array',
          behavior: 'Returns null',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({ logs: [] });
          })
        );

        // Act
        const getContactFn = await getContactIdByEmail(TEST_API_KEY);
        const result = await getContactFn(
          'OwnerContext',
          'AssistantContext',
          'unknown@example.com'
        );

        // Assert
        expect(result).toBeNull();
      }
    );

    it(
      'returns null when contactId is not a number',
      {
        meta: {
          alias: 'GetContactId-InvalidType',
          scenario: 'Log entry has non-numeric contactId',
          behavior: 'Returns null',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [{ entries: { contactId: 'not-a-number', emailAddress: 'user@example.com' } }],
            });
          })
        );

        // Act
        const getContactFn = await getContactIdByEmail(TEST_API_KEY);
        const result = await getContactFn('OwnerContext', 'AssistantContext', 'user@example.com');

        // Assert
        expect(result).toBeNull();
      }
    );
  });

  describe('getTranscripts', () => {
    it(
      'returns array of chat messages on success',
      {
        meta: {
          alias: 'GetTranscripts-Success',
          scenario: 'API returns valid transcript logs',
          behavior: 'Returns mapped ChatMessage array',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [
                {
                  id: '100',
                  timestamp: '2024-01-01T12:00:00Z',
                  entries: { sender_id: 1, content: 'Hello!' },
                },
                {
                  id: '101',
                  timestamp: '2024-01-01T12:01:00Z',
                  entries: { sender_id: 0, content: 'Hi there!' },
                },
              ],
            });
          })
        );

        // Act
        const getTranscriptsFn = await getTranscripts(TEST_API_KEY);
        const result = await getTranscriptsFn('Owner', 'Assistant', 1);

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect((result as any[])[0]).toHaveProperty('role', 'user');
        expect((result as any[])[0]).toHaveProperty('content', 'Hello!');
        expect((result as any[])[1]).toHaveProperty('role', 'assistant');
      }
    );

    it(
      'maps sender_id 0 to assistant role',
      {
        meta: {
          alias: 'GetTranscripts-AssistantRole',
          scenario: 'Message has sender_id of 0',
          behavior: 'Role is mapped to "assistant"',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [
                {
                  id: '1',
                  timestamp: '2024-01-01T12:00:00Z',
                  entries: { sender_id: 0, content: 'I am the assistant' },
                },
              ],
            });
          })
        );

        // Act
        const getTranscriptsFn = await getTranscripts(TEST_API_KEY);
        const result = await getTranscriptsFn('Owner', 'Assistant', 1);

        // Assert
        expect((result as any[])[0].role).toBe('assistant');
      }
    );

    it(
      'maps non-zero sender_id to user role',
      {
        meta: {
          alias: 'GetTranscripts-UserRole',
          scenario: 'Message has non-zero sender_id',
          behavior: 'Role is mapped to "user"',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/logs`, () => {
            return HttpResponse.json({
              logs: [
                {
                  id: '1',
                  timestamp: '2024-01-01T12:00:00Z',
                  entries: { sender_id: 5, content: 'I am a user' },
                },
              ],
            });
          })
        );

        // Act
        const getTranscriptsFn = await getTranscripts(TEST_API_KEY);
        const result = await getTranscriptsFn('Owner', 'Assistant', 5);

        // Assert
        expect((result as any[])[0].role).toBe('user');
      }
    );

    it(
      'returns empty array when no transcripts exist (404)',
      {
        meta: {
          alias: 'GetTranscripts-Empty404',
          scenario: 'Transcript context does not exist',
          behavior: 'Returns empty array',
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
        const getTranscriptsFn = await getTranscripts(TEST_API_KEY);
        const result = await getTranscriptsFn('Owner', 'Assistant', 1);

        // Assert
        expect(result).toEqual([]);
      }
    );
  });

  describe('messageAssistant', () => {
    it(
      'sends message and returns success response',
      {
        meta: {
          alias: 'MessageAssistant-Success',
          scenario: 'Message is sent successfully',
          behavior: 'Returns response with info',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/message`, () => {
            return HttpResponse.json({ info: 'Message dispatched' });
          })
        );

        // Act
        const messageFn = await messageAssistant(TEST_API_KEY);
        const result = await messageFn({
          assistantId: 123,
          contactId: 1,
          message: 'Hello!',
        });

        // Assert
        expect(result).toHaveProperty('info', 'Message dispatched');
      }
    );

    it(
      'converts payload to snake_case',
      {
        meta: {
          alias: 'MessageAssistant-SnakeCase',
          scenario: 'Sending message with camelCase payload',
          behavior: 'Request body uses snake_case keys',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/message`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'OK' });
          })
        );

        // Act
        const messageFn = await messageAssistant(TEST_API_KEY);
        await messageFn({
          assistantId: 123,
          contactId: 1,
          message: 'Test',
        });

        // Assert
        expect(capturedBody).toHaveProperty('assistant_id', 123);
        expect(capturedBody).toHaveProperty('contact_id', 1);
      }
    );

    it(
      'returns error on failed message',
      {
        meta: {
          alias: 'MessageAssistant-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/message`, () => {
            return HttpResponse.json({ detail: 'Failed to queue message' }, { status: 500 });
          })
        );

        // Act
        const messageFn = await messageAssistant(TEST_API_KEY);
        const result = await messageFn({
          assistantId: 123,
          contactId: 1,
          message: 'Hello!',
        });

        // Assert
        expect(result).toHaveProperty('detail', 'Failed to queue message');
      }
    );
  });

  describe('triggerContactSync', () => {
    it(
      'sends sync request to adapters service',
      {
        meta: {
          alias: 'TriggerSync-Success',
          scenario: 'Sync request succeeds',
          behavior: 'Returns success info message',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.post(/unity-adapters.*\/unity\/system-event/, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({});
          })
        );

        // Act
        const triggerSyncFn = await triggerContactSync();
        const result = await triggerSyncFn('123');

        // Assert
        expect(result).toHaveProperty('info');
        expect(capturedUrl).toContain('unity-adapters');
      }
    );

    it(
      'returns error when webhook fails',
      {
        meta: {
          alias: 'TriggerSync-WebhookError',
          scenario: 'Adapters service returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(/unity-adapters.*\/unity\/system-event/, () => {
            return new HttpResponse('Service unavailable', { status: 500 });
          })
        );

        // Act
        const triggerSyncFn = await triggerContactSync();
        const result = await triggerSyncFn('123');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
