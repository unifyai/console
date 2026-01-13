/**
 * Unit tests for src/lib/assistants/voice.ts
 *
 * Tests the server action factory functions for voice operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import {
  listVoices,
  registerVoice,
  deleteVoice,
  cloneVoice,
  generateSpeech,
  designVoiceGeneratePreviews,
  designVoiceCreateFromPreview,
} from '@/lib/assistants/voice';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('voice.ts', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('listVoices', () => {
    it(
      'returns array of voices on success',
      {
        meta: {
          alias: 'ListVoices-Success',
          scenario: 'API returns valid voice list',
          behavior: 'Returns transformed camelCase voices array',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant/voice`, () => {
            return HttpResponse.json([
              { voice_id: 'v1', name: 'Voice One', provider: 'elevenlabs' },
              { voice_id: 'v2', name: 'Voice Two', provider: 'cartesia' },
            ]);
          })
        );

        // Act
        const listFn = await listVoices(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect((result as any[])[0]).toHaveProperty('voiceId', 'v1');
      }
    );

    it(
      'handles nested info response structure',
      {
        meta: {
          alias: 'ListVoices-NestedInfo',
          scenario: 'API returns data nested in info property',
          behavior: 'Extracts and transforms voices from info wrapper',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant/voice`, () => {
            return HttpResponse.json({
              info: [{ voice_id: 'v1', name: 'Voice One' }],
            });
          })
        );

        // Act
        const listFn = await listVoices(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(Array.isArray(result)).toBe(true);
        expect((result as any[])[0]).toHaveProperty('voiceId', 'v1');
      }
    );

    it(
      'returns error when API fails',
      {
        meta: {
          alias: 'ListVoices-Error',
          scenario: 'API returns error response',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant/voice`, () => {
            return HttpResponse.json({ detail: 'Service unavailable' }, { status: 503 });
          })
        );

        // Act
        const listFn = await listVoices(TEST_API_KEY);
        const result = await listFn();

        // Assert
        expect(result).toHaveProperty('detail', 'Service unavailable');
      }
    );
  });

  describe('registerVoice', () => {
    it(
      'registers voice and returns success',
      {
        meta: {
          alias: 'RegisterVoice-Success',
          scenario: 'API successfully registers voice',
          behavior: 'Returns voice object with info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice`, () => {
            return HttpResponse.json({
              info: { voice_id: 'new-v1', name: 'My Voice', provider: 'elevenlabs' },
            });
          })
        );

        // Act
        const registerFn = await registerVoice(TEST_API_KEY);
        const result = await registerFn(
          'new-v1',
          'elevenlabs',
          'My Voice',
          'A custom voice',
          'female',
          'en',
          false
        );

        // Assert
        expect(result).toHaveProperty('voiceId', 'new-v1');
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'returns error when registration fails',
      {
        meta: {
          alias: 'RegisterVoice-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice`, () => {
            return HttpResponse.json({ detail: 'Voice already exists' }, { status: 409 });
          })
        );

        // Act
        const registerFn = await registerVoice(TEST_API_KEY);
        const result = await registerFn(
          'existing-v1',
          'elevenlabs',
          'My Voice',
          'desc',
          'male',
          'en',
          false
        );

        // Assert
        expect(result).toHaveProperty('detail', 'Voice already exists');
      }
    );
  });

  describe('deleteVoice', () => {
    it(
      'deletes voice and returns success (200)',
      {
        meta: {
          alias: 'DeleteVoice-Success200',
          scenario: 'API returns 200 with info',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/voice/:voiceId`, () => {
            return HttpResponse.json({ info: 'Voice deleted' });
          })
        );

        // Act
        const deleteFn = await deleteVoice(TEST_API_KEY);
        const result = await deleteFn('v1', 'elevenlabs');

        // Assert
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'handles 204 No Content response',
      {
        meta: {
          alias: 'DeleteVoice-204',
          scenario: 'API returns 204 No Content',
          behavior: 'Returns info message',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/voice/:voiceId`, () => {
            return new HttpResponse(null, { status: 204 });
          })
        );

        // Act
        const deleteFn = await deleteVoice(TEST_API_KEY);
        const result = await deleteFn('v1', 'elevenlabs');

        // Assert
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'treats 404 as success (already deleted)',
      {
        meta: {
          alias: 'DeleteVoice-404Success',
          scenario: 'API returns 404 Not Found',
          behavior: 'Returns info message (idempotent)',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/voice/:voiceId`, () => {
            return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
          })
        );

        // Act
        const deleteFn = await deleteVoice(TEST_API_KEY);
        const result = await deleteFn('nonexistent', 'elevenlabs');

        // Assert
        expect(result).toHaveProperty('info');
      }
    );

    it(
      'returns error for non-404 failures',
      {
        meta: {
          alias: 'DeleteVoice-Error',
          scenario: 'API returns error (not 404)',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.delete(`${MOCK_BASE_URL}/api/assistant/voice/:voiceId`, () => {
            return HttpResponse.json({ detail: 'Permission denied' }, { status: 403 });
          })
        );

        // Act
        const deleteFn = await deleteVoice(TEST_API_KEY);
        const result = await deleteFn('v1', 'elevenlabs');

        // Assert
        expect(result).toHaveProperty('detail', 'Permission denied');
      }
    );
  });

  describe('cloneVoice', () => {
    it(
      'clones voice from FormData and returns voice object',
      {
        meta: {
          alias: 'CloneVoice-Success',
          scenario: 'API successfully clones voice',
          behavior: 'Returns transformed voice object',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/clone`, () => {
            return HttpResponse.json({
              info: { voice_id: 'cloned-v1', name: 'Cloned Voice' },
            });
          })
        );

        const formData = new FormData();
        formData.append('name', 'Cloned Voice');
        formData.append('audio', new Blob(['audio data']), 'audio.mp3');

        // Act
        const cloneFn = await cloneVoice(TEST_API_KEY);
        const result = await cloneFn(formData);

        // Assert
        expect(result).toHaveProperty('voiceId', 'cloned-v1');
      }
    );

    it(
      'returns error on clone failure',
      {
        meta: {
          alias: 'CloneVoice-Error',
          scenario: 'API returns error during cloning',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/clone`, () => {
            return HttpResponse.json({ detail: 'Audio file too short' }, { status: 400 });
          })
        );

        const formData = new FormData();
        formData.append('audio', new Blob(['short']), 'audio.mp3');

        // Act
        const cloneFn = await cloneVoice(TEST_API_KEY);
        const result = await cloneFn(formData);

        // Assert
        expect(result).toHaveProperty('detail', 'Audio file too short');
      }
    );
  });

  describe('generateSpeech', () => {
    it(
      'generates speech and returns base64 audio',
      {
        meta: {
          alias: 'GenerateSpeech-Success',
          scenario: 'API successfully generates speech',
          behavior: 'Returns audioBase64 and contentType',
        },
      },
      async () => {
        // Arrange
        const audioData = new Uint8Array([1, 2, 3, 4, 5]);
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/generate`, () => {
            return new HttpResponse(audioData.buffer, {
              headers: { 'Content-Type': 'audio/mpeg' },
            });
          })
        );

        // Act
        const generateFn = await generateSpeech(TEST_API_KEY);
        const result = await generateFn({
          voiceId: 'v1',
          text: 'Hello world',
          provider: 'elevenlabs',
          outputFormat: 'mp3',
        });

        // Assert
        expect(result).toHaveProperty('audioBase64');
        expect(result).toHaveProperty('contentType', 'audio/mpeg');
      }
    );

    it(
      'converts payload to snake_case',
      {
        meta: {
          alias: 'GenerateSpeech-SnakeCase',
          scenario: 'Verify payload transformation',
          behavior: 'Request body uses snake_case keys',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        const audioData = new Uint8Array([1]);
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/generate`, async ({ request }) => {
            capturedBody = await request.json();
            return new HttpResponse(audioData.buffer);
          })
        );

        // Act
        const generateFn = await generateSpeech(TEST_API_KEY);
        await generateFn({
          voiceId: 'v1',
          text: 'Hello',
          provider: 'elevenlabs',
          outputFormat: 'mp3',
        });

        // Assert
        expect(capturedBody).toHaveProperty('voice_id', 'v1');
      }
    );

    it(
      'returns error for empty audio response',
      {
        meta: {
          alias: 'GenerateSpeech-EmptyAudio',
          scenario: 'API returns empty audio buffer',
          behavior: 'Returns error about empty audio',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/generate`, () => {
            return new HttpResponse(new ArrayBuffer(0));
          })
        );

        // Act
        const generateFn = await generateSpeech(TEST_API_KEY);
        const result = await generateFn({
          voiceId: 'v1',
          text: 'Hello',
          provider: 'elevenlabs',
          outputFormat: 'mp3',
        });

        // Assert
        expect(result).toHaveProperty('detail');
        expect(result.detail).toContain('empty');
      }
    );

    it(
      'returns error on API failure',
      {
        meta: {
          alias: 'GenerateSpeech-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail and status',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/generate`, () => {
            return HttpResponse.json({ detail: 'Insufficient credits' }, { status: 402 });
          })
        );

        // Act
        const generateFn = await generateSpeech(TEST_API_KEY);
        const result = await generateFn({
          voiceId: 'v1',
          text: 'Hello',
          provider: 'elevenlabs',
          outputFormat: 'mp3',
        });

        // Assert
        expect(result).toHaveProperty('detail', 'Insufficient credits');
        expect(result).toHaveProperty('status', 402);
      }
    );
  });

  describe('designVoiceGeneratePreviews', () => {
    it(
      'generates voice design previews',
      {
        meta: {
          alias: 'DesignPreviews-Success',
          scenario: 'API successfully generates previews',
          behavior: 'Returns previews array and text',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/design/preview`, () => {
            return HttpResponse.json({
              info: {
                previews: [
                  { voice_id: 'preview-1', audio_base64: 'base64data1' },
                  { voice_id: 'preview-2', audio_base64: 'base64data2' },
                ],
                text: 'Sample text',
              },
            });
          })
        );

        // Act
        const designFn = await designVoiceGeneratePreviews(TEST_API_KEY);
        const result = await designFn({
          voiceDescription: 'A young female American voice',
          autoGenerateText: true,
        });

        // Assert
        expect(result).toHaveProperty('previews');
        expect(result).toHaveProperty('text');
        expect((result as any).previews).toHaveLength(2);
      }
    );

    it(
      'handles non-wrapped response structure',
      {
        meta: {
          alias: 'DesignPreviews-DirectStructure',
          scenario: 'API returns data without info wrapper',
          behavior: 'Handles both response structures',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/design/preview`, () => {
            return HttpResponse.json({
              previews: [{ voice_id: 'p1' }],
              text: 'Direct text',
            });
          })
        );

        // Act
        const designFn = await designVoiceGeneratePreviews(TEST_API_KEY);
        const result = await designFn({
          voiceDescription: 'An older male British voice',
          text: 'Direct text',
        });

        // Assert
        expect(result).toHaveProperty('previews');
      }
    );

    it(
      'returns error on failure',
      {
        meta: {
          alias: 'DesignPreviews-Error',
          scenario: 'API returns error',
          behavior: 'Returns formatted error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/design/preview`, () => {
            return HttpResponse.json({ detail: 'Invalid parameters' }, { status: 400 });
          })
        );

        // Act
        const designFn = await designVoiceGeneratePreviews(TEST_API_KEY);
        const result = await designFn({
          voiceDescription: 'Invalid voice description',
          autoGenerateText: true,
        });

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });

  describe('designVoiceCreateFromPreview', () => {
    it(
      'creates voice from selected preview',
      {
        meta: {
          alias: 'CreateFromPreview-Success',
          scenario: 'API successfully creates voice from preview',
          behavior: 'Returns voice object',
        },
      },
      async () => {
        // Arrange - API returns snake_case with voiceId in info wrapper
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/design/create`, () => {
            return HttpResponse.json({
              info: {
                voiceId: 'final-v1',
                name: 'Designed Voice',
                provider: 'elevenlabs',
              },
            });
          })
        );

        // Act
        const createFn = await designVoiceCreateFromPreview(TEST_API_KEY);
        const result = await createFn({
          generatedVoiceId: 'preview-1',
          voiceName: 'Designed Voice',
          voiceDescription: 'A designed voice',
        });

        // Assert
        expect(result).toHaveProperty('voiceId', 'final-v1');
        expect(result).toHaveProperty('name', 'Designed Voice');
      }
    );

    it(
      'handles direct response structure',
      {
        meta: {
          alias: 'CreateFromPreview-DirectStructure',
          scenario: 'API returns data without info wrapper',
          behavior: 'Handles both response structures',
        },
      },
      async () => {
        // Arrange - API returns without info wrapper but with voiceId
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/design/create`, () => {
            return HttpResponse.json({
              voiceId: 'direct-v1',
              name: 'Direct Voice',
            });
          })
        );

        // Act
        const createFn = await designVoiceCreateFromPreview(TEST_API_KEY);
        const result = await createFn({
          generatedVoiceId: 'preview-1',
          voiceName: 'Direct Voice',
          voiceDescription: 'desc',
        });

        // Assert
        expect(result).toHaveProperty('voiceId', 'direct-v1');
      }
    );

    it(
      'returns error on failure',
      {
        meta: {
          alias: 'CreateFromPreview-Error',
          scenario: 'API returns error',
          behavior: 'Returns formatted error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/voice/design/create`, () => {
            return HttpResponse.json({ detail: 'Preview expired' }, { status: 400 });
          })
        );

        // Act
        const createFn = await designVoiceCreateFromPreview(TEST_API_KEY);
        const result = await createFn({
          generatedVoiceId: 'expired-preview',
          voiceName: 'Voice',
          voiceDescription: 'desc',
        });

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
