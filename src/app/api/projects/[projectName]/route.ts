import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function POST(request: NextRequest, { params }: { params: { projectName: string } }) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  // Check if this is a template operation
  const isExportTemplate = searchParams.has('export_template');
  const isImportTemplate = searchParams.has('import_template');

  try {
    if (isExportTemplate) {
      const body = await request.json();
      const { data, error, response } = await client.POST('/v0/project/export_template', {
        body: body,
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else if (isImportTemplate) {
      const body = await request.json();
      const { data, error, response } = await client.POST('/v0/project/import_template', {
        body: body,
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else {
      // Regular project creation with name from path
      const { data, error, response } = await client.POST('/v0/project', {
        body: { name: params.projectName, is_versioned: false },
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data ?? { success: true }, { status: response.status });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectName: string } }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.DELETE('/v0/project/{project_name}', {
      params: {
        path: { project_name: params.projectName },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { projectName: string } }) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const body = await request.json();

  try {
    const { data, error, response } = await client.PATCH('/v0/project/{project_name}', {
      params: {
        path: { project_name: params.projectName },
      },
      body: body,
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
  }
}
