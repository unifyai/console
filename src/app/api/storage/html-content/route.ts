import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';

/**
 * POST /api/storage/html-content
 *
 * Fetches HTML content from a GCS object via signed URL and returns it as JSON.
 * This server-side proxy avoids CORS and CSP frame-src issues that arise when
 * loading GCS signed URLs directly in iframes.
 *
 * Request: { gs_url: string }
 * Response: { html: string }
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
      `[API /api/storage/html-content] Orchestra signed-url error (${signedUrlRes.status}): ${errorText}`
    );
    return NextResponse.json(
      { detail: 'Failed to get signed URL' },
      { status: signedUrlRes.status }
    );
  }

  const { signed_url } = await signedUrlRes.json();

  const htmlRes = await fetch(signed_url);
  if (!htmlRes.ok) {
    console.error(
      `[API /api/storage/html-content] GCS fetch error (${htmlRes.status})`
    );
    return NextResponse.json(
      { detail: 'Failed to fetch HTML content from storage' },
      { status: 502 }
    );
  }

  const html = await htmlRes.text();
  return NextResponse.json({ html });
}
