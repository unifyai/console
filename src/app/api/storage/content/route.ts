import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';

/**
 * Storage content proxy.
 *
 * Fetches raw file content for a gs:// object via an Orchestra-minted
 * signed URL and returns it as binary. This server-side proxy avoids CORS
 * issues when fetching signed URLs from the browser, and is the only
 * browser-reachable path for storage backends whose URLs resolve to
 * in-cluster hosts (Orchestra's local bucket service in self-host).
 *
 * POST: { gs_url: string } → raw bytes with Content-Type.
 * GET:  ?gs_url=...&download=1&filename=... → raw bytes, optionally with
 *       an attachment Content-Disposition. Usable directly as an <img>
 *       src or download anchor href.
 */

async function fetchStorageObject(
  apiKey: string,
  gsUrl: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | NextResponse> {
  const orchestraUrl = process.env.ORCHESTRA_URL || 'http://localhost:8000';

  const signedUrlRes = await fetch(`${orchestraUrl}/v0/storage/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gcs_uri: gsUrl, download: false }),
  });

  if (!signedUrlRes.ok) {
    const errorText = await signedUrlRes.text();
    console.error(
      `[API /api/storage/content] Orchestra signed-url error (${signedUrlRes.status}): ${errorText}`
    );
    return NextResponse.json(
      { detail: 'Failed to get signed URL' },
      { status: signedUrlRes.status }
    );
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention -- API field
  const { signed_url } = await signedUrlRes.json();

  const contentRes = await fetch(signed_url);
  if (!contentRes.ok) {
    console.error(`[API /api/storage/content] storage fetch error (${contentRes.status})`);
    return NextResponse.json({ detail: 'Failed to fetch content from storage' }, { status: 502 });
  }

  return {
    buffer: await contentRes.arrayBuffer(),
    contentType: contentRes.headers.get('Content-Type') || 'application/octet-stream',
  };
}

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention -- API field
  const { gs_url } = body;
  if (!gs_url || !gs_url.startsWith('gs://')) {
    return badRequest('Missing or invalid gs_url');
  }

  const result = await fetchStorageObject(apiKey, gs_url);
  if (result instanceof NextResponse) return result;

  return new NextResponse(result.buffer, {
    status: 200,
    headers: { 'Content-Type': result.contentType },
  });
}

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const gsUrl = request.nextUrl.searchParams.get('gs_url');
  if (!gsUrl || !gsUrl.startsWith('gs://')) {
    return badRequest('Missing or invalid gs_url');
  }

  const result = await fetchStorageObject(apiKey, gsUrl);
  if (result instanceof NextResponse) return result;

  const headers: Record<string, string> = { 'Content-Type': result.contentType };
  if (request.nextUrl.searchParams.get('download') === '1') {
    const rawFilename =
      request.nextUrl.searchParams.get('filename') || gsUrl.split('/').pop() || 'download';
    const safeFilename = rawFilename.replace(/["\r\n\u0000/\\]/g, '_');
    headers['Content-Disposition'] = `attachment; filename="${safeFilename}"`;
  }

  return new NextResponse(result.buffer, { status: 200, headers });
}
