import { NextRequest, NextResponse } from 'next/server';
import { buildCacheControl } from '../../_utils/cacheResponse';
import { transformBody } from '../../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest, { params }: { params: { projectName: string } }) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const res = await fetch(`${baseUrl}/project/${params.projectName}/contexts`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  // Parse and transform response from snake_case to camelCase
  const responseData = await res.json();
  const camelCaseData = snakeToCamelObject(responseData);

  if (!res.ok) {
    return NextResponse.json(camelCaseData, { status: res.status });
  }

  // Cache contexts list for 5 minutes - rarely changes
  const cacheControl = buildCacheControl('LONG');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }

  return NextResponse.json(camelCaseData, { status: 200, headers });
}

export async function POST(request: NextRequest, { params }: { params: { projectName: string } }) {
  const body = await request.json();

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Transform body to snake_case for Orchestra
  const snakeBody = transformBody(body);

  const res = await fetch(`${baseUrl}/project/${params.projectName}/contexts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snakeBody),
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

  const res = await fetch(`${baseUrl}/project/${params.projectName}/contexts`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
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
