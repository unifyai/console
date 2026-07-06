import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function uploadRequest(): NextRequest {
  const formData = new FormData();
  formData.append(
    'file',
    new File([new Uint8Array([1, 2, 3])], 'voice.wav', { type: 'audio/wav' })
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
