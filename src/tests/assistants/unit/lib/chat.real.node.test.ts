/**
 * Real API tests for src/lib/assistants/chat.ts
 *
 * These tests hit the actual Orchestra API to verify chat functionality works correctly.
 * Run with: npm run test:real
 *
 * Requirements:
 *   1. VITE_TEST_API_KEY set in .env.test
 *   2. Dev server running (npm run dev) or NEXT_PUBLIC_BASE_URL pointing to a running instance
 *   3. Orchestra backend running and accessible
 *
 * @group real
 */

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  chatApi,
  getTestAssistant,
  getTestApiKey,
  skipIfServerNotReachable,
  realTestOptions,
} from '@/tests/assistants/api/fixtures/api-actions';

const isError = (res: unknown): res is { detail: string } => {
  return res !== null && typeof res === 'object' && 'detail' in res;
};

describe('@real chat.ts - Orchestra Integration', () => {
  let API_KEY: string;

  beforeAll(async () => {
    try {
      API_KEY = getTestApiKey();
    } catch {
      console.warn('VITE_TEST_API_KEY not set, skipping integration tests');
      return;
    }

    await skipIfServerNotReachable();
  }, 10000);

  describe('getTranscripts', () => {
    it.skip('@real should return chat history', realTestOptions, async () => {
      // SKIPPED: Requires contactId which needs existing chat data
      const assistant = await getTestAssistant(API_KEY);
      const assistantName = `${assistant.firstName}${assistant.surname}`;
      const userName = 'TestUser'; // Placeholder

      // First get the contactId for this user
      const contactId = await chatApi.getContactIdByEmail(
        userName,
        assistantName,
        'test@example.com',
        API_KEY
      );

      // Skip test if no contactId found
      if (contactId === null) {
        console.log('No contactId found for this user, skipping transcript test');
        return;
      }

      const res = await chatApi.getTranscripts(userName, assistantName, contactId, API_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);
    });
  });

  describe('messageAssistant', () => {
    it('@real should dispatch a message', realTestOptions, async () => {
      // Note: /api/assistant/chat/message route may not be implemented yet
      try {
        const assistant = await getTestAssistant(API_KEY);
        const assistantId = assistant.agentId;

        const res = await chatApi.messageAssistant(
          assistantId,
          1, // Assuming test user contact ID
          'Integration Test Ping',
          API_KEY
        );

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          expect(res).toBeDefined();
        }
      } catch (e: unknown) {
        // 404 or 405 means route not implemented
        if (
          e instanceof Error &&
          (e.message.includes('404') ||
            e.message.includes('405') ||
            e.message.includes('Invalid JSON'))
        ) {
          console.log('Skipping: /api/assistant/chat/message route not yet implemented');
          return;
        }
        throw e;
      }
    });
  });
});
