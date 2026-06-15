import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { buildOrchestraV0Url } from '../../_utils/orchestra-url';

type RouteContext = {
  params: { path: string[] };
};

async function proxy(request: NextRequest, context: RouteContext) {
  const callerApiKey = await getApiKeyFromRequest(request);
  if (!callerApiKey) return unauthorized();

  const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
  if (!adminKey) return unauthorized('Unauthorized - missing Orchestra admin key');

  const { path } = context.params;
  const target = buildOrchestraV0Url(`/admin/integrations/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const init: RequestInit = {
    method: request.method,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const response = await fetch(target, init);
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
