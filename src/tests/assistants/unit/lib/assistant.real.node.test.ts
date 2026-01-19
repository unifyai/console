/**
 * Real API tests for src/lib/assistants/assistant.ts
 *
 * These tests hit the actual Orchestra API to verify the integration works correctly.
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
  assistantsApi,
  getTestAssistant,
  getTestApiKey,
  skipIfServerNotReachable,
  realTestOptions,
  realTestOptionsExtended,
} from '@/tests/assistants/api/fixtures/api-actions';

const isError = (res: unknown): res is { detail: string } => {
  return res !== null && typeof res === 'object' && 'detail' in res;
};

describe('@real assistant.ts - Orchestra Integration', () => {
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

  describe('listAssistants', () => {
    it('@real should return a list of assistants', realTestOptions, async () => {
      const res = await assistantsApi.list(API_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);
      if (Array.isArray(res) && res.length > 0) {
        expect(res[0]).toHaveProperty('agentId');
        expect(res[0]).toHaveProperty('firstName');
        expect(res[0]).toHaveProperty('surname');
      }
    });
  });

  describe('getAssistantStatus', () => {
    it('@real should return status object', realTestOptions, async () => {
      const assistant = await getTestAssistant(API_KEY);
      const assistantId = assistant.agentId;

      const res = await assistantsApi.getStatus(assistantId, API_KEY);

      expect(isError(res)).toBe(false);
      expect(res).toHaveProperty('running');
    });
  });

  describe('updateAssistant', () => {
    it('@real should successfully update the assistant', realTestOptions, async () => {
      const assistant = await getTestAssistant(API_KEY);
      const assistantId = assistant.agentId;

      const updatedLimit = 30;
      const res = await assistantsApi.update(assistantId, { weeklyLimit: updatedLimit }, API_KEY);

      expect(isError(res)).toBe(false);
      expect(res).toHaveProperty('info');
      expect(res.info).toHaveProperty('agentId');
      expect(res.info.weeklyLimit).toBe(30);
    });
  });

  describe('createAssistant', () => {
    it.skip('@real should successfully create an assistant', realTestOptionsExtended, async () => {
      // SKIPPED: wake_up_assistant is always called regardless of create_infra flag
      // This requires the Unity adapters service which may not be available locally
      const uniqueName = `TestBot-${Date.now()}`;
      const res = await assistantsApi.create(
        uniqueName,
        'Agent',
        40,
        'GB',
        'UTC',
        'https://cdn.jsdelivr.net/gh/faker-js/assets-person-portrait/male/512/1.jpg',
        'gs://bucket/preset_assistants/Ricardo_Silva_elevenlabs.mp4',
        'Integration test assistant for automated testing',
        API_KEY,
        false // createInfra: false for local testing - skip pubsub/wake-up
      );

      // Creation should succeed - 409 would indicate a test isolation bug
      expect(isError(res)).toBe(false);
      expect(res.assistant).toBeDefined();
      expect(res.assistant.agentId).toBeDefined();
      expect(res.assistant.firstName).toBe(uniqueName);
    });
  });

  describe('deleteAssistant', () => {
    it('@real should successfully delete an assistant', realTestOptions, async () => {
      const assistant = await getTestAssistant(API_KEY);
      const assistantId = assistant.agentId;

      const res = await assistantsApi.delete(assistantId, API_KEY);

      expect(isError(res)).toBe(false);
      expect(res.info).toBeDefined();
    });
  });
});
