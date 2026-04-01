import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';

/**
 * POST /api/storage/content
 *
 * Fetches raw file content from a GCS object via signed URL and returns it
 * as binary. This server-side proxy avoids CORS issues that arise when
 * fetching GCS signed URLs directly from the browser via fetch().
 *
 * Request: { gs_url: string }
 * Response: raw bytes with appropriate Content-Type
 */
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

  const orchestraUrl = process.env.ORCHESTRA_URL || 'http://localhost:8000';

  const signedUrlRes = await fetch(`${orchestraUrl}/v0/storage/signed-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gcs_uri: gs_url, download: false }),
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
    console.error(`[API /api/storage/content] GCS fetch error (${contentRes.status})`);
    return NextResponse.json({ detail: 'Failed to fetch content from storage' }, { status: 502 });
  }

  const buffer = await contentRes.arrayBuffer();
  const contentType = contentRes.headers.get('Content-Type') || 'application/octet-stream';

  return new NextResponse(buffer, {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}
