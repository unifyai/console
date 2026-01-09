import { NextRequest, NextResponse } from 'next/server';
import { buildCacheControl } from '../_utils/cacheResponse';
import { transformQueryParams, transformBody } from '../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Check if we're getting tab by ID, by parent+name, or listing tabs
  const hasId = searchParams.has('tabId');
  const hasInterfaceId = searchParams.has('interfaceId');
  const hasName = searchParams.has('name');

  // Determine endpoint based on parameters
  let endpoint = '/tab/';

  // If we have an interfaceId but no id or name, we're listing tabs
  if (hasInterfaceId && !hasId && !hasName) {
    endpoint = '/tab/list';
  }

  // Transform query params to snake_case for Orchestra
  const snakeQuery = transformQueryParams(url);

  // Let the backend handle the routing based on the query parameters
  const res = await fetch(`${baseUrl}${endpoint}${snakeQuery}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
    },
  });

  // Parse and transform response from snake_case to camelCase
  const responseData = await res.json();
  const camelCaseData = snakeToCamelObject(responseData);

  if (!res.ok) {
    return NextResponse.json(camelCaseData, { status: res.status });
  }

  // Cache tab data for 60 seconds
  const cacheControl = buildCacheControl('MEDIUM');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }

  return NextResponse.json(camelCaseData, { status: 200, headers });
}

export async function POST(request: NextRequest) {
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

  let endpoint = '/tab/';

  if (isExportTemplate) {
    endpoint = '/tab/export_template';
  } else if (isImportTemplate) {
    endpoint = '/tab/import_template';
  }

  const body = await request.json();

  // Transform body to snake_case for Orchestra
  const snakeBody = transformBody(body);

  // For POST, we always create a new resource, so the endpoint is fixed
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snakeBody),
  });

  // Parse and transform response from snake_case to camelCase
  const responseData = await res.json();
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const url = new URL(request.url);

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Transform to snake_case for Orchestra
  const snakeQuery = transformQueryParams(url);
  const snakeBody = transformBody(body);

  // Pass all query parameters to allow both ID and parent+name updates
  const res = await fetch(`${baseUrl}/tab/${snakeQuery}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snakeBody),
  });

  // Parse and transform response from snake_case to camelCase
  const responseData = await res.json();
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Transform query params to snake_case for Orchestra
  const snakeQuery = transformQueryParams(url);

  // Pass all query parameters to allow both ID and parent+name deletion
  const res = await fetch(`${baseUrl}/tab/${snakeQuery}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
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

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const url = new URL(request.url);

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Transform to snake_case for Orchestra
  const snakeQuery = transformQueryParams(url);
  const snakeBody = transformBody(body);

  // Pass all query parameters to allow both ID and parent+name updates
  const res = await fetch(`${baseUrl}/tab/${snakeQuery}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snakeBody),
  });

  // Parse and transform response from snake_case to camelCase
  const responseData = await res.json();
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}
