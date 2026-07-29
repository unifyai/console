/**
 * The single data-boundary seam for mock simulation mode.
 *
 * `simulationFetch` matches the `fetch` signature so the Orchestra clients and
 * fetch helpers can route through it when the flag is on. It resolves the active
 * scenario/workspace purely from the request's `Authorization` header (the mock
 * API key encodes both), so this module never touches `next/headers` and stays
 * safe to keep out of client bundles.
 *
 * Handlers return UI-shaped JSON; because the existing snake→camel response
 * pipeline is idempotent for already-camelCase keys, handlers can emit exactly
 * what the UI consumes. Unmatched paths return safe empty bodies so views
 * degrade to empty states instead of crashing.
 */

import { parseMockApiKey } from './config';
import { getScenarioById } from './scenario';
import type { MockScenario } from './types';
import { handlers } from './handlers';

export interface SimContext {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  body: unknown;
  scenario: MockScenario;
  /** 'personal' or an org id (as string). */
  workspaceId: string;
}

export interface SimResult {
  status?: number;
  json?: unknown;
  text?: string;
}

export interface SimHandler {
  /**
   * Method and path decide most handlers. The context is passed as well for the few
   * that share a path and differ by query: `/v0/logs` serves every context-backed
   * table, so a handler for one of them has to be told apart by its `context`
   * param rather than by the path alone.
   */
  match: (method: string, pathname: string, ctx: SimContext) => boolean;
  handle: (ctx: SimContext) => SimResult | Promise<SimResult>;
}

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) return input;
  return new Request(typeof input === 'string' ? input : input.toString(), init);
}

function resolveApiKey(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return request.headers.get('apiKey');
}

function toResponse(result: SimResult): Response {
  const status = result.status ?? 200;
  if (result.text !== undefined) {
    return new Response(result.text, {
      status,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return new Response(JSON.stringify(result.json ?? {}), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Default response for paths without a dedicated handler. */
function catchAll(ctx: SimContext): SimResult {
  if (ctx.method === 'GET') {
    // Lists are the common unmatched GET shape; an empty array is safe for the
    // `.map`/`Array.isArray` consumers and yields empty states in the UI.
    return { json: [] };
  }
  return { json: { info: 'ok' } };
}

export async function simulationFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const request = toRequest(input, init);
  const method = request.method.toUpperCase();

  let urlObj: URL;
  try {
    urlObj = new URL(request.url);
  } catch {
    urlObj = new URL(request.url, 'http://mock.local');
  }
  const pathname = urlObj.pathname;

  const parsed = parseMockApiKey(resolveApiKey(request));
  const scenario = getScenarioById(parsed?.scenarioId);
  const workspaceId = parsed?.workspaceId ?? 'personal';

  let body: unknown;
  try {
    const text = await request.clone().text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
  } catch {
    body = undefined;
  }

  const ctx: SimContext = {
    method,
    pathname,
    searchParams: urlObj.searchParams,
    body,
    scenario,
    workspaceId,
  };

  for (const handler of handlers) {
    if (handler.match(method, pathname, ctx)) {
      return toResponse(await handler.handle(ctx));
    }
  }

  return toResponse(catchAll(ctx));
}
