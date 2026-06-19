import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

// Transfer project to organization or personal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectName: string }> }
) {
  const { projectName } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const url = new URL(request.url);
  const transferType = url.searchParams.get('type');

  // The projectName here is actually the project ID for transfer operations
  const projectId = parseInt(projectName, 10);

  try {
    if (transferType === 'organization') {
      const body = await request.json();
      const organizationId = body.organizationId;

      if (!organizationId) {
        return badRequest('organizationId is required');
      }

      const { data, error, response } = await client.POST(
        '/v0/project/{project_id}/transfer-to-organization',
        {
          params: {
            path: { project_id: projectId },
          },
          body: { organization_id: organizationId },
        }
      );

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else if (transferType === 'personal') {
      const { data, error, response } = await client.POST(
        '/v0/project/{project_id}/transfer-to-personal',
        {
          params: {
            path: { project_id: projectId },
          },
        }
      );

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else {
      return badRequest("Invalid transfer type. Use 'organization' or 'personal'");
    }
  } catch (e: unknown) {
    console.error('Transfer error:', e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to transfer project' },
      { status: 500 }
    );
  }
}
