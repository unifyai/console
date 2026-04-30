import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';

/**
 * POST /api/storage/signed-urls
 *
 * Batched variant of `/api/storage/signed-url`. Resolves a list of
 * `gs://` URLs to short-lived HTTPS signed URLs in a single
 * request/response, fanning out to Orchestra's per-URL signed-url
 * endpoint in parallel.
 *
 * Why a batched endpoint at the Next layer instead of per-row
 * fetching from the browser: the Organizations page renders one
 * `MemberRow` per active member, each of which used to issue its own
 * `POST /api/storage/signed-url`. With a 50-member org that's 50
 * sequential round-trips bottlenecked by the browser's ~6 concurrent
 * connections to the Next host, producing visible avatar pop-in and
 * layout shift. Batching at this layer keeps the browser to a single
 * round-trip and lets Node concurrency handle the upstream fan-out.
 *
 * Request:  { gs_urls: string[] }   // up to MAX_BATCH_SIZE entries
 * Response: { urls: Record<string, string> }   // gs_url → signed_url
 */

const MAX_BATCH_SIZE = 200;

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
  const { gs_urls } = requestBody as { gs_urls?: unknown };
  if (!Array.isArray(gs_urls)) {
    return badRequest('Missing or invalid gs_urls (must be an array)');
  }

  // Filter to a unique set of valid `gs://` URLs and cap the batch.
  // Garbage entries are silently skipped — easier on the caller than
  // returning an error for a single bad row.
  const uniqueGsUrls = Array.from(
    new Set(
      gs_urls.filter((url): url is string => typeof url === 'string' && url.startsWith('gs://'))
    )
  );

  if (uniqueGsUrls.length === 0) {
    return NextResponse.json({ urls: {} });
  }

  if (uniqueGsUrls.length > MAX_BATCH_SIZE) {
    return badRequest(`gs_urls must contain at most ${MAX_BATCH_SIZE} entries`);
  }

  const orchestraUrl = process.env.ORCHESTRA_URL || 'http://localhost:8000';

  // Fan out to Orchestra in parallel. We deliberately swallow
  // per-URL errors and just omit them from the result map — the
  // client renders an avatar fallback for any missing entry, so a
  // single broken path shouldn't break the whole batch for the rest
  // of the org.
  const results = await Promise.all(
    uniqueGsUrls.map(async (gsUrl) => {
      try {
        const response = await fetch(`${orchestraUrl}/v0/storage/signed-url`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          // eslint-disable-next-line @typescript-eslint/naming-convention -- Orchestra expects snake_case
          body: JSON.stringify({ gcs_uri: gsUrl, download: false, filename: null }),
        });

        if (!response.ok) return [gsUrl, null] as const;
        const data = (await response.json()) as { signed_url?: string };
        return [gsUrl, data.signed_url ?? null] as const;
      } catch {
        return [gsUrl, null] as const;
      }
    })
  );

  const urls: Record<string, string> = {};
  for (const [gsUrl, signedUrl] of results) {
    if (signedUrl) urls[gsUrl] = signedUrl;
  }

  return NextResponse.json({ urls });
}
