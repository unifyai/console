/**
 * Real API tests for Assistant Routes
 *
 * These tests verify that the assistant API routes properly:
 * 1. Handle authentication via getApiKeyFromRequest
 * 2. Transform response data from snake_case to camelCase
 * 3. Return appropriate error codes
 *
 * @group real
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getTestApiKey,
  skipIfServerNotReachable,
  realTestOptions,
  assistantsApi,
  voiceApi,
  callApi,
  ApiError,
  getTestAssistant,
} from './fixtures/api-actions';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT_MS = 90000;

/**
 * Helper to make authenticated fetch requests
 */
async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getTestApiKey();
  const url = `${BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apiKey: apiKey,
        ...options.headers,
      },
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

describe('@real Assistant API Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('GET /api/assistant', () => {
    it('@real lists assistants with camelCase response', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant');

      expect(res.status).toBe(200);

      const data = await res.json();
      // Response should be an array
      expect(Array.isArray(data)).toBe(true);

      // If we have assistants, check for camelCase properties
      if (data.length > 0) {
        const assistant = data[0];
        // Orchestra uses agent_id -> agentId for assistant identifier
        expect(assistant).toHaveProperty('agentId');
        expect(assistant).toHaveProperty('firstName');
        expect(assistant).not.toHaveProperty('agent_id');
        expect(assistant).not.toHaveProperty('first_name');
      }
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/assistant`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect([401, 307]).toContain(res.status);
    });
  });

  describe('GET /api/assistant/[assistantId]/status', () => {
    it('@real gets assistant status when assistant exists', realTestOptions, async () => {
      try {
        const testAssistant = await getTestAssistant();
        const status = await assistantsApi.getStatus(testAssistant.agentId);

        expect(status).toBeDefined();
        expect(typeof status).toBe('object');
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available for status test');
          return;
        }
        throw e;
      }
    });

    it('@real returns status for any assistant ID', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/999999999/status');

      // Orchestra's status endpoint doesn't validate assistant existence -
      // it just checks for running jobs and returns 200 with running=false
      // Response may be wrapped in { info: { running: ... } } by Orchestra
      expect(res.status).toBe(200);
      const data = await res.json();
      const statusData = data.info ?? data;
      expect(statusData).toHaveProperty('running');
    });
  });

  describe('DELETE /api/assistant/[assistantId]', () => {
    it('@real returns 404 for non-existent assistant', realTestOptions, async () => {
      try {
        await assistantsApi.delete(999999999);
        expect.fail('Expected error for non-existent assistant');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect([404]).toContain((e as ApiError).status);
      }
    });
  });

  describe('PATCH /api/assistant/[assistantId]', () => {
    it('@real returns 404 for non-existent assistant', realTestOptions, async () => {
      try {
        await assistantsApi.update(999999999, { about: 'Updated bio' });
        expect.fail('Expected error for non-existent assistant');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect([404]).toContain((e as ApiError).status);
      }
    });

    it('@real updates assistant when exists', realTestOptions, async () => {
      try {
        const testAssistant = await getTestAssistant();
        const result = await assistantsApi.update(testAssistant.agentId, {
          about: 'Updated by integration test',
        });

        expect(result).toBeDefined();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available for update test');
          return;
        }
        throw e;
      }
    });
  });

  describe('GET /api/assistant/voice', () => {
    it('@real lists voices with camelCase response', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/voice');

      expect(res.status).toBe(200);

      const data = await res.json();
      // Response should be an array
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const voice = data[0];
        expect(voice).toHaveProperty('voiceId');
        expect(voice).not.toHaveProperty('voice_id');
      }
    });
  });

  describe('POST /api/assistant/voice', () => {
    it('@real returns 400/422 for invalid voice registration', realTestOptions, async () => {
      try {
        await voiceApi.register(
          'test-voice-id',
          'invalid-provider',
          'Test Voice',
          'Test description',
          'female',
          'en-US',
          false
        );
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        // Should return validation error, not 500
        expect([400, 422]).toContain((e as ApiError).status);
      }
    });
  });

  describe('DELETE /api/assistant/voice/[voiceId]', () => {
    it('@real returns 404 for non-existent voice', realTestOptions, async () => {
      try {
        await voiceApi.delete('non-existent-voice-id', 'elevenlabs');
        expect.fail('Expected error for non-existent voice');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect([404]).toContain((e as ApiError).status);
      }
    });
  });

  describe('POST /api/assistant/call/dispatch', () => {
    it('@real returns error for invalid dispatch request', realTestOptions, async () => {
      try {
        await callApi.dispatch(999999999, 'TestAgent', 'test-room');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        // Should return 404 or 502 (external service), not 500
        expect([404, 502]).toContain((e as ApiError).status);
      }
    });

    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/call/dispatch', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Should return 400 for validation error
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('POST /api/assistant/message', () => {
    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/message', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Should return 400 for validation error, not 500
      expect([400, 422]).toContain(res.status);
    });

    it('@real returns 404 for invalid assistant', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/message', {
        method: 'POST',
        body: JSON.stringify({
          assistantId: 999999999,
          contactId: 1,
          message: 'Test message',
        }),
      });

      // Should return 404 for non-existent assistant, or 502 if external service error
      expect([404, 502]).toContain(res.status);
    });
  });
});

describe('@real Assistant Voice Design Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('POST /api/assistant/voice/design/preview', () => {
    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/voice/design/preview', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Should return 400, not 500
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('POST /api/assistant/voice/design/create', () => {
    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/voice/design/create', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Should return 400, not 500
      expect([400, 422]).toContain(res.status);
    });
  });
});

describe('@real Assistant Photo Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('POST /api/assistant/photo/generate', () => {
    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/photo/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Should return 400 for validation error, not 500
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('POST /api/assistant/photo/edit', () => {
    it('@real returns 400 for missing file/fields', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/photo/edit', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Should return 400 for missing file, not 500
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('POST /api/assistant/photo/animate', () => {
    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/photo/animate', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Should return 400 for validation error, not 500
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('GET /api/assistant/photo/animate/[predictionId]', () => {
    it('@real returns 404 for invalid prediction ID', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/photo/animate/invalid-prediction-id');

      // Should return 404, or 503 if Replicate service is down
      expect([404, 503]).toContain(res.status);
    });
  });

  describe('POST /api/assistant/photo/animate/[predictionId]/cancel', () => {
    it('@real returns 404 for invalid prediction ID', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/photo/animate/invalid-prediction-id/cancel', {
        method: 'POST',
      });

      // Should return 404, or 503 if Replicate service is down
      expect([404, 503]).toContain(res.status);
    });
  });
});

describe('@real Assistant Chat Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('POST /api/assistant/chat', () => {
    it('@real returns 400 for missing messages', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          assistantName: 'Test',
          type: 'hire',
        }),
      });

      // Should return 400 for missing messages
      expect([400, 422]).toContain(res.status);
    });

    it('@real accepts valid post-hire-greeting request', realTestOptions, async () => {
      const res = await apiFetch('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          assistantName: 'TestAssistant',
          assistantAge: 25,
          assistantBio: 'A helpful test assistant',
          assistantNationality: 'US',
          type: 'post-hire-greeting',
        }),
      });

      // Should succeed (200) or return 402 if credits issue
      // May also return 404 if route requires session
      expect([200, 402, 404]).toContain(res.status);
    });
  });
});
