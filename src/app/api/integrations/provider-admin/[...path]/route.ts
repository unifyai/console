import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { buildOrchestraV0Url, getComposioOAuthCallbackUrl } from '../../_utils/orchestra-url';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const callerApiKey = await getApiKeyFromRequest(request);
  if (!callerApiKey) return unauthorized();

  const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
  if (!adminKey) return unauthorized('Unauthorized - missing Orchestra admin key');

  const { path } = await context.params;
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
    let bodyText = await request.text();
    if (
      request.method === 'PUT' &&
      path.length === 3 &&
      path[0] === 'backends' &&
      path[2] === 'custom-auth' &&
      bodyText
    ) {
      try {
        const payload = JSON.parse(bodyText) as Record<string, unknown>;
        if (!payload.oauth_redirect_uri) {
          payload.oauth_redirect_uri = getComposioOAuthCallbackUrl();
          bodyText = JSON.stringify(payload);
        }
      } catch {
        // Pass through malformed bodies unchanged so Orchestra can reject them.
      }
    }
    init.body = bodyText;
  }

  const response = await fetch(target, init);
  const text = await response.text();
  // Null-body statuses (204/205/304) must not carry a body — passing even an
  // empty string to the Response constructor throws a TypeError, which would
  // turn a successful upstream 204 (e.g. DELETE custom-auth) into a proxy 500.
  const isNullBodyStatus =
    response.status === 204 || response.status === 205 || response.status === 304;
  return new NextResponse(isNullBodyStatus || text === '' ? null : text, {
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

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
