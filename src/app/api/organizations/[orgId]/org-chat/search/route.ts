import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

/** GET /api/organizations/[orgId]/org-chat/search?q=&scope=dm|team|group&id= */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const scope = request.nextUrl.searchParams.get('scope')?.trim() ?? '';
  const id = request.nextUrl.searchParams.get('id')?.trim() ?? '';
  if (!q || (scope !== 'dm' && scope !== 'team' && scope !== 'group') || !id) {
    return badRequest('q, scope (dm|team|group), and id are required');
  }

  const searchParams = new URLSearchParams({ q, scope, id });
  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/org-chat/search?${searchParams.toString()}`,
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
      return NextResponse.json(data || { detail: 'Search failed' }, { status: response.status });
    }
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Search failed' }, { status: 500 });
  }
}
