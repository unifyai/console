/**
 * Real API tests for src/lib/assistants/voice.ts
 *
 * These tests hit the actual Orchestra API to verify voice listing works correctly.
 * Note: Voice generation, cloning, and design tests are excluded as they hit
 * third-party services (ElevenLabs, Cartesia) directly.
 *
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
  voiceApi,
  getTestApiKey,
  skipIfServerNotReachable,
  realTestOptions,
} from '@/tests/assistants/api/fixtures/api-actions';

const isError = (res: unknown): res is { detail: string } => {
  return res !== null && typeof res === 'object' && 'detail' in res;
};

describe('@real voice.ts - Orchestra Integration', () => {
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

  describe('listVoices', () => {
    it('@real should return available voices', realTestOptions, async () => {
      const res = await voiceApi.list(API_KEY);

      expect(isError(res)).toBe(false);
      expect(Array.isArray(res)).toBe(true);
      if (Array.isArray(res) && res.length > 0) {
        expect(res[0]).toHaveProperty('voiceId');
      }
    });
  });

  // Note: The following tests are intentionally excluded as they hit third-party services:
  // - generateSpeech (ElevenLabs/Cartesia TTS)
  // - registerVoice (ElevenLabs validation)
  // - deleteVoice (ElevenLabs)
  // - cloneVoice (ElevenLabs)
  // - designVoice (ElevenLabs)
  //
  // These are covered by mocked unit tests in voice.node.test.ts
});
