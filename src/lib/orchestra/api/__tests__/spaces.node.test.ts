import { afterEach, describe, expect, it, vi } from 'vitest';

import { listSpaces } from '@/lib/orchestra/api/spaces';

const apiBaseUrl = 'https://orchestra.test';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('spaces API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns the response envelope when Orchestra rejects a spaces read', async () => {
    vi.stubEnv('ORCHESTRA_URL', apiBaseUrl);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'permission denied' }, 403))
    );

    await expect(listSpaces('user-key')).resolves.toEqual({
      detail: 'permission denied',
      status: 403,
    });
  });
});
