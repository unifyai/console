import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';
import { getAdaptersBaseUrl, isStagingEnvironment } from '@/utils/assistants/api-utils';

/**
 * POST /api/assistant/attachment
 *
 * Upload an attachment for a Unify message.
 * Forwards the file to the Communication Adapters which:
 * 1. Validates file type and size
 * 2. Uploads to GCS bucket
 * 3. Returns metadata including gs_url for transcript logging
 *
 * Request: multipart/form-data with:
 * - file: The file to upload
 * - assistant_id: The assistant ID
 *
 * Response: {
 *   id: string,
 *   filename: string,
 *   gs_url: string,
 *   signed_url: string,
 *   content_type: string,
 *   size_bytes: number
 * }
 */
export async function POST(request: NextRequest) {
  const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
  if (!ADMIN_KEY) {
    console.error('[API /api/assistant/attachment] ORCHESTRA_ADMIN_KEY is not set.');
    return internalError('ORCHESTRA_ADMIN_KEY not set');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return badRequest('Invalid form data');
  }

  const file = formData.get('file') as File | null;
  const assistantId = formData.get('assistant_id') as string | null;
  const deployEnv = formData.get('deploy_env') as string | null;

  if (!file) {
    return badRequest('Missing file');
  }

  if (!assistantId) {
    return badRequest('Missing assistant_id');
  }

  // Build the URL for the Communication Adapters
  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const isStaging = isStagingEnvironment(orchestraUrl);
  const localAdaptersUrl = process.env.LOCAL_ADAPTERS_URL;
  const adaptersBaseUrl = getAdaptersBaseUrl({ deployEnv, isStaging, localAdaptersUrl });
  const webhookUrl = `${adaptersBaseUrl}/unify/attachment`;

  // Forward the file to Communication Adapters
  const forwardFormData = new FormData();
  forwardFormData.append('file', file);
  forwardFormData.append('assistant_id', assistantId);

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ADMIN_KEY}`,
        // Don't set Content-Type - fetch will set it with boundary for FormData
      },
      body: forwardFormData,
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(
        `[API /api/assistant/attachment] Webhook error (${webhookResponse.status}): ${errorText}`
      );

      // Parse error for user-friendly message
      let errorDetail = 'Upload failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error || errorJson.detail || errorDetail;
      } catch {
        errorDetail = errorText || errorDetail;
      }

      return NextResponse.json({ detail: errorDetail }, { status: webhookResponse.status });
    }

    // Return the upload response with metadata
    const uploadResponse = await webhookResponse.json();
    return NextResponse.json(uploadResponse, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/assistant/attachment] Error calling webhook:', errorMessage);
    return NextResponse.json(
      { detail: `Upload connection error: ${errorMessage}` },
      { status: 502 }
    );
  }
}
