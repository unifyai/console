import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchMediaSignedUrls,
  readCachedMediaSignedUrls,
  seedMediaSignedUrls,
} from '@/lib/client/assistant';
import { clearMediaSignedUrlCacheForTests } from '@/lib/client/mediaSignedUrlCache';

function toGoogleDate(ms: number): string {
  const iso = new Date(ms).toISOString();
  const [datePart, timePart] = iso.split('T');
  const compactDate = datePart.replaceAll('-', '');
  const compactTime = timePart.slice(0, 8).replaceAll(':', '');
  return `${compactDate}T${compactTime}Z`;
}

function buildSignedUrl(pathTail: string, startMs: number, expiresSeconds: number): string {
  const date = toGoogleDate(startMs);
  return `https://storage.googleapis.com/assistant-media-staging/${pathTail}?X-Goog-Date=${date}&X-Goog-Expires=${expiresSeconds}&X-Goog-Signature=test`;
}

describe('fetchMediaSignedUrls caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMediaSignedUrlCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearMediaSignedUrlCacheForTests();
  });

  it('returns cached signed URLs without network fetch', async () => {
    const mediaPath = 'gs://bucket/123/photo/avatar.jpg';
    const signedUrl = buildSignedUrl('123/photo/avatar.jpg', Date.now(), 900);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    seedMediaSignedUrls({ [mediaPath]: signedUrl });

    const result = await fetchMediaSignedUrls([mediaPath]);
    expect(result[mediaPath]).toBe(signedUrl);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches on cache miss and reuses cached value on follow-up call', async () => {
    const mediaPath = 'gs://bucket/123/photo/new.jpg';
    const firstSignedUrl = buildSignedUrl('123/photo/new.jpg', Date.now(), 900);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          urls: { [mediaPath]: firstSignedUrl },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const firstResult = await fetchMediaSignedUrls([mediaPath]);
    expect(firstResult[mediaPath]).toBe(firstSignedUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const secondResult = await fetchMediaSignedUrls([mediaPath]);
    expect(secondResult[mediaPath]).toBe(firstSignedUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('refreshes expired cached entries from the backend', async () => {
    const mediaPath = 'gs://bucket/123/photo/expired.jpg';
    const expiredSignedUrl = buildSignedUrl(
      '123/photo/expired.jpg',
      Date.now() - 30 * 60 * 1000,
      60
    );
    const refreshedSignedUrl = buildSignedUrl('123/photo/expired.jpg', Date.now(), 900);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          urls: { [mediaPath]: refreshedSignedUrl },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    seedMediaSignedUrls({ [mediaPath]: expiredSignedUrl });
    const result = await fetchMediaSignedUrls([mediaPath]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result[mediaPath]).toBe(refreshedSignedUrl);
  });

  it('deduplicates concurrent fetches for the same media path', async () => {
    const mediaPath = 'gs://bucket/123/photo/concurrent.jpg';
    const signedUrl = buildSignedUrl('123/photo/concurrent.jpg', Date.now(), 900);
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchPromise);

    const firstCall = fetchMediaSignedUrls([mediaPath]);
    const secondCall = fetchMediaSignedUrls([mediaPath]);

    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      new Response(
        JSON.stringify({
          urls: { [mediaPath]: signedUrl },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
    expect(firstResult[mediaPath]).toBe(signedUrl);
    expect(secondResult[mediaPath]).toBe(signedUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('normalizes gs and https storage aliases for cache reads', () => {
    const gsPath = 'gs://bucket/123/photo/alias.jpg';
    const httpsPath = 'https://storage.googleapis.com/assistant-media-staging/123/photo/alias.jpg';
    const signedUrl = buildSignedUrl('123/photo/alias.jpg', Date.now(), 900);

    seedMediaSignedUrls({ [gsPath]: signedUrl });

    const cached = readCachedMediaSignedUrls([httpsPath]);
    expect(cached[httpsPath]).toBe(signedUrl);
  });
});
