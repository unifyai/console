import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * Live (ringing/active) org call sessions visible to the caller. Used by the
 * app-level call engine to offer a rejoin after a page reload.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return NextResponse.json(
      { detail: 'Invalid organization ID format. Must be an integer.' },
      { status: 400 }
    );
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/calls/active`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to list active calls' }, {
        status: response.status,
      });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[org calls active] proxy error', error);
    return NextResponse.json({ detail: 'Failed to list active calls' }, { status: 502 });
  }
}
