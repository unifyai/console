import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';
import { getAdaptersBaseUrl } from '@/utils/assistants/api-utils';
import { getCurrentUser } from '@/lib/user/user';
import { mockSimulationEnabled } from '@/lib/simulation/config';

/**
 * POST /api/org-chat/attachment
 *
 * Upload an attachment for org DM / team chat. Forwards to adapters
 * `/unify/attachment` using a synthetic storage key `org-{orgId}`.
 *
 * The forward carries the platform admin key, so the caller's membership
 * of `org_id` must be established here before anything is uploaded into
 * that org's storage prefix.
 */
export async function POST(request: NextRequest) {
  if (mockSimulationEnabled()) {
    return NextResponse.json(
      {
        id: `mock-org-attachment-${Date.now()}`,
        filename: 'mock-attachment',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        gs_url: 'gs://bucket/org-attachment',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        signed_url: '',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        content_type: 'application/octet-stream',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        size_bytes: 0,
      },
      { status: 200 }
    );
  }

  const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
  if (!ADMIN_KEY) {
    console.error('[API /api/org-chat/attachment] ORCHESTRA_ADMIN_KEY is not set.');
    return internalError('ORCHESTRA_ADMIN_KEY not set');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest('Invalid form data');
  }

  const file = formData.get('file') as File | null;
  const orgId = formData.get('org_id') as string | null;

  if (!file) {
    return badRequest('Missing file');
  }
  if (!orgId) {
    return badRequest('Missing org_id');
  }

  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid org_id format. Must be an integer.');
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }
  const isMember = (user.organizations ?? []).some((org) => org.id === organizationId);
  if (!isMember) {
    return NextResponse.json(
      { detail: 'You are not a member of this organization' },
      { status: 403 }
    );
  }

  const localAdaptersUrl = process.env.LOCAL_ADAPTERS_URL;
  const adaptersBaseUrl = getAdaptersBaseUrl({ localAdaptersUrl });
  const webhookUrl = `${adaptersBaseUrl}/unify/attachment`;

  const forwardFormData = new FormData();
  forwardFormData.append('file', file);
  // Reuse the assistant attachment storage path with an org-scoped key,
  // built from the parsed id so the prefix matches the membership check.
  forwardFormData.append('assistant_id', `org-${organizationId}`);

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ADMIN_KEY}`,
      },
      body: forwardFormData,
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(
        `[API /api/org-chat/attachment] Webhook error (${webhookResponse.status}): ${errorText}`
      );
      let errorDetail = 'Upload failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error || errorJson.detail || errorDetail;
      } catch {
        errorDetail = errorText || errorDetail;
      }
      return NextResponse.json({ detail: errorDetail }, { status: webhookResponse.status });
    }

    const uploadResponse = await webhookResponse.json();
    return NextResponse.json(uploadResponse, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/org-chat/attachment] Error calling webhook:', errorMessage);
    return NextResponse.json(
      { detail: `Upload connection error: ${errorMessage}` },
      { status: 502 }
    );
  }
}
