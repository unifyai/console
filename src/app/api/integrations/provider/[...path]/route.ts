import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { buildOrchestraV0Url } from '../../_utils/orchestra-url';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type UnknownRecord = Record<string, unknown>;

const BUILTINS_PROJECT = 'Builtins';
const BUILTINS_APPS_CONTEXT = 'Integrations/Apps';
const BUILTINS_TOOLS_CONTEXT = 'Integrations/Tools';

class OrchestraFetchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'OrchestraFetchError';
    this.status = status;
  }
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function quoteFilterValue(value: string): string {
  return JSON.stringify(value);
}

async function fetchOrchestraJson<T>(
  apiKey: string,
  path: string,
  params?: URLSearchParams
): Promise<T> {
  const target = buildOrchestraV0Url(path);
  params?.forEach((value, key) => target.searchParams.append(key, value));
  const response = await fetch(target, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = asString(asRecord(parsed).detail) || `Request failed (${response.status})`;
    throw new OrchestraFetchError(response.status, detail);
  }
  return parsed as T;
}

function isMissingBuiltinsCatalog(error: unknown): boolean {
  if (!(error instanceof OrchestraFetchError)) return false;
  return error.status === 404 || error.status === 422;
}

async function fetchBuiltinsLogs(
  apiKey: string,
  context: string,
  params: URLSearchParams
): Promise<UnknownRecord[]> {
  const query = new URLSearchParams(params);
  query.set('project_name', BUILTINS_PROJECT);
  query.set('context', context);
  const data = await fetchOrchestraJson<{ logs?: Array<{ entries?: UnknownRecord }> }>(
    apiKey,
    '/logs',
    query
  ).catch((error: unknown) => {
    if (isMissingBuiltinsCatalog(error)) return { logs: [] };
    throw error;
  });
  return asArray(asRecord(data).logs).map((item) => asRecord(asRecord(item).entries));
}

async function fetchBuiltinsAppRows(apiKey: string): Promise<UnknownRecord[]> {
  const params = new URLSearchParams({
    limit: '5000',
    offset: '0',
  });
  return fetchBuiltinsLogs(apiKey, BUILTINS_APPS_CONTEXT, params);
}

async function fetchBuiltinsToolRows(
  apiKey: string,
  canonicalSlug: string
): Promise<UnknownRecord[]> {
  const params = new URLSearchParams({
    limit: '5000',
    offset: '0',
    filter_expr: `canonical_app_slug == ${quoteFilterValue(canonicalSlug)}`,
  });
  return fetchBuiltinsLogs(apiKey, BUILTINS_TOOLS_CONTEXT, params);
}

function ownerQueryFromRequest(request: NextRequest): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ['owner_scope', 'org_id', 'team_id', 'user_id', 'assistant_id']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null) params.set(key, value);
  }
  return params;
}

async function fetchConnectionsBySlug(
  apiKey: string,
  request: NextRequest
): Promise<Map<string, UnknownRecord>> {
  const params = ownerQueryFromRequest(request);
  const data = await fetchOrchestraJson<UnknownRecord[] | { connections?: UnknownRecord[] }>(
    apiKey,
    '/integrations/connections',
    params
  );
  const connections = Array.isArray(data) ? data : asArray(asRecord(data).connections);
  const bySlug = new Map<string, UnknownRecord>();
  for (const item of connections) {
    const connection = asRecord(item);
    if (connection.status === 'disconnected') continue;
    const slug = asString(connection.canonical_app_slug);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, connection);
  }
  return bySlug;
}

function connectionStatusFor(app: UnknownRecord, connection: UnknownRecord | undefined): string {
  if (connection) return asString(connection.status) || 'connected';
  if (app.source_type === 'native') return 'configured';
  return 'not_connected';
}

function statusGroupFor(status: string): 'connected' | 'needs_attention' | 'not_connected' {
  if (status === 'connected' || status === 'configured') return 'connected';
  if (
    status === 'pending' ||
    status === 'missing_scope' ||
    status === 'missing_secrets' ||
    status === 'needs_reconnect' ||
    status === 'expired' ||
    status === 'revoked' ||
    status === 'error'
  ) {
    return 'needs_attention';
  }
  return 'not_connected';
}

