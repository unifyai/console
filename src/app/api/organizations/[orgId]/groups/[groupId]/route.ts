import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string; groupId: string }>;
}

function parseIds(
  orgId: string,
  groupId: string
): { organizationId: number; group: number } | null {
  const organizationId = parseInt(orgId, 10);
  const group = parseInt(groupId, 10);
  if (isNaN(organizationId) || isNaN(group)) return null;
  return { organizationId, group };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, groupId } = await params;
  const ids = parseIds(orgId, groupId);
  if (!ids) {
    return badRequest('Invalid organization or group ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${ids.organizationId}/groups/${ids.group}`,
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
      return NextResponse.json(data || { detail: 'Failed to fetch group' }, {
        status: response.status,
      });
    }
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch group' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { orgId, groupId } = await params;
  const ids = parseIds(orgId, groupId);
  if (!ids) {
    return badRequest('Invalid organization or group ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body: {
    name?: string | null;
    icon?: string | null;
    userIds?: string[] | null;
    assistantIds?: number[] | null;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const payload: Record<string, unknown> = {};
  if (body.name !== undefined) payload.name = body.name;
  // A present-but-null icon clears it, so absence is the only thing that
  // leaves the stored icon alone.
  if (body.icon !== undefined) payload.icon = body.icon;
  if (body.userIds !== undefined) payload.user_ids = body.userIds;
  if (body.assistantIds !== undefined) payload.assistant_ids = body.assistantIds;

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${ids.organizationId}/groups/${ids.group}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to update group' }, {
        status: response.status,
      });
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { orgId, groupId } = await params;
  const ids = parseIds(orgId, groupId);
  if (!ids) {
    return badRequest('Invalid organization or group ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${ids.organizationId}/groups/${ids.group}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return NextResponse.json(data || { detail: 'Failed to delete group' }, {
        status: response.status,
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ detail: 'Failed to delete group' }, { status: 500 });
  }
}
