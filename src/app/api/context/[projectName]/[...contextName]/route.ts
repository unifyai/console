import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

// DELETE a single context (supports nested names)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectName: string; contextName: string[] } }
) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const contextPath = encodeURIComponent((params.contextName || []).join('/'));
  return await fetch(`${baseUrl}/project/${params.projectName}/contexts/${contextPath}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

// PATCH rename a single context (supports nested names)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectName: string; contextName: string[] } }
) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const body = await request.json();
  const contextPath = encodeURIComponent((params.contextName || []).join('/'));
  return await fetch(`${baseUrl}/project/${params.projectName}/contexts/${contextPath}/rename`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(camelToSnakeObject(body)),
  });
}