function mergeConnection(app: UnknownRecord, connection: UnknownRecord | undefined): UnknownRecord {
  const status = connectionStatusFor(app, connection);
  return {
    ...app,
    connection_status: status,
    connection_id: connection?.connection_id ?? connection?.id ?? null,
    external_account_label: connection?.external_account_label ?? connection?.account_label ?? null,
  };
}

function appMatchesQuery(app: UnknownRecord, query: string): boolean {
  if (!query) return true;
  const haystack = [
    app.display_name,
    app.canonical_app_slug,
    app.description,
    app.category,
    app.source_label,
  ]
    .map((value) => asString(value).toLowerCase())
    .join(' ');
  return haystack.includes(query.toLowerCase());
}

function appFacets(apps: UnknownRecord[]) {
  const sourceType = { native: 0, third_party: 0 };
  const status = {
    connected: 0,
    configured: 0,
    pending: 0,
    missing_scope: 0,
    missing_secrets: 0,
    needs_reconnect: 0,
    expired: 0,
    revoked: 0,
    error: 0,
    not_connected: 0,
  };
  const statusGroup = { connected: 0, needs_attention: 0, not_connected: 0 };
  for (const app of apps) {
    const source = app.source_type === 'native' ? 'native' : 'third_party';
    sourceType[source] += 1;
    const appStatus = (asString(app.connection_status) || 'not_connected') as keyof typeof status;
    if (appStatus in status) status[appStatus] += 1;
    statusGroup[statusGroupFor(appStatus)] += 1;
  }
  return {
    total: apps.length,
    source_type: sourceType,
    status,
    status_group: statusGroup,
  };
}

async function getBuiltinsApps(apiKey: string, request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100');
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? '0');
  const query = request.nextUrl.searchParams.get('query')?.trim() ?? '';
  const sourceType = request.nextUrl.searchParams.get('source_type');
  const statuses = request.nextUrl.searchParams.getAll('status');
  const statusGroups = request.nextUrl.searchParams.getAll('status_group');
  const [apps, connectionsBySlug] = await Promise.all([
    fetchBuiltinsAppRows(apiKey),
    fetchConnectionsBySlug(apiKey, request),
  ]);
  const merged = apps.map((app) =>
    mergeConnection(app, connectionsBySlug.get(asString(app.canonical_app_slug)))
  );
  const filtered = merged.filter((app) => {
    const status = asString(app.connection_status) || 'not_connected';
    if (sourceType && app.source_type !== sourceType) return false;
    if (statuses.length > 0 && !statuses.includes(status)) return false;
    if (statusGroups.length > 0 && !statusGroups.includes(statusGroupFor(status))) return false;
    return appMatchesQuery(app, query);
  });
  return NextResponse.json({
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
    facets: appFacets(merged.filter((app) => appMatchesQuery(app, query))),
    catalog_version: null,
    generated_at: null,
  });
}

async function getBuiltinsAppDetail(apiKey: string, request: NextRequest, canonicalSlug: string) {
  const [apps, tools, connectionsBySlug] = await Promise.all([
    fetchBuiltinsAppRows(apiKey),
    fetchBuiltinsToolRows(apiKey, canonicalSlug),
    fetchConnectionsBySlug(apiKey, request),
  ]);
  const app = apps.find((item) => item.canonical_app_slug === canonicalSlug);
  if (!app) return NextResponse.json({ detail: 'Integration app not found' }, { status: 404 });
  return NextResponse.json({
    ...mergeConnection(app, connectionsBySlug.get(canonicalSlug)),
    tools,
  });
}

async function proxy(request: NextRequest, context: RouteContext) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const { path } = await context.params;
  if (request.method === 'GET' && path[0] === 'apps') {
    if (path.length === 1) return getBuiltinsApps(apiKey, request);
    if (path.length === 2) return getBuiltinsAppDetail(apiKey, request, path[1]);
  }

  const target = buildOrchestraV0Url(`/integrations/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

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
