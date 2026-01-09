import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function GET(request: NextRequest, { params }: { params: { project: string } }) {
  const { project } = params;

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.GET('/v0/project/{project_name}', {
      params: {
        path: { project_name: project },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { project: string } }) {
  const { project } = params;

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const bodyObj = await request.json();

  try {
    const { data, error, response } = await client.PATCH('/v0/project/{project_name}', {
      params: {
        path: { project_name: project },
      },
      body: bodyObj,
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
