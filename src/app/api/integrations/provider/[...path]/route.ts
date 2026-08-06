import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { buildOrchestraV0Url } from '../../_utils/orchestra-url';
import { mockSimulationEnabled } from '@/lib/simulation/config';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const { path } = await context.params;
  // Catalog reads — the app list and a single app's detail — are served from
  // Builtins logs (see getProviderIntegrationDetails), so the proxy refuses
  // them outright rather than silently forwarding to Orchestra. Deeper app
  // paths like `apps/<slug>/preferences` are real proxy state and pass through.
  const isCatalogGet =
    request.method === 'GET' &&
    ((path[0] === 'apps' && path.length <= 2) ||
      (path[0] === 'tools' &&
        (path.length === 1 || path[1] === 'search' || path[path.length - 1] === 'schema')));
  if (isCatalogGet) {
    return NextResponse.json(
      {
        detail:
          'Integration app and tool catalog reads use Builtins logs, not the Orchestra provider proxy.',
      },
      { status: 410 }
    );
  }
  const target = buildOrchestraV0Url(`/integrations/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  if (mockSimulationEnabled()) {
    const { simulationFetch } = await import('@/lib/simulation/dispatch');
    const init: RequestInit = {
      method: request.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.text();
    }
    const simResponse = await simulationFetch(target.toString(), init);
    const text = await simResponse.text();
    return new NextResponse(text, {
      status: simResponse.status,
      headers: {
        'Content-Type': simResponse.headers.get('Content-Type') || 'application/json',
      },
    });
  }

  const init: RequestInit = {
    method: request.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
