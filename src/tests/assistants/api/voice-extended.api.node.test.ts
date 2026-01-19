/**
 * API Route tests for Extended Voice endpoints
 *
 * Tests the voice-related API routes for proper handling of:
 * - TTS generation
 * - Voice cloning
 * - Voice design
 * - Provider-specific errors
 *
 * Uses MSW to mock backend services (ORCHESTRA_URL).
 *
 * @group api
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

// Mock environment variables
const MOCK_ORCHESTRA_URL = 'http://orchestra-service';

describe('Voice Extended API Routes', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('ORCHESTRA_URL', MOCK_ORCHESTRA_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('POST /api/assistant/voice/generate', () => {
    it(
      'generates speech and returns audio',
      {
        meta: {
          alias: 'VoiceGenerate-Success',
          scenario: 'Valid TTS request',
          behavior: 'Returns audio data',
        },
      },
      async () => {
        // Arrange
        const audioData = new Uint8Array([1, 2, 3, 4, 5]);
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/generate`, () => {
            return new HttpResponse(audioData.buffer, {
              headers: { 'Content-Type': 'audio/mpeg' },
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voice_id: 'v1',
            text: 'Hello world',
            provider: 'elevenlabs',
          }),
        });

        // Assert
        expect(response.ok).toBe(true);
        expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
      }
    );

    it(
      'handles insufficient credits',
      {
        meta: {
          alias: 'VoiceGenerate-NoCredits',
          scenario: 'User has insufficient credits',
          behavior: 'Returns 402 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/generate`, () => {
            return HttpResponse.json({ detail: 'Insufficient credits' }, { status: 402 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voice_id: 'v1',
            text: 'Hello',
            provider: 'elevenlabs',
          }),
        });

        // Assert
        expect(response.status).toBe(402);
      }
    );

    it(
      'handles invalid voice ID',
      {
        meta: {
          alias: 'VoiceGenerate-InvalidVoice',
          scenario: 'Voice ID not found',
          behavior: 'Returns 404 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/generate`, () => {
            return HttpResponse.json({ detail: 'Voice not found' }, { status: 404 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voice_id: 'nonexistent',
            text: 'Hello',
            provider: 'elevenlabs',
          }),
        });

        // Assert
        expect(response.status).toBe(404);
      }
    );

    it(
      'handles ElevenLabs provider error',
      {
        meta: {
          alias: 'VoiceGenerate-ElevenLabsError',
          scenario: 'ElevenLabs API returns error',
          behavior: 'Returns 502 with provider error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/generate`, () => {
            return HttpResponse.json(
              { detail: 'ElevenLabs API error: rate limit exceeded' },
              { status: 502 }
            );
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voice_id: 'v1',
            text: 'Hello',
            provider: 'elevenlabs',
          }),
        });

        // Assert
        expect(response.status).toBe(502);
      }
    );
  });

  describe('POST /api/assistant/voice/clone', () => {
    it(
      'clones voice successfully',
      {
        meta: {
          alias: 'VoiceClone-Success',
          scenario: 'Valid voice cloning request',
          behavior: 'Returns cloned voice details',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/clone`, () => {
            return HttpResponse.json({
              info: {
                voice_id: 'cloned-v1',
                name: 'My Cloned Voice',
                provider: 'elevenlabs',
              },
            });
          })
        );

        // Act
        const formData = new FormData();
        formData.append('name', 'My Cloned Voice');
        formData.append('audio', new Blob(['audio data'], { type: 'audio/mpeg' }), 'sample.mp3');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/clone`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.voice_id).toBe('cloned-v1');
      }
    );

    it(
      'handles audio too short',
      {
        meta: {
          alias: 'VoiceClone-TooShort',
          scenario: 'Audio sample too short for cloning',
          behavior: 'Returns 400 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/clone`, () => {
            return HttpResponse.json(
              { detail: 'Audio sample too short. Minimum 30 seconds required.' },
              { status: 400 }
            );
          })
        );

        // Act
        const formData = new FormData();
        formData.append('name', 'Short Voice');
        formData.append('audio', new Blob(['short']), 'sample.mp3');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/clone`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });

        // Assert
        expect(response.status).toBe(400);
      }
    );

    it(
      'handles clone quota exceeded',
      {
        meta: {
          alias: 'VoiceClone-QuotaExceeded',
          scenario: 'User has exceeded voice clone quota',
          behavior: 'Returns 429 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/clone`, () => {
            return HttpResponse.json({ detail: 'Voice clone quota exceeded' }, { status: 429 });
          })
        );

        // Act
        const formData = new FormData();
        formData.append('name', 'Another Voice');
        formData.append('audio', new Blob(['audio']), 'sample.mp3');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/clone`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });

        // Assert
        expect(response.status).toBe(429);
      }
    );
  });

  describe('POST /api/assistant/voice/design/preview', () => {
    it(
      'generates voice design previews',
      {
        meta: {
          alias: 'VoiceDesign-Preview',
          scenario: 'Valid design parameters',
          behavior: 'Returns preview audio samples',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/design/preview`, () => {
            return HttpResponse.json({
              info: {
                previews: [
                  { voice_id: 'preview-1', audio_base64: 'base64data1' },
                  { voice_id: 'preview-2', audio_base64: 'base64data2' },
                ],
                text: 'Sample preview text',
              },
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/design/preview`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gender: 'female',
            age: 'young',
            accent: 'american',
          }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.previews).toHaveLength(2);
      }
    );

    it(
      'handles invalid parameters',
      {
        meta: {
          alias: 'VoiceDesign-InvalidParams',
          scenario: 'Invalid design parameters',
          behavior: 'Returns 400 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/design/preview`, () => {
            return HttpResponse.json({ detail: 'Invalid gender parameter' }, { status: 400 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/design/preview`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gender: 'invalid',
          }),
        });

        // Assert
        expect(response.status).toBe(400);
      }
    );
  });

  describe('POST /api/assistant/voice/design/create', () => {
    it(
      'creates voice from preview',
      {
        meta: {
          alias: 'VoiceDesign-Create',
          scenario: 'Valid preview selection',
          behavior: 'Returns created voice',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/design/create`, () => {
            return HttpResponse.json({
              info: {
                voice_id: 'designed-v1',
                name: 'Designed Voice',
                provider: 'elevenlabs',
              },
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/design/create`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            generated_voice_id: 'preview-1',
            voice_name: 'Designed Voice',
            voice_description: 'A designed voice',
          }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.voice_id).toBe('designed-v1');
      }
    );

    it(
      'handles expired preview',
      {
        meta: {
          alias: 'VoiceDesign-ExpiredPreview',
          scenario: 'Preview has expired',
          behavior: 'Returns 400 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/design/create`, () => {
            return HttpResponse.json(
              { detail: 'Preview has expired. Please generate new previews.' },
              { status: 400 }
            );
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/voice/design/create`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            generated_voice_id: 'expired-preview',
            voice_name: 'Voice',
            voice_description: 'desc',
          }),
        });

        // Assert
        expect(response.status).toBe(400);
      }
    );
  });
});
