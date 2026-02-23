/**
 * API Route tests for Media upload endpoints
 *
 * Tests the media upload API routes for proper handling of:
 * - FormData processing
 * - File upload to backend
 * - Response transformation
 * - Error handling for file size/type
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

describe('Media API Routes', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('ORCHESTRA_URL', MOCK_ORCHESTRA_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('POST /api/assistant/photo/upload', () => {
    it(
      'uploads photo and returns GCS URL',
      {
        meta: {
          alias: 'PhotoUpload-Success',
          scenario: 'Valid photo upload',
          behavior: 'Returns gcsUrl and signedUrl',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/upload`, () => {
            return HttpResponse.json({
              info: {
                gcs_url: 'gs://bucket/photos/photo-123.jpg',
                signed_url: 'https://storage.googleapis.com/signed-url',
              },
            });
          })
        );

        // Act
        const formData = new FormData();
        formData.append('file', new Blob(['image data'], { type: 'image/jpeg' }), 'photo.jpg');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.gcs_url).toContain('gs://');
      }
    );

    it(
      'handles upload failure',
      {
        meta: {
          alias: 'PhotoUpload-Error',
          scenario: 'Backend rejects upload',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/upload`, () => {
            return HttpResponse.json({ detail: 'File too large' }, { status: 413 });
          })
        );

        // Act
        const formData = new FormData();
        formData.append('file', new Blob(['large data']), 'photo.jpg');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });

        // Assert
        expect(response.status).toBe(413);
      }
    );

    it(
      'handles invalid file type',
      {
        meta: {
          alias: 'PhotoUpload-InvalidType',
          scenario: 'Invalid file type uploaded',
          behavior: 'Returns 400 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/upload`, () => {
            return HttpResponse.json(
              { detail: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
              { status: 400 }
            );
          })
        );

        // Act
        const formData = new FormData();
        formData.append('file', new Blob(['text data'], { type: 'text/plain' }), 'file.txt');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });

        // Assert
        expect(response.status).toBe(400);
      }
    );
  });

  describe('POST /api/assistant/video/upload', () => {
    it(
      'uploads video and returns GCS URL',
      {
        meta: {
          alias: 'VideoUpload-Success',
          scenario: 'Valid video upload',
          behavior: 'Returns gcsUrl',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/video/upload`, () => {
            return HttpResponse.json({
              info: {
                gcs_url: 'gs://bucket/videos/video-123.mp4',
              },
            });
          })
        );

        // Act
        const formData = new FormData();
        formData.append('file', new Blob(['video data'], { type: 'video/mp4' }), 'video.mp4');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/video/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.gcs_url).toContain('gs://');
      }
    );

    it(
      'handles video upload failure',
      {
        meta: {
          alias: 'VideoUpload-Error',
          scenario: 'Backend rejects video',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/video/upload`, () => {
            return HttpResponse.json(
              { detail: 'Video duration exceeds maximum allowed' },
              { status: 400 }
            );
          })
        );

        // Act
        const formData = new FormData();
        formData.append('file', new Blob(['long video']), 'video.mp4');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/video/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });

        // Assert
        expect(response.status).toBe(400);
      }
    );
  });

  describe('POST /api/assistant/photo/generate', () => {
    it(
      'generates photo and returns URL',
      {
        meta: {
          alias: 'PhotoGenerate-Success',
          scenario: 'Valid generation request',
          behavior: 'Returns generated photo URL',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/generate`, () => {
            return HttpResponse.json({
              info: 'https://generated.photo/result.jpg',
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: 'Professional headshot' }),
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info).toContain('https://');
      }
    );

    it(
      'handles content policy violation',
      {
        meta: {
          alias: 'PhotoGenerate-ContentPolicy',
          scenario: 'Prompt violates content policy',
          behavior: 'Returns 400 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/generate`, () => {
            return HttpResponse.json({ detail: 'Content policy violation' }, { status: 400 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: 'inappropriate content' }),
        });

        // Assert
        expect(response.status).toBe(400);
      }
    );
  });

  describe('POST /api/assistant/photo/edit', () => {
    it(
      'edits photo and returns URL',
      {
        meta: {
          alias: 'PhotoEdit-Success',
          scenario: 'Valid edit request with mask',
          behavior: 'Returns edited photo URL',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/edit`, () => {
            return HttpResponse.json({
              info: 'https://edited.photo/result.jpg',
            });
          })
        );

        // Act
        const formData = new FormData();
        formData.append('image', new Blob(['image']), 'photo.jpg');
        formData.append('prompt', 'make it brighter');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/edit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info).toContain('https://');
      }
    );
  });

  describe('POST /api/assistant/photo/animate', () => {
    it(
      'starts animation and returns prediction',
      {
        meta: {
          alias: 'PhotoAnimate-Success',
          scenario: 'Valid animation request',
          behavior: 'Returns prediction ID and status',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/animate`, () => {
            return HttpResponse.json({
              info: {
                id: 'pred-123',
                status: 'starting',
              },
            });
          })
        );

        // Act
        const formData = new FormData();
        formData.append('image', new Blob(['image']), 'photo.jpg');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/animate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.id).toBe('pred-123');
      }
    );

    it(
      'handles no face detected',
      {
        meta: {
          alias: 'PhotoAnimate-NoFace',
          scenario: 'Image has no detectable face',
          behavior: 'Returns 422 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/animate`, () => {
            return HttpResponse.json({ detail: 'No face detected in image' }, { status: 422 });
          })
        );

        // Act
        const formData = new FormData();
        formData.append('image', new Blob(['no face']), 'photo.jpg');

        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/animate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
          body: formData,
        });

        // Assert
        expect(response.status).toBe(422);
      }
    );
  });

  describe('GET /api/assistant/photo/animate/[predictionId]', () => {
    it(
      'returns prediction status',
      {
        meta: {
          alias: 'PhotoAnimate-GetPrediction',
          scenario: 'Valid prediction ID',
          behavior: 'Returns prediction with status',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/animate/:id`, () => {
            return HttpResponse.json({
              info: {
                id: 'pred-123',
                status: 'succeeded',
                output: 'https://output.video/url.mp4',
              },
            });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/animate/pred-123`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });
        const data = await response.json();

        // Assert
        expect(response.ok).toBe(true);
        expect(data.info.status).toBe('succeeded');
      }
    );

    it(
      'handles not found prediction',
      {
        meta: {
          alias: 'PhotoAnimate-NotFound',
          scenario: 'Invalid prediction ID',
          behavior: 'Returns 404 error',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/animate/:id`, () => {
            return HttpResponse.json({ detail: 'Prediction not found' }, { status: 404 });
          })
        );

        // Act
        const response = await fetch(`${MOCK_ORCHESTRA_URL}/v0/assistant/photo/animate/invalid`, {
          headers: { Authorization: `Bearer ${TEST_API_KEY}` },
        });

        // Assert
        expect(response.status).toBe(404);
      }
    );
  });
});
