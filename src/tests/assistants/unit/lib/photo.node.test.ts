/**
 * Unit tests for src/lib/assistants/photo.ts
 *
 * Tests the server action factory functions for photo operations.
 * Uses MSW to mock HTTP calls and test the logic in isolation.
 *
 * Note: Functions that use GCS directly (downloadPhoto, listMediaFiles, etc.)
 * are tested via integration tests as they require GCS SDK mocking.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import {
  uploadPhoto,
  uploadVideo,
  generatePhoto,
  editPhoto,
  animatePhoto,
  getAnimationPrediction,
  cancelAnimationPrediction,
} from '@/lib/assistants/photo';

// Mock environment variables
const MOCK_BASE_URL = 'http://localhost:3000';

describe('photo.ts', () => {
  const TEST_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', MOCK_BASE_URL);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  describe('uploadPhoto', () => {
    it(
      'uploads photo and returns GCS URL',
      {
        meta: {
          alias: 'UploadPhoto-Success',
          scenario: 'API successfully uploads photo',
          behavior: 'Returns gcsUrl in response',
        },
      },
      async () => {
        // Arrange - API returns snake_case which gets transformed to camelCase
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/upload`, () => {
            return HttpResponse.json({
              info: { gcsUrl: 'gs://bucket/photo.jpg', signedUrl: 'https://signed.url' },
            });
          })
        );

        const formData = new FormData();
        formData.append('file', new Blob(['image data']), 'photo.jpg');

        // Act
        const uploadFn = await uploadPhoto(TEST_API_KEY);
        const result = await uploadFn(formData);

        // Assert
        expect(result).toHaveProperty('gcsUrl', 'gs://bucket/photo.jpg');
      }
    );

    it(
      'returns error when GCS URL not in response',
      {
        meta: {
          alias: 'UploadPhoto-NoGcsUrl',
          scenario: 'API returns success but no GCS URL',
          behavior: 'Returns error about missing URL',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/upload`, () => {
            return HttpResponse.json({ info: { something: 'else' } });
          })
        );

        const formData = new FormData();
        formData.append('file', new Blob(['data']), 'photo.jpg');

        // Act
        const uploadFn = await uploadPhoto(TEST_API_KEY);
        const result = await uploadFn(formData);

        // Assert
        expect(result).toHaveProperty('detail');
        expect((result as any).detail).toContain('GCS URL');
      }
    );

    it(
      'returns error when upload fails',
      {
        meta: {
          alias: 'UploadPhoto-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/upload`, () => {
            return HttpResponse.json({ detail: 'File too large' }, { status: 413 });
          })
        );

        const formData = new FormData();
        formData.append('file', new Blob(['large data']), 'photo.jpg');

        // Act
        const uploadFn = await uploadPhoto(TEST_API_KEY);
        const result = await uploadFn(formData);

        // Assert
        expect(result).toHaveProperty('detail', 'File too large');
      }
    );
  });

  describe('uploadVideo', () => {
    it(
      'uploads video and returns GCS URL',
      {
        meta: {
          alias: 'UploadVideo-Success',
          scenario: 'API successfully uploads video',
          behavior: 'Returns gcsUrl in response',
        },
      },
      async () => {
        // Arrange - API returns snake_case which gets transformed to camelCase
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/video/upload`, () => {
            return HttpResponse.json({
              info: { gcsUrl: 'gs://bucket/video.mp4' },
            });
          })
        );

        const formData = new FormData();
        formData.append('file', new Blob(['video data']), 'video.mp4');

        // Act
        const uploadFn = await uploadVideo(TEST_API_KEY);
        const result = await uploadFn(formData);

        // Assert
        expect(result).toHaveProperty('gcsUrl', 'gs://bucket/video.mp4');
      }
    );

    it(
      'returns error when upload fails',
      {
        meta: {
          alias: 'UploadVideo-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/video/upload`, () => {
            return HttpResponse.json({ detail: 'Invalid video format' }, { status: 400 });
          })
        );

        const formData = new FormData();
        formData.append('file', new Blob(['invalid']), 'file.txt');

        // Act
        const uploadFn = await uploadVideo(TEST_API_KEY);
        const result = await uploadFn(formData);

        // Assert
        expect(result).toHaveProperty('detail', 'Invalid video format');
      }
    );
  });

  describe('generatePhoto', () => {
    it(
      'generates photo and returns URL',
      {
        meta: {
          alias: 'GeneratePhoto-Success',
          scenario: 'API successfully generates photo',
          behavior: 'Returns url in response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/generate`, () => {
            return HttpResponse.json({
              info: 'https://generated.photo/url.jpg',
            });
          })
        );

        // Act
        const generateFn = await generatePhoto(TEST_API_KEY);
        const result = await generateFn({
          prompt: 'A professional headshot',
          aspectRatio: '1:1',
        });

        // Assert
        expect(result).toHaveProperty('url', 'https://generated.photo/url.jpg');
      }
    );

    it(
      'converts payload to snake_case',
      {
        meta: {
          alias: 'GeneratePhoto-SnakeCase',
          scenario: 'Verify payload transformation',
          behavior: 'Request body uses snake_case keys',
        },
      },
      async () => {
        // Arrange
        let capturedBody: any = null;
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/generate`, async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({ info: 'url' });
          })
        );

        // Act
        const generateFn = await generatePhoto(TEST_API_KEY);
        await generateFn({
          prompt: 'test',
          aspectRatio: '16:9',
        });

        // Assert
        expect(capturedBody).toHaveProperty('aspect_ratio', '16:9');
      }
    );

    it(
      'returns error for unexpected response format',
      {
        meta: {
          alias: 'GeneratePhoto-UnexpectedFormat',
          scenario: 'API returns success without URL',
          behavior: 'Returns error about unexpected format',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/generate`, () => {
            return HttpResponse.json({ info: { nested: 'object' } });
          })
        );

        // Act
        const generateFn = await generatePhoto(TEST_API_KEY);
        const result = await generateFn({ prompt: 'test' });

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );

    it(
      'returns error when generation fails',
      {
        meta: {
          alias: 'GeneratePhoto-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/generate`, () => {
            return HttpResponse.json({ detail: 'Content policy violation' }, { status: 400 });
          })
        );

        // Act
        const generateFn = await generatePhoto(TEST_API_KEY);
        const result = await generateFn({ prompt: 'inappropriate' });

        // Assert
        expect(result).toHaveProperty('detail', 'Content policy violation');
      }
    );
  });

  describe('editPhoto', () => {
    it(
      'edits photo and returns URL',
      {
        meta: {
          alias: 'EditPhoto-Success',
          scenario: 'API successfully edits photo',
          behavior: 'Returns url in response',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/edit`, () => {
            return HttpResponse.json({
              info: 'https://edited.photo/url.jpg',
            });
          })
        );

        const formData = new FormData();
        formData.append('image', new Blob(['image']), 'photo.jpg');
        formData.append('prompt', 'make it brighter');

        // Act
        const editFn = await editPhoto(TEST_API_KEY);
        const result = await editFn(formData);

        // Assert
        expect(result).toHaveProperty('url', 'https://edited.photo/url.jpg');
      }
    );

    it(
      'returns error when edit fails',
      {
        meta: {
          alias: 'EditPhoto-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/edit`, () => {
            return HttpResponse.json({ detail: 'Invalid image format' }, { status: 400 });
          })
        );

        const formData = new FormData();
        formData.append('image', new Blob(['invalid']), 'file.txt');

        // Act
        const editFn = await editPhoto(TEST_API_KEY);
        const result = await editFn(formData);

        // Assert
        expect(result).toHaveProperty('detail', 'Invalid image format');
      }
    );
  });

  describe('animatePhoto', () => {
    it(
      'starts animation and returns prediction ID',
      {
        meta: {
          alias: 'AnimatePhoto-Success',
          scenario: 'API successfully starts animation',
          behavior: 'Returns prediction object with id',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/animate`, () => {
            return HttpResponse.json({
              info: { id: 'pred-123', status: 'starting' },
            });
          })
        );

        const formData = new FormData();
        formData.append('image', new Blob(['image']), 'photo.jpg');

        // Act
        const animateFn = await animatePhoto(TEST_API_KEY);
        const result = await animateFn(formData);

        // Assert
        expect(result).toHaveProperty('id', 'pred-123');
        expect(result).toHaveProperty('status', 'starting');
      }
    );

    it(
      'returns error when animation fails',
      {
        meta: {
          alias: 'AnimatePhoto-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail and status',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/animate`, () => {
            return HttpResponse.json({ detail: 'No face detected' }, { status: 422 });
          })
        );

        const formData = new FormData();
        formData.append('image', new Blob(['no face']), 'photo.jpg');

        // Act
        const animateFn = await animatePhoto(TEST_API_KEY);
        const result = await animateFn(formData);

        // Assert
        expect(result).toHaveProperty('detail', 'No face detected');
        expect(result).toHaveProperty('status', 422);
      }
    );
  });

  describe('getAnimationPrediction', () => {
    it(
      'returns prediction status',
      {
        meta: {
          alias: 'GetPrediction-Success',
          scenario: 'API returns prediction status',
          behavior: 'Returns prediction object',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant/photo/animate/:id`, () => {
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
        const getPredFn = await getAnimationPrediction(TEST_API_KEY);
        const result = await getPredFn('pred-123');

        // Assert
        expect(result).toHaveProperty('id', 'pred-123');
        expect(result).toHaveProperty('status', 'succeeded');
        expect(result).toHaveProperty('output');
      }
    );

    it(
      'returns error when prediction not found',
      {
        meta: {
          alias: 'GetPrediction-NotFound',
          scenario: 'API returns 404',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.get(`${MOCK_BASE_URL}/api/assistant/photo/animate/:id`, () => {
            return HttpResponse.json({ detail: 'Prediction not found' }, { status: 404 });
          })
        );

        // Act
        const getPredFn = await getAnimationPrediction(TEST_API_KEY);
        const result = await getPredFn('nonexistent');

        // Assert
        expect(result).toHaveProperty('detail', 'Prediction not found');
      }
    );
  });

  describe('cancelAnimationPrediction', () => {
    it(
      'cancels prediction and returns status',
      {
        meta: {
          alias: 'CancelPrediction-Success',
          scenario: 'API successfully cancels prediction',
          behavior: 'Returns prediction with canceled status',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/animate/:id/cancel`, () => {
            return HttpResponse.json({
              info: { id: 'pred-123', status: 'canceled' },
            });
          })
        );

        // Act
        const cancelFn = await cancelAnimationPrediction(TEST_API_KEY);
        const result = await cancelFn('pred-123');

        // Assert
        expect(result).toHaveProperty('id', 'pred-123');
        expect(result).toHaveProperty('status', 'canceled');
      }
    );

    it(
      'returns error when cancel fails',
      {
        meta: {
          alias: 'CancelPrediction-Error',
          scenario: 'API returns error',
          behavior: 'Returns error detail',
        },
      },
      async () => {
        // Arrange
        server.use(
          http.post(`${MOCK_BASE_URL}/api/assistant/photo/animate/:id/cancel`, () => {
            return HttpResponse.json(
              { detail: 'Cannot cancel completed prediction' },
              { status: 400 }
            );
          })
        );

        // Act
        const cancelFn = await cancelAnimationPrediction(TEST_API_KEY);
        const result = await cancelFn('completed-pred');

        // Assert
        expect(result).toHaveProperty('detail');
      }
    );
  });
});
