import { NextRequest, NextResponse } from 'next/server';
import { transformBody } from '../../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL || 'http://localhost:8000'}/v0`;

export async function POST(request: NextRequest, { params }: { params: { projectName: string } }) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Check if this is a template operation
  const isExportTemplate = searchParams.has('export_template');
  const isImportTemplate = searchParams.has('import_template');

  let endpoint = '/project';
  let requestBody;

  if (isExportTemplate) {
    endpoint = '/project/export_template';
    const body = await request.json();
    requestBody = JSON.stringify(transformBody(body));
  } else if (isImportTemplate) {
    endpoint = '/project/import_template';
    const body = await request.json();
    requestBody = JSON.stringify(transformBody(body));
  } else {
    // Regular project creation - preserve original behavior
    requestBody = JSON.stringify({ name: params.projectName });
  }

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: requestBody,
  });

  // Parse and transform response from snake_case to camelCase
  const text = await res.text();
  if (!text) {
    return NextResponse.json({ success: true }, { status: res.status });
  }
  const responseData = JSON.parse(text);
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectName: string } }
) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const res = await fetch(`${baseUrl}/project/${params.projectName}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // Parse and transform response from snake_case to camelCase
  const text = await res.text();
  if (!text) {
    return NextResponse.json({ success: true }, { status: res.status });
  }
  const responseData = JSON.parse(text);
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}

export async function PATCH(request: NextRequest, { params }: { params: { projectName: string } }) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const bodyObj = await request.json();
  const snakeBody = transformBody(bodyObj);

  const res = await fetch(`${baseUrl}/project/${params.projectName}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(snakeBody),
  });

  // Parse and transform response from snake_case to camelCase
  const responseData = await res.json();
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}
