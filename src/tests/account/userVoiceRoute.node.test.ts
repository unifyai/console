import { File as NodeFile } from 'node:buffer';

import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getApiKeyFromRequestMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/_utils/auth', () => {
  const jsonResponse = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  return {
    getApiKeyFromRequest: getApiKeyFromRequestMock,
    unauthorized: (message = 'Unauthorized - no API key') => jsonResponse({ error: message }, 401),
    internalError: (message = 'Internal server error') => jsonResponse({ error: message }, 500),
  };
});

/**
 * jsdom supplies the global File/FormData while NextRequest parses bodies with
 * Node's undici, whose multipart parser brand-checks entries against Node's own
 * File class. The upload round-trip therefore has to run on undici's classes
 * end to end: File comes from node:buffer, and FormData is recovered through
 * Response since Node exposes no module path to it.
 */
let NativeFormData: typeof FormData;

beforeAll(async () => {
  const seed = new Response('', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  NativeFormData = (await seed.formData()).constructor as typeof FormData;
});

function uploadRequest(): NextRequest {
  const formData = new NativeFormData();
  formData.append(
    'file',
    new NodeFile([new Uint8Array([1, 2, 3])], 'voice.wav', { type: 'audio/wav' }) as unknown as File
  );
  return new NextRequest('http://localhost/api/user/voice/upload', {
    method: 'POST',
    body: formData,
  });
}

function deleteRequest(): NextRequest {
  return new NextRequest('http://localhost/api/user/voice', { method: 'DELETE' });
}

async function loadUploadRoute() {
  vi.resetModules();
  return import('@/app/api/user/voice/upload/route');
}

async function loadDeleteRoute() {
  vi.resetModules();
  return import('@/app/api/user/voice/route');
}

describe('user voice routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    // The parser inside request.formData() constructs entries with the global
    // File and asserts they are Node's — jsdom's shadowing File fails that.
    vi.stubGlobal('File', NodeFile);
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000';
    getApiKeyFromRequestMock.mockResolvedValue('user-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ORCHESTRA_URL;
  });

  it('rejects unauthenticated uploads', async () => {
    getApiKeyFromRequestMock.mockResolvedValue(null);
    const { POST } = await loadUploadRoute();

    const response = await POST(uploadRequest());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('proxies the upload to Orchestra with the user key', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ gcs_url: 'gs://bucket/user-voice/u1/sample.wav' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const { POST } = await loadUploadRoute();

    const response = await POST(uploadRequest());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ gcs_url: 'gs://bucket/user-voice/u1/sample.wav' });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/v0/user/voice/upload',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer user-api-key' },
      })
    );
  });

  it('surfaces Orchestra upload errors', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid file type.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const { POST } = await loadUploadRoute();

    const response = await POST(uploadRequest());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail: 'Invalid file type.' });
  });

  it('proxies removal to Orchestra with the user key', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Voice sample removed.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const { DELETE } = await loadDeleteRoute();

    const response = await DELETE(deleteRequest());

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/v0/user/voice',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer user-api-key' },
      })
    );
  });
});
