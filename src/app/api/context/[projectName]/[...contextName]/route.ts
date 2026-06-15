import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

// DELETE a single context (supports nested names)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectName: string; contextName: string[] }> }
) {
  const { projectName, contextName } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const contextPath = (contextName || []).join('/');

  try {
    const { data, error, response } = await client.DELETE(
      '/v0/project/{project_name}/contexts/{context_name}',
      {
        params: {
          path: {
            project_name: projectName,
            context_name: contextPath,
          },
        },
      }
    );

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to delete context' },
      { status: 500 }
    );
  }
}

// PATCH rename a single context (supports nested names)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectName: string; contextName: string[] }> }
) {
  const { projectName, contextName } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const body = await request.json();
  const contextPath = (contextName || []).join('/');

  try {
    const { data, error, response } = await client.PATCH(
      '/v0/project/{project_name}/contexts/{context_name}/rename',
      {
        params: {
          path: {
            project_name: projectName,
            context_name: contextPath,
          },
        },
        body: body,
      }
    );

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to rename context' },
      { status: 500 }
    );
  }
}
