/**
 * Batched signed-URL resolution for profile media (team faces, organization
 * logos, workspace photos).
 *
 * These images are stored as `gs://` URIs and need a short-lived signed URL
 * before a browser can render them. Resolving one per avatar component costs
 * two serial round-trips per face — sign, then download — and repeats on every
 * mount, which is why faces inside an unmounting surface (the teammate
 * switcher popover) visibly trickled in each time it opened.
 *
 * Resolution here is cache-first against the shared `mediaSignedUrlCache`, so
 * a warm path resolves synchronously with no network at all, and concurrent
 * callers for the same URI share one in-flight request.
 *
 * Note this targets `/api/storage/signed-urls`, which passes the full `gs://`
 * URI through to Orchestra and is therefore bucket-agnostic. The assistant
 * media resolver in `./assistant` re-derives the bucket from the environment
 * and only works for the assistant media bucket — it is not interchangeable.
 */

import {
  clearMediaSignedUrlInFlight,
  getMediaSignedUrlInFlight,
  readCachedMediaSignedUrls,
  seedMediaSignedUrls,
  setMediaSignedUrlInFlight,
} from './mediaSignedUrlCache';

/** Matches MAX_BATCH_SIZE in `/api/storage/signed-urls`. */
const MAX_BATCH_SIZE = 200;

function signableUris(urls: ReadonlyArray<string | null | undefined>): string[] {
  return Array.from(new Set(urls.filter((url): url is string => !!url && url.startsWith('gs://'))));
}

/**
 * Signed URLs already cached for the supplied `gs://` URIs, keyed by URI.
 * Pure read — safe in a render or a state initialiser, so a remounting avatar
 * paints its face on the first frame instead of flashing its fallback.
 */
export function readProfileSignedUrls(
  urls: ReadonlyArray<string | null | undefined>
): Record<string, string> {
  return readCachedMediaSignedUrls(signableUris(urls));
}

async function requestSignedUrls(gsUrls: string[]): Promise<Record<string, string>> {
  try {
    const response = await fetch('/api/storage/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      body: JSON.stringify({ gs_urls: gsUrls }),
    });
    if (!response.ok) return {};

    const data = (await response.json()) as { urls?: Record<string, string> };
    const signedUrls = data.urls ?? {};
    seedMediaSignedUrls(signedUrls);
    return signedUrls;
  } catch (error) {
    // A face that fails to resolve renders its initials fallback, so a
    // transient network failure degrades to a placeholder rather than
    // breaking the surrounding list.
    console.error('Failed to resolve profile signed URLs:', error);
    return {};
  }
}

/**
 * Resolves `gs://` profile images to signed URLs, keyed by the original URI.
 * Non-`gs://` values are ignored — they need no signing and callers pass them
 * through untouched. Missing entries mean the image could not be resolved.
 */
export async function fetchProfileSignedUrls(
  urls: ReadonlyArray<string | null | undefined>
): Promise<Record<string, string>> {
  const uris = signableUris(urls);
  if (uris.length === 0) return {};

  const resolved = readCachedMediaSignedUrls(uris);
  const pending: string[] = [];
  const settled: Promise<void>[] = [];

  for (const uri of uris) {
    if (resolved[uri]) continue;

    const inFlight = getMediaSignedUrlInFlight(uri);
    if (inFlight) {
      settled.push(
        inFlight.then((signedUrl) => {
          if (signedUrl) resolved[uri] = signedUrl;
        })
      );
      continue;
    }
    pending.push(uri);
  }

  for (let start = 0; start < pending.length; start += MAX_BATCH_SIZE) {
    const batch = pending.slice(start, start + MAX_BATCH_SIZE);
    const request = requestSignedUrls(batch);

    batch.forEach((uri) => {
      setMediaSignedUrlInFlight(
        uri,
        request.then((signedUrls) => signedUrls[uri] ?? null)
      );
    });

    settled.push(
      request.then((signedUrls) => {
        batch.forEach((uri) => {
          const signedUrl = signedUrls[uri];
          if (signedUrl) resolved[uri] = signedUrl;
          clearMediaSignedUrlInFlight(uri);
        });
      })
    );
  }

  await Promise.all(settled);
  return resolved;
}
