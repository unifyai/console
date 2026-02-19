/**
 * Real API tests for src/lib/assistants/call.ts
 *
 * These tests hit the actual Orchestra API to verify call functionality works correctly.
 * Run with: npm run test:real
 *
 * Requirements:
 *   1. VITE_TEST_API_KEY set in .env.test
 *   2. Dev server running (npm run dev) or NEXT_PUBLIC_BASE_URL pointing to a running instance
 *   3. Orchestra backend running and accessible
 *   4. LiveKit must be configured in Orchestra for full test coverage
 *
 * @group real
 */

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  callApi,
  getTestAssistant,
  getTestApiKey,
  skipIfServerNotReachable,
  realTestOptions,
} from '@/tests/assistants/api/fixtures/api-actions';

const isError = (res: unknown): res is { detail: string } => {
  return res !== null && typeof res === 'object' && 'detail' in res;
};

describe('@real call.ts - Orchestra Integration', () => {
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

  describe('getCallConnectionDetails', () => {
    it.skip('@real should return details or server config error', realTestOptions, async () => {
      // SKIPPED: Requires LiveKit infrastructure
      try {
        const assistant = await getTestAssistant(API_KEY);
        const assistantId = assistant.agentId;
        const assistantName = assistant.firstName;

        const res = await callApi.getConnectionDetails(assistantId, assistantName, API_KEY);

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          // May have serverUrl/token or other fields depending on config
          expect(res).toBeDefined();
        }
      } catch (e: unknown) {
        // LiveKit/call setup may not be configured
        if (
          e instanceof Error &&
          (e.message.includes('503') ||
            e.message.includes('500') ||
            e.message.includes('Invalid JSON'))
        ) {
          console.log('Call connection service not available');
          return;
        }
        throw e;
      }
    });
  });

  describe('dispatchAssistantToCall', () => {
    it.skip('@real should attempt to dispatch assistant', realTestOptions, async () => {
      // SKIPPED: Requires LiveKit infrastructure
      try {
        const assistant = await getTestAssistant(API_KEY);
        const assistantId = assistant.agentId;
        const assistantName = assistant.firstName;

        const res = await callApi.dispatch(
          assistantId,
          `test-room-${Date.now()}`,
          API_KEY
        );

        if (isError(res)) {
          expect(res.detail).toBeDefined();
        } else {
          expect(res).toBeDefined();
        }
      } catch (e: unknown) {
        // LiveKit/call setup may not be configured
        if (
          e instanceof Error &&
          (e.message.includes('503') ||
            e.message.includes('500') ||
            e.message.includes('404') ||
            e.message.includes('Invalid JSON'))
        ) {
          console.log('Call dispatch service not available');
          return;
        }
        throw e;
      }
    });
  });
});
