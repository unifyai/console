import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';

/**
 * Path marker for URLs minted by Orchestra's local bucket service
 * (self-host filesystem storage). Those URLs point at the in-cluster
 * Orchestra host, which the browser cannot reach, so they are rewritten
 * to the same-origin /api/storage/content proxy.
 */
const ORCHESTRA_LOCAL_OBJECT_PATH = '/v0/storage/local/';

/**
 * POST /api/storage/signed-url
 *
 * Generate a signed URL from a gs:// URL for browser access.
 * Used when displaying historical attachments from transcripts.
 *
 * Request: { gs_url: string, download?: boolean }
 * Response: { signed_url: string }
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return badRequest('Invalid JSON body');
  }

  const { gs_url, download, filename } = requestBody;

  if (!gs_url) {
    return badRequest('Missing gs_url');
  }

  // Validate gs:// URL format
  if (!gs_url.startsWith('gs://')) {
    return badRequest('Invalid gs_url format - must start with gs://');
  }

  // Forward to Orchestra's signed URL endpoint using user's API key
  const orchestraUrl = process.env.ORCHESTRA_URL || 'http://localhost:8000';

  try {
    const response = await fetch(`${orchestraUrl}/v0/storage/signed-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gcs_uri: gs_url,
        download: download ?? false,
        filename: filename ?? null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[API /api/storage/signed-url] Orchestra error (${response.status}): ${errorText}`
      );

      // Parse error for user-friendly message
      let errorDetail = 'Failed to generate signed URL';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        errorDetail = errorText || errorDetail;
      }

      return NextResponse.json({ detail: errorDetail }, { status: response.status });
    }

    const data = await response.json();

    if (
      typeof data.signed_url === 'string' &&
      data.signed_url.includes(ORCHESTRA_LOCAL_OBJECT_PATH)
    ) {
      const proxyParams = new URLSearchParams({ gs_url });
      if (download) proxyParams.set('download', '1');
      if (filename) proxyParams.set('filename', filename);
      return NextResponse.json(
        { signed_url: `/api/storage/content?${proxyParams.toString()}` },
        { status: 200 }
      );
    }

    return NextResponse.json({ signed_url: data.signed_url }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/storage/signed-url] Error calling Orchestra:', errorMessage);
    return NextResponse.json(
      { detail: `Storage connection error: ${errorMessage}` },
      { status: 502 }
    );
  }
}
