/**
 * Unit tests for src/lib/assistants/assistant.ts
 *
 * Tests the server action factory functions for assistant CRUD operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import {
  listAssistants,
  getAssistantStatus,
  deleteAssistant,
  updateAssistant,
  createAssistant,
  checkHiringFunds,
} from '@/lib/assistants/assistant';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';
const MOCK_ORCHESTRA_URL = 'https://orchestra.example.com';

describe('assistant.ts', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
    vi.stubEnv('ORCHESTRA_URL', MOCK_ORCHESTRA_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('listAssistants', () => {
    it(
      'returns array of assistants on successful response',
      {
        meta: {
          alias: 'ListAssistants-Success',
          scenario: 'API returns valid assistant list',
          behavior: 'Returns transformed camelCase assistants array',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant`, () => {
            return HttpResponse.json([
              { agent_id: '1', first_name: 'Jane', surname: 'Doe' },
              { agent_id: '2', first_name: 'John', surname: 'Smith' },
            ]);
          })
        );

        // Act
        const listFn = await listAssistants(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect((result as any[])[0]).toHaveProperty('agentId', '1');
        expect((result as any[])[0]).toHaveProperty('firstName', 'Jane');
      }
    );

    it(
      'handles nested info response structure',
      {
        meta: {
          alias: 'ListAssistants-NestedInfo',
          scenario: 'API returns data nested in info property',
          behavior: 'Extracts and transforms data from info wrapper',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant`, () => {
            return HttpResponse.json({ info: [{ agent_id: '1', first_name: 'Jane' }] });
          })
        );

        // Act
        const listFn = await listAssistants(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect((result as any[])[0]).toHaveProperty('agentId', '1');
      }
    );

    it(
      'adds list_all_org query param when listAllOrg is true',
      {
        meta: {
          alias: 'ListAssistants-OrgParam',
          scenario: 'listAllOrg flag is set to true',
          behavior: 'Appends list_all_org=true to URL',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json([]);
          })
        );

        // Act
        const listFn = await listAssistants(TEST_API_KEY, true);
        await listFn();

        // Assert
        expect(capturedUrl).toContain('list_all_org=true');
      }
    );

    it(
      'returns error object when response is not ok',
      {
        meta: {
          alias: 'ListAssistants-Error',
          scenario: 'API returns error response',
          behavior: 'Returns object with detail property',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant`, () => {
            return HttpResponse.json({ detail: 'Database connection failed' }, { status: 500 });
          })
        );

        // Act
        const listFn = await listAssistants(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail', 'Database connection failed');
        expect(result).toHaveProperty('status', 500);
      }
    );

    it(
      'returns error for non-JSON response',
      {
        meta: {
          alias: 'ListAssistants-NonJSON',
          scenario: 'API returns non-JSON content type',
          behavior: 'Returns error about invalid response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant`, () => {
            return new HttpResponse('<html>Error</html>', {
              headers: { 'Content-Type': 'text/html' },
            });
          })
        );

        // Act
        const listFn = await listAssistants(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail');
        expect((result as any).detail).toContain('invalid response');
      }
    );

    it(
      'returns error when fetch throws',
      {
        meta: {
          alias: 'ListAssistants-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Catches error and returns detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant`, () => {
            return HttpResponse.error();
          })
        );

        // Act
        const listFn = await listAssistants(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('getAssistantStatus', () => {
    it(
      'returns status object for existing assistant',
      {
        meta: {
          alias: 'GetStatus-Success',
          scenario: 'API returns valid status',
          behavior: 'Returns transformed status object',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant/:id/status`, () => {
            return HttpResponse.json({ running: true, last_active: '2024-01-01' });
          })
        );

        // Act
        const getStatusFn = await getAssistantStatus(TEST_API_KEY);
        const result = await getStatusFn('assistant-123');

        // Assert
        expect(result).toHaveProperty('running', true);
        expect(result).toHaveProperty('lastActive');
      }
    );

    it(
      'handles nested info response structure',
      {
        meta: {
          alias: 'GetStatus-NestedInfo',
          scenario: 'API returns status nested in info',
          behavior: 'Extracts status from info wrapper',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant/:id/status`, () => {
            return HttpResponse.json({ info: { running: false } });
          })
        );

        // Act
        const getStatusFn = await getAssistantStatus(TEST_API_KEY);
        const result = await getStatusFn('assistant-123');

        // Assert
        expect(result).toHaveProperty('running', false);
      }
    );

    it(
      'returns error for non-existent assistant',
      {
        meta: {
          alias: 'GetStatus-NotFound',
          scenario: 'API returns 404',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant/:id/status`, () => {
            return HttpResponse.json({ detail: 'Assistant not found' }, { status: 404 });
          })
        );

        // Act
        const getStatusFn = await getAssistantStatus(TEST_API_KEY);
        const result = await getStatusFn('nonexistent');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('deleteAssistant', () => {
    it(
      'returns success message on successful delete',
      {
        meta: {
          alias: 'DeleteAssistant-Success',
          scenario: 'API successfully deletes assistant',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        let capturedUrl = '';
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/:id`, ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json({ info: 'Deleted' });
          })
        );

        // Act
        const deleteFn = await deleteAssistant(TEST_API_KEY);
        const result = await deleteFn('assistant-123');

        // Assert
        expect(result).toHaveProperty('info');
        expect(capturedUrl).toContain('/api/assistant/assistant-123');
      }
    );

    it(
      'returns error for failed delete',
      {
        meta: {
          alias: 'DeleteAssistant-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/:id`, () => {
            return HttpResponse.json({ detail: 'Permission denied' }, { status: 403 });
          })
        );

        // Act
        const deleteFn = await deleteAssistant(TEST_API_KEY);
        const result = await deleteFn('assistant-123');

        // Assert
        expect(result).toHaveProperty('detail', 'Permission denied');
      }
    );
  });

  describe('updateAssistant', () => {
    it(
      'sends snake_case payload and returns success',
      {
        meta: {
          alias: 'UpdateAssistant-Success',
          scenario: 'API successfully updates assistant',
          behavior: 'Transforms payload to snake_case and returns info',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.patch(`${MOCK_BASE_URL}/api/assistant/:id`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'Updated successfully' });
          })
        );

        // Act
        const updateFn = await updateAssistant(TEST_API_KEY);
        const result = await updateFn('assistant-123', {
          weeklyLimit: 50,
          about: 'New bio',
        });

        // Assert
        expect(result).toHaveProperty('info');
        expect(capturedBody).toHaveProperty('weekly_limit', 50);
      }
    );

    it(
      'includes createInfra: true in payload',
      {
        meta: {
          alias: 'UpdateAssistant-CreateInfra',
          scenario: 'Update payload should include createInfra flag',
          behavior: 'Payload contains createInfra: true',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.patch(`${MOCK_BASE_URL}/api/assistant/:id`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'Updated' });
          })
        );

        // Act
        const updateFn = await updateAssistant(TEST_API_KEY);
        await updateFn('assistant-123', { about: 'test' });

        // Assert
        expect(capturedBody).toHaveProperty('createInfra', true);
      }
    );

    it(
      'returns error for failed update',
      {
        meta: {
          alias: 'UpdateAssistant-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.patch(`${MOCK_BASE_URL}/api/assistant/:id`, () => {
            return HttpResponse.json({ detail: 'Invalid weekly limit' }, { status: 400 });
          })
        );

        // Act
        const updateFn = await updateAssistant(TEST_API_KEY);
        const result = await updateFn('assistant-123', { weeklyLimit: -1 });

        // Assert
        expect(result).toHaveProperty('detail', 'Invalid weekly limit');
      }
    );
  });

  describe('createAssistant', () => {
    it(
      'creates assistant and returns success with assistant object',
      {
        meta: {
          alias: 'CreateAssistant-Success',
          scenario: 'API successfully creates assistant',
          behavior: 'Returns info message and transformed assistant',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant`, () => {
            return HttpResponse.json(
              {
                info: {
                  agent_id: 'new-123',
                  first_name: 'Jane',
                  surname: 'Doe',
                },
              },
              { status: 201 }
            );
          })
        );

        // Act
        const createFn = await createAssistant(TEST_API_KEY);
        const result = await createFn(
          'Jane',
          'Doe',
          30,
          'US',
          'UTC',
          'photo.jpg',
          null,
          'Bio text',
          'voice-1',
          'elevenlabs',
          'tts',
          false, // isUserDesktop
          null // desktopMode
        );

        // Assert
        expect(result).toHaveProperty('info');
        expect(result).toHaveProperty('assistant');
        expect((result as any).assistant).toHaveProperty('agentId', 'new-123');
        expect((result as any).assistant).toHaveProperty('firstName', 'Jane');
      }
    );

    it(
      'includes preHireChat in request when provided',
      {
        meta: {
          alias: 'CreateAssistant-WithPreHireChat',
          scenario: 'Creating assistant with pre-hire chat messages',
          behavior: 'Includes preHireChat array in request body',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: { agent_id: 'new-123' } }, { status: 201 });
          })
        );

        const preHireChat = [
          { role: 'user' as const, msg: 'Hello' },
          { role: 'assistant' as const, msg: 'Hi there!' },
        ];

        // Act
        const createFn = await createAssistant(TEST_API_KEY);
        await createFn(
          'Jane',
          'Doe',
          30,
          'US',
          'UTC',
          null,
          null,
          null,
          null,
          null,
          null,
          false, // isUserDesktop
          null, // desktopMode
          preHireChat
        );

        // Assert
        expect(capturedBody).toHaveProperty('preHireChat');
        expect(capturedBody.preHireChat).toHaveLength(2);
      }
    );

    it(
      'returns error for failed creation',
      {
        meta: {
          alias: 'CreateAssistant-Error',
          scenario: 'API returns error during creation',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant`, () => {
            return HttpResponse.json(
              { detail: 'Assistant with this name already exists' },
              { status: 409 }
            );
          })
        );

        // Act
        const createFn = await createAssistant(TEST_API_KEY);
        const result = await createFn(
          'Jane',
          'Doe',
          30,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          false, // isUserDesktop
          null // desktopMode
        );

        // Assert
        expect(result).toHaveProperty('detail');
        expect((result as any).detail).toContain('already exists');
      }
    );
  });

  describe('checkHiringFunds', () => {
    it(
      'returns sufficient: true when balance is adequate',
      {
        meta: {
          alias: 'CheckFunds-Sufficient',
          scenario: 'User has enough balance',
          behavior: 'Returns sufficient: true',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/billing/balance`, () => {
            return HttpResponse.json({ balance: '100.00', fullBalance: 100 });
          })
        );

        // Act
        const checkFn = await checkHiringFunds(TEST_API_KEY);
        const result = await checkFn(50);

        // Assert
        expect(result).toHaveProperty('sufficient', true);
      }
    );

    it(
      'returns sufficient: false when balance is insufficient',
      {
        meta: {
          alias: 'CheckFunds-Insufficient',
          scenario: 'User does not have enough balance',
          behavior: 'Returns sufficient: false',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/billing/balance`, () => {
            return HttpResponse.json({ balance: '10.00', fullBalance: 10 });
          })
        );

        // Act
        const checkFn = await checkHiringFunds(TEST_API_KEY);
        const result = await checkFn(50);

        // Assert
        expect(result).toHaveProperty('sufficient', false);
      }
    );

    it(
      'returns sufficient: true for staging environment',
      {
        meta: {
          alias: 'CheckFunds-Staging',
          scenario: 'Running in staging environment',
          behavior: 'Bypasses check and returns sufficient: true',
        },
      },
      async () => {
        // Arrange
        vi.stubEnv('ORCHESTRA_URL', 'https://staging.orchestra.example.com');

        // Act
        const checkFn = await checkHiringFunds(TEST_API_KEY);
        const result = await checkFn(50);

        // Assert
        expect(result).toHaveProperty('sufficient', true);
      }
    );

    it(
      'returns error when balance fetch fails',
      {
        meta: {
          alias: 'CheckFunds-FetchError',
          scenario: 'Balance API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/billing/balance`, () => {
            return HttpResponse.json({ detail: 'Unauthorized' }, { status: 500 });
          })
        );

        // Act
        const checkFn = await checkHiringFunds(TEST_API_KEY);
        const result = await checkFn(50);

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
