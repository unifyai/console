import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import type {
  IntegrationApiKeySchema,
  IntegrationCapabilityGroup,
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationDefinition,
  IntegrationOwnerScope,
  IntegrationToolBehaviorHint,
  IntegrationScope,
  IntegrationSourceMetadata,
  IntegrationToolApprovalLevel,
  IntegrationToolPolicyResponse,
  IntegrationToolPreview,
  ProviderIntegrationConnectStartRequest,
  ProviderIntegrationConnectStartResponse,
} from '@/types/integrations';

type UnknownRecord = Record<string, unknown>;

const BUILTINS_APP_DISPLAY_NAME_FIELD = 'display_name';
const BUILTINS_APP_PUBLIC_FIELDS = [
  'backend_id',
  'provider_app_id',
  'canonical_app_slug',
  'display_name',
  'source_type',
  'source_label',
  'description',
  'category',
  'icon_url',
  'auth_modes',
  'available_scopes',
  'available_actions',
  'tool_count',
  'tools',
  'derived_scopes',
  'connection_status',
  'connection_id',
  'external_account_label',
  'overlay',
  'api_key_schema',
  'native_metadata',
].join('&');
const BUILTINS_TOOL_PUBLIC_FIELDS = [
  'function_id',
  'id',
  'name',
  'canonical_name',
  'tool_id',
  'display_name',
  'description',
  'summary',
  'metadata',
  'activation_state',
  'action_class',
  'behavior_hints',
  'confirmation_required',
  'approval_level',
  'provider_tool_id',
  'required_scopes',
].join('&');

interface ProviderScopePayload {
  id?: string;
  label?: string;
  description?: string | null;
  required?: boolean;
}

interface ProviderAppPayload {
  backendId: string;
  providerAppId: string;
  canonicalAppSlug: string;
  displayName: string;
  sourceType?: 'native' | 'third_party';
  sourceLabel?: string | null;
  description?: string | null;
  category?: string | null;
  iconUrl?: string | null;
  authModes?: string[];
  availableScopes?: ProviderScopePayload[];
  availableActions?: Array<string | UnknownRecord>;
  toolCount?: number;
  tools?: Array<string | UnknownRecord>;
  derivedScopes?: ProviderScopePayload[];
  connectionStatus?: IntegrationConnectionStatus | null;
  connectionId?: string | null;
  externalAccountLabel?: string | null;
  overlay?: UnknownRecord | null;
  apiKeySchema?: IntegrationApiKeySchema | null;
  nativeMetadata?: UnknownRecord | null;
}

interface ProviderAppPagePayload {
  items?: ProviderAppPayload[];
  apps?: ProviderAppPayload[];
  total?: number;
  limit?: number;
  offset?: number;
  facets?: ProviderAppCatalogFacets;
  catalogVersion?: string | null;
  generatedAt?: string | null;
}

interface LogPayload<T> {
  logs?: Array<{ entries?: T }>;
  count?: number;
}

export type ProviderAppStatusGroup = 'connected' | 'needs_attention' | 'not_connected';
export type ProviderAppDetailLevel = 'full' | 'summary';

export interface ProviderAppCatalogFacets {
  total: number;
  sourceType: {
    native: number;
    thirdParty: number;
  };
  status: {
    connected: number;
    configured: number;
    pending: number;
    missingScope: number;
    missingSecrets: number;
    needsReconnect: number;
    expired: number;
    revoked: number;
    error: number;
    notConnected: number;
  };
  statusGroup: {
    connected: number;
    needsAttention: number;
    notConnected: number;
  };
}

export interface ProviderIntegrationDefinitionsPage {
  definitions: IntegrationDefinition[];
  total: number;
  limit: number;
  offset: number;
  facets: ProviderAppCatalogFacets | null;
  catalogVersion: string | null;
  generatedAt: string | null;
}

interface ProviderConnectionPayload {
  connectionId?: string;
  id?: string;
  canonicalAppSlug: string;
  backendId?: string | null;
  providerAppId?: string | null;
  providerConnectionId?: string | null;
  status: IntegrationConnectionStatus;
  ownerScope?: IntegrationOwnerScope;
  externalAccountLabel?: string | null;
  accountLabel?: string | null;
  lastHealthCheckAt?: string | null;
  lastHealthCheckStatus?: string | null;
  reconnectReason?: string | null;
  grantedScopes?: Array<ProviderScopePayload | string>;
  toolPolicy?: Record<string, IntegrationToolApprovalLevel>;
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as UnknownRecord;
    if (Array.isArray(record.apps)) return record.apps as T[];
    if (Array.isArray(record.connections)) return record.connections as T[];
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail =
      typeof parsed?.detail === 'string'
        ? parsed.detail
        : typeof parsed?.error === 'string'
          ? parsed.error
          : `Integration request failed (${response.status})`;
    throw new Error(detail);
  }
  return snakeToCamelObject<T>(parsed);
}

async function integrationFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/integrations/provider/${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  return readJsonResponse<T>(response);
}

async function builtinsLogFetch<T>(args: {
  context: string;
  limit: number;
  offset: number;
  filterExpr?: string;
  fromFields?: string;
  sorting?: Record<string, 'ascending' | 'descending'>;
}): Promise<LogPayload<T>> {
  const params = new URLSearchParams();
  params.set('projectName', process.env.NEXT_PUBLIC_UNITY_BUILTINS_PROJECT || 'Builtins');
  params.set('context', args.context);
  params.set('limit', String(args.limit));
  params.set('offset', String(args.offset));
  if (args.filterExpr) params.set('filterExpr', args.filterExpr);
  if (args.fromFields) params.set('fromFields', args.fromFields);
  if (args.sorting) params.set('sorting', JSON.stringify(args.sorting));
  const response = await fetch(`/api/logs?${params.toString()}`, {
    cache: 'no-store',
  });
  try {
    return await readJsonResponse<LogPayload<T>>(response);
  } catch (error) {
    if (error instanceof Error && /Builtins|project/i.test(error.message)) {
      return { logs: [], count: 0 };
    }
    throw error;
  }
}

function buildOwnerQuery(args?: {
  ownerScope?: IntegrationOwnerScope;
  assistantId?: string | number;
}): string {
  const params = new URLSearchParams();
  if (args?.ownerScope) params.set('owner_scope', args.ownerScope);
  if (args?.assistantId !== undefined) params.set('assistant_id', String(args.assistantId));
  return params.toString();
}

function normalizeScope(scope: ProviderScopePayload | string, index: number): IntegrationScope {
  if (typeof scope === 'string') {
    return { id: scope, label: scope };
  }
  const id = scope.id || scope.label || `scope-${index}`;
  return {
    id,
    label: scope.label || id,
    description: scope.description ?? null,
    required: scope.required,
  };
}

function normalizeTool(
  action: string | UnknownRecord,
  canonicalSlug: string,
  index: number
): IntegrationToolPreview {
  if (typeof action === 'string') {
    return {
      id: `${canonicalSlug}:${action}`,
      name: action,
      displayName: action.replace(/[_-]/g, ' '),
      activationState: 'not_connected',
    };
  }
  const metadata = (
    action.metadata && typeof action.metadata === 'object' ? (action.metadata as UnknownRecord) : {}
  ) as UnknownRecord;
  const integration = (
    metadata.integration && typeof metadata.integration === 'object'
      ? (metadata.integration as UnknownRecord)
      : {}
  ) as UnknownRecord;
  const labels = (
    integration.labels && typeof integration.labels === 'object'
      ? (integration.labels as UnknownRecord)
      : {}
  ) as UnknownRecord;
  const name = String(
    action.name ||
      action.canonicalName ||
      action.canonical_name ||
      integration.canonicalName ||
      integration.canonical_name ||
      action.toolId ||
      integration.toolId ||
      integration.tool_id ||
      action.id ||
      `tool-${index}`
  );
  const displayName = String(
    action.displayName ||
      action.display_name ||
      action.toolDisplayName ||
      action.tool_display_name ||
      integration.toolDisplayName ||
      integration.tool_display_name ||
      labels.toolDisplayName ||
      labels.tool_display_name ||
      name
  ).replace(/[_-]/g, ' ');
  return {
    id: String(
      action.id ||
        action.toolId ||
        action.tool_id ||
        integration.toolId ||
        integration.tool_id ||
        `${canonicalSlug}:${name}`
    ),
    name,
    displayName,
    description:
      typeof action.description === 'string'
        ? action.description
        : (action.summary as string) || null,
    activationState: action.activationState as IntegrationToolPreview['activationState'],
    actionClass: (action.actionClass ?? integration.actionClass ?? integration.action_class) as
      | IntegrationToolPreview['actionClass']
      | undefined,
    behaviorHints: (Array.isArray(action.behaviorHints)
      ? action.behaviorHints
      : Array.isArray(action.behavior_hints)
        ? action.behavior_hints
        : Array.isArray(integration.behaviorHints)
          ? integration.behaviorHints
          : Array.isArray(integration.behavior_hints)
            ? integration.behavior_hints
            : []) as IntegrationToolBehaviorHint[],
    confirmationRequired: Boolean(
      action.confirmationRequired ??
      action.confirmation_required ??
      integration.confirmationRequired ??
      integration.confirmation_required
    ),
    approvalLevel: (action.approvalLevel ?? action.approval_level) as
      | IntegrationToolApprovalLevel
      | undefined,
    providerToolId:
      typeof action.providerToolId === 'string'
        ? action.providerToolId
        : typeof action.provider_tool_id === 'string'
          ? action.provider_tool_id
          : typeof integration.providerToolId === 'string'
            ? integration.providerToolId
            : typeof integration.provider_tool_id === 'string'
              ? integration.provider_tool_id
              : null,
    canonicalName:
      typeof action.canonicalName === 'string'
        ? action.canonicalName
        : typeof action.canonical_name === 'string'
          ? action.canonical_name
          : null,
    requiredScopes: Array.isArray(action.requiredScopes)
      ? (action.requiredScopes as Array<ProviderScopePayload | string>).map(normalizeScope)
      : Array.isArray(action.required_scopes)
        ? (action.required_scopes as Array<ProviderScopePayload | string>).map(normalizeScope)
        : Array.isArray(integration.requiredScopes)
          ? (integration.requiredScopes as Array<ProviderScopePayload | string>).map(normalizeScope)
          : Array.isArray(integration.required_scopes)
            ? (integration.required_scopes as Array<ProviderScopePayload | string>).map(
                normalizeScope
              )
            : [],
  };
}

function overlayCapabilityGroups(
  overlay: UnknownRecord | null | undefined
): IntegrationCapabilityGroup[] {
  const rawGroups = overlay?.capabilityGroups || overlay?.capability_groups;
  if (!Array.isArray(rawGroups)) return [];
  return rawGroups.map((group, index) => {
    const record = group as UnknownRecord;
    const id = String(record.id || record.label || `capability-${index}`);
    return {
      id,
      label: String(record.label || id),
      description: (record.description as string | undefined) ?? null,
      policyLabels: Array.isArray(record.policyLabels)
        ? (record.policyLabels as string[])
        : Array.isArray(record.policy_labels)
          ? (record.policy_labels as string[])
          : [],
    };
  });
}

function sourceForProviderApp(app: ProviderAppPayload): IntegrationSourceMetadata {
  const isNative = app.sourceType === 'native';
  const source = isNative ? 'static_package' : app.overlay ? 'overlay_curated' : 'provider_backed';
  return {
    source,
    label: app.sourceLabel || (isNative ? 'Native' : 'Managed app'),
    sourceType: app.sourceType,
    backendId: app.backendId,
    providerAppId: app.providerAppId,
    providerConnectionId: app.connectionId,
    overlayCurated: Boolean(app.overlay),
    nativeMetadata: app.nativeMetadata ?? null,
    raw: app.overlay ?? app.nativeMetadata ?? null,
  };
}

export function mapProviderAppToDefinition(app: ProviderAppPayload): IntegrationDefinition {
  const sourceMetadata = sourceForProviderApp(app);
  const status = app.connectionStatus || 'not_connected';
  const scopes = (app.derivedScopes || app.availableScopes || []).map(normalizeScope);
  const rawTools = app.tools && app.tools.length > 0 ? app.tools : app.availableActions || [];
  const tools = rawTools.map((action, index) => normalizeTool(action, app.canonicalAppSlug, index));
  const connection: IntegrationConnection | null = app.connectionId
    ? {
        id: app.connectionId,
        definitionId: app.canonicalAppSlug,
        canonicalSlug: app.canonicalAppSlug,
        source: sourceMetadata.source,
        status,
        accountLabel: app.externalAccountLabel ?? null,
        grantedScopes: scopes,
        sourceMetadata,
      }
    : null;

  return {
    id: app.canonicalAppSlug,
    canonicalSlug: app.canonicalAppSlug,
    displayName: app.displayName,
    description: app.description ?? null,
    category: app.category ?? null,
    iconUrl: app.iconUrl ?? null,
    authModes: (app.authModes || []).map(
      (mode) => mode as IntegrationDefinition['authModes'][number]
    ),
    status,
    source: sourceMetadata.source,
    sourceMetadata,
    scopes,
    capabilityGroups: overlayCapabilityGroups(app.overlay),
    tools,
    toolCount: app.toolCount ?? tools.length,
    apiKeySchema: app.apiKeySchema ?? null,
    docsUrl: typeof app.overlay?.docsUrl === 'string' ? app.overlay.docsUrl : null,
    connections: connection ? [connection] : [],
  };
}

export function mapProviderConnection(
  connection: ProviderConnectionPayload
): IntegrationConnection {
  const id = connection.connectionId || connection.id || connection.providerConnectionId || '';
  const sourceMetadata: IntegrationSourceMetadata = {
    source: 'provider_backed',
    label: 'Managed app',
    backendId: connection.backendId,
    providerAppId: connection.providerAppId,
    providerConnectionId: connection.providerConnectionId || id,
  };
  return {
    id,
    definitionId: connection.canonicalAppSlug,
    canonicalSlug: connection.canonicalAppSlug,
    source: 'provider_backed',
    status: connection.status,
    ownerScope: connection.ownerScope,
    accountLabel: connection.accountLabel || connection.externalAccountLabel || null,
    healthLabel: connection.lastHealthCheckStatus || null,
    lastCheckedAt: connection.lastHealthCheckAt || null,
    reconnectReason: connection.reconnectReason || null,
    grantedScopes: (connection.grantedScopes || []).map(normalizeScope),
    toolPolicy: connection.toolPolicy || {},
    sourceMetadata,
  };
}

function quoteFilterValue(value: string): string {
  return JSON.stringify(value);
}

function toolAppSlugFilter(slug: string): string {
  return `metadata["integration"]["app_slug"] == ${quoteFilterValue(slug)}`;
}

function statusGroupForStatus(status: string): ProviderAppStatusGroup {
  if (status === 'connected' || status === 'configured') return 'connected';
  if (
    [
      'pending',
      'missing_scope',
      'missing_secrets',
      'needs_reconnect',
      'expired',
      'revoked',
      'error',
    ].includes(status)
  ) {
    return 'needs_attention';
  }
  return 'not_connected';
}

function connectionStatusBySlug(connections: IntegrationConnection[]): Map<string, string> {
  const bySlug = new Map<string, string>();
  for (const connection of connections) {
    if (connection.status === 'disconnected' || bySlug.has(connection.canonicalSlug)) continue;
    bySlug.set(connection.canonicalSlug, connection.status);
  }
  return bySlug;
}

function slugMembershipFilter(slugs: string[], negate = false): string | null {
  const unique = [...new Set(slugs)].filter(Boolean).sort();
  if (unique.length === 0) return negate ? null : 'canonical_app_slug == "__no_matching_apps__"';
  return `canonical_app_slug ${negate ? 'not in' : 'in'} ${JSON.stringify(unique)}`;
}

function catalogFilterExpr(args: {
  query?: string;
  sourceType?: 'native' | 'third_party' | null;
  statuses?: IntegrationConnectionStatus[];
  statusGroups?: ProviderAppStatusGroup[];
  connections?: IntegrationConnection[];
}): string | undefined {
  const filters: string[] = [];
  if (args.sourceType) filters.push(`source_type == ${quoteFilterValue(args.sourceType)}`);
  const query = args.query?.trim().toLowerCase();
  if (query) {
    const quoted = quoteFilterValue(query);
    filters.push(
      `(${[
        `display_name.lower().contains(${quoted})`,
        `canonical_app_slug.lower().contains(${quoted})`,
        `description.lower().contains(${quoted})`,
        `category.lower().contains(${quoted})`,
        `source_label.lower().contains(${quoted})`,
      ].join(' or ')})`
    );
  }

  const statuses = new Set(args.statuses ?? []);
  const statusGroups = new Set(args.statusGroups ?? []);
  if (statuses.size > 0 || statusGroups.size > 0) {
    const bySlug = connectionStatusBySlug(args.connections ?? []);
    const includeSlugs: string[] = [];
    const excludeSlugs = [...bySlug.keys()];
    let includeNativeConfigured = false;
    let includeNotConnected = false;

    for (const [slug, status] of bySlug) {
      if (
        statuses.has(status as IntegrationConnectionStatus) ||
        statusGroups.has(statusGroupForStatus(status))
      ) {
        includeSlugs.push(slug);
      }
    }
    if (statuses.has('configured') || statusGroups.has('connected')) includeNativeConfigured = true;
    if (statuses.has('not_connected') || statusGroups.has('not_connected'))
      includeNotConnected = true;

    const statusFilters: string[] = [];
    const included = slugMembershipFilter(includeSlugs);
    if (included) statusFilters.push(included);
    if (includeNativeConfigured) statusFilters.push('source_type == "native"');
    if (includeNotConnected) {
      const excluded = slugMembershipFilter(excludeSlugs, true);
      statusFilters.push(
        excluded ? `(${excluded} and source_type != "native")` : 'source_type != "native"'
      );
    }
    filters.push(
      statusFilters.length > 0
        ? `(${statusFilters.join(' or ')})`
        : 'canonical_app_slug == "__no_matching_apps__"'
    );
  }

  return filters.length > 0 ? filters.join(' and ') : undefined;
}

function overlayAppConnections(
  app: ProviderAppPayload,
  connectionsBySlug: Map<string, IntegrationConnection[]>
): ProviderAppPayload {
  const connections = connectionsBySlug.get(app.canonicalAppSlug) ?? [];
  const primary = connections[0];
  if (!primary) {
    return {
      ...app,
      connectionStatus:
        app.connectionStatus ?? (app.sourceType === 'native' ? 'configured' : 'not_connected'),
    };
  }
  return {
    ...app,
    connectionStatus: primary.status,
    connectionId: primary.id,
    externalAccountLabel: primary.accountLabel,
  };
}

function connectionsBySlug(
  connections: IntegrationConnection[]
): Map<string, IntegrationConnection[]> {
  const bySlug = new Map<string, IntegrationConnection[]>();
  for (const connection of connections) {
    if (connection.status === 'disconnected') continue;
    bySlug.set(connection.canonicalSlug, [
      ...(bySlug.get(connection.canonicalSlug) ?? []),
      connection,
    ]);
  }
  return bySlug;
}

function facetsFromConnections(
  total: number,
  connections: IntegrationConnection[]
): ProviderAppCatalogFacets {
  const bySlug = connectionStatusBySlug(connections);
  const status = {
    connected: 0,
    configured: 0,
    pending: 0,
    missingScope: 0,
    missingSecrets: 0,
    needsReconnect: 0,
    expired: 0,
    revoked: 0,
    error: 0,
    notConnected: 0,
  };
  for (const connectionStatus of bySlug.values()) {
    const key =
      connectionStatus === 'missing_scope'
        ? 'missingScope'
        : connectionStatus === 'missing_secrets'
          ? 'missingSecrets'
          : connectionStatus === 'needs_reconnect'
            ? 'needsReconnect'
            : connectionStatus;
    if (key in status) status[key as keyof typeof status] += 1;
  }
  const connected = status.connected + status.configured;
  const needsAttention =
    status.pending +
    status.missingScope +
    status.missingSecrets +
    status.needsReconnect +
    status.expired +
    status.revoked +
    status.error;
  status.notConnected = Math.max(total - connected - needsAttention, 0);
  return {
    total,
    sourceType: { native: 0, thirdParty: total },
    status,
    statusGroup: {
      connected,
      needsAttention,
      notConnected: status.notConnected,
    },
  };
}

export async function listProviderIntegrationDefinitions(args: {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
}): Promise<IntegrationDefinition[]> {
  const page = await listProviderIntegrationDefinitionsPage({
    ownerScope: args.ownerScope,
    assistantId: args.assistantId,
    limit: 500,
    offset: 0,
  });
  return page.definitions;
}

export async function listProviderIntegrationDefinitionsPage(args: {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
  query?: string;
  sourceType?: 'native' | 'third_party' | null;
  statuses?: IntegrationConnectionStatus[];
  statusGroups?: ProviderAppStatusGroup[];
  detailLevel?: ProviderAppDetailLevel;
  limit?: number;
  offset?: number;
}): Promise<ProviderIntegrationDefinitionsPage> {
  const limit = args.limit ?? 100;
  const offset = args.offset ?? 0;
  const needsConnectionFilter =
    (args.statuses?.length ?? 0) > 0 || (args.statusGroups?.length ?? 0) > 0;
  const providerConnections =
    needsConnectionFilter || args.detailLevel === 'summary'
      ? await listProviderIntegrationConnections({
          ownerScope: args.ownerScope,
          assistantId: args.assistantId,
        }).catch(() => [])
      : [];
  const data = await builtinsLogFetch<ProviderAppPayload>({
    context: 'Integrations/Apps',
    limit,
    offset,
    filterExpr: catalogFilterExpr({ ...args, connections: providerConnections }),
    fromFields: BUILTINS_APP_PUBLIC_FIELDS,
    sorting: { [BUILTINS_APP_DISPLAY_NAME_FIELD]: 'ascending' },
  });
  const pageConnections =
    providerConnections.length > 0 || args.detailLevel === 'summary'
      ? providerConnections
      : await listProviderIntegrationConnections({
          ownerScope: args.ownerScope,
          assistantId: args.assistantId,
        }).catch(() => []);
  const bySlug = connectionsBySlug(pageConnections);
  const items = (data.logs ?? [])
    .map((log) => log.entries)
    .filter(Boolean)
    .map((app) => overlayAppConnections(app as ProviderAppPayload, bySlug));
  return {
    definitions: items.map(mapProviderAppToDefinition),
    total: typeof data.count === 'number' ? data.count : items.length,
    limit,
    offset,
    facets: facetsFromConnections(
      typeof data.count === 'number' ? data.count : items.length,
      pageConnections
    ),
    catalogVersion: null,
    generatedAt: null,
  };
}

export async function getProviderIntegrationDetails(args: {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
  canonicalSlug: string;
}): Promise<IntegrationDefinition> {
  const [appPage, toolPage, providerConnections] = await Promise.all([
    builtinsLogFetch<ProviderAppPayload>({
      context: 'Integrations/Apps',
      limit: 1,
      offset: 0,
      filterExpr: `canonical_app_slug == ${quoteFilterValue(args.canonicalSlug)}`,
      fromFields: BUILTINS_APP_PUBLIC_FIELDS,
    }),
    builtinsLogFetch<UnknownRecord>({
      context: 'Integrations/Tools',
      limit: 500,
      offset: 0,
      filterExpr: toolAppSlugFilter(args.canonicalSlug),
      fromFields: BUILTINS_TOOL_PUBLIC_FIELDS,
      sorting: { name: 'ascending' },
    }),
    listProviderIntegrationConnections({
      ownerScope: args.ownerScope,
      assistantId: args.assistantId,
    }).catch(() => []),
  ]);
  const app = appPage.logs?.[0]?.entries;
  if (!app) throw new Error(`Integration ${args.canonicalSlug} was not found`);
  const bySlug = connectionsBySlug(providerConnections);
  return mapProviderAppToDefinition(
    overlayAppConnections(
      {
        ...app,
        tools: (toolPage.logs ?? []).map((log) => log.entries).filter(Boolean) as UnknownRecord[],
      },
      bySlug
    )
  );
}

export async function listProviderIntegrationConnections(args: {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
}): Promise<IntegrationConnection[]> {
  const params = new URLSearchParams();
  params.set('owner_scope', args.ownerScope);
  if (args.assistantId !== undefined) params.set('assistant_id', String(args.assistantId));
  const data = await integrationFetch<
    ProviderConnectionPayload[] | { connections?: ProviderConnectionPayload[] }
  >(`connections?${params.toString()}`);
  return asArray<ProviderConnectionPayload>(data).map(mapProviderConnection);
}

export async function startProviderIntegrationConnect(
  request: ProviderIntegrationConnectStartRequest
): Promise<ProviderIntegrationConnectStartResponse> {
  const { apiKeyValues, ...rest } = request;
  const data = await integrationFetch<ProviderIntegrationConnectStartResponse>('connect/start', {
    method: 'POST',
    body: JSON.stringify(
      camelToSnakeObject({
        ...rest,
        ...(apiKeyValues ? { apiKeyFields: apiKeyValues } : {}),
      })
    ),
  });
  return {
    ...data,
    connection: mapProviderConnection(data.connection as unknown as ProviderConnectionPayload),
  };
}

export async function disconnectProviderIntegration(connectionId: string): Promise<void> {
  await integrationFetch(`connections/${connectionId}/disconnect`, { method: 'POST' });
}

export async function cancelProviderIntegration(connectionId: string): Promise<void> {
  await integrationFetch(`connections/${connectionId}/cancel`, { method: 'POST' });
}

export async function updateProviderIntegrationConnection(
  connectionId: string,
  request: { accountLabel?: string | null }
): Promise<IntegrationConnection> {
  const data = await integrationFetch<ProviderConnectionPayload>(`connections/${connectionId}`, {
    method: 'PATCH',
    body: JSON.stringify(camelToSnakeObject(request)),
  });
  return mapProviderConnection(data);
}

export async function completeProviderIntegrationConnection(
  connectionId: string,
  request: {
    providerConnectionId?: string | null;
    grantedScopes?: string[];
    externalAccountLabel?: string | null;
    status?: IntegrationConnectionStatus;
    reconnectReason?: string | null;
  } = {}
): Promise<IntegrationConnection> {
  const data = await integrationFetch<ProviderConnectionPayload>(
    `connections/${connectionId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify(camelToSnakeObject(request)),
    }
  );
  return mapProviderConnection(data);
}

export async function completeProviderIntegrationConnectionByProviderId(request: {
  providerConnectionId: string;
  ownerScope?: IntegrationOwnerScope;
  assistantId?: string | number;
  grantedScopes?: string[];
  externalAccountLabel?: string | null;
  status?: IntegrationConnectionStatus;
  reconnectReason?: string | null;
}): Promise<IntegrationConnection> {
  const data = await integrationFetch<ProviderConnectionPayload>(
    'connections/complete-by-provider',
    {
      method: 'POST',
      body: JSON.stringify(camelToSnakeObject(request)),
    }
  );
  return mapProviderConnection(data);
}

export async function requestUnityIntegrationToolsSync(args: {
  assistantId: string | number;
  connection: IntegrationConnection;
  reason?: 'connected' | 'disconnected';
}): Promise<void> {
  const reason = args.reason ?? 'connected';
  if (
    reason === 'connected' &&
    args.connection.status !== 'connected' &&
    args.connection.status !== 'configured'
  ) {
    return;
  }
  const message =
    reason === 'disconnected'
      ? `${args.connection.canonicalSlug} integration disconnected; removing tools.`
      : `${args.connection.canonicalSlug} integration connected; preparing tools.`;
  const response = await fetch(
    `/api/assistant/${encodeURIComponent(String(args.assistantId))}/system-event`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'integration_tools_sync_requested',
        message,
        extraEventFields: {
          appSlug: args.connection.canonicalSlug,
          connectionId: args.connection.id,
          backendId: args.connection.sourceMetadata?.backendId,
          operation: reason === 'disconnected' ? 'cleanup' : 'materialize',
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Unity integration sync request failed (${response.status})`);
  }
}

export async function getProviderIntegrationToolPolicy(
  connectionId: string,
  args: {
    ownerScope?: IntegrationOwnerScope;
    assistantId?: string | number;
  } = {}
): Promise<IntegrationToolPolicyResponse> {
  const query = buildOwnerQuery(args);
  return integrationFetch<IntegrationToolPolicyResponse>(
    `connections/${connectionId}/tool-policy${query ? `?${query}` : ''}`
  );
}

export async function patchProviderIntegrationToolPolicy(
  connectionId: string,
  request: {
    toolPolicies?: Record<string, IntegrationToolApprovalLevel>;
    bulkApprovalLevel?: IntegrationToolApprovalLevel;
    actionClasses?: Array<NonNullable<IntegrationToolPreview['actionClass']>>;
    resetToDefaults?: boolean;
  },
  args: {
    ownerScope?: IntegrationOwnerScope;
    assistantId?: string | number;
  } = {}
): Promise<IntegrationToolPolicyResponse> {
  const query = buildOwnerQuery(args);
  return integrationFetch<IntegrationToolPolicyResponse>(
    `connections/${connectionId}/tool-policy${query ? `?${query}` : ''}`,
    {
      method: 'PATCH',
      body: JSON.stringify(camelToSnakeObject(request)),
    }
  );
}

export async function reconnectProviderIntegration(
  connectionId: string
): Promise<IntegrationConnection> {
  const data = await integrationFetch<ProviderConnectionPayload>(
    `connections/${connectionId}/reconnect`,
    { method: 'POST' }
  );
  return mapProviderConnection(data);
}

export async function testProviderIntegration(
  connectionId: string
): Promise<IntegrationConnection> {
  const data = await integrationFetch<ProviderConnectionPayload>(
    `connections/${connectionId}/test`,
    {
      method: 'POST',
    }
  );
  return mapProviderConnection(data);
}

async function providerAdminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/integrations/provider-admin/${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  return readJsonResponse<T>(response);
}

export interface ProviderBackendSetupRequest {
  backendId: string;
  kind: 'composio' | 'pipedream' | 'first_party' | 'custom';
  environment?: string;
  displayName: string;
  status?: 'enabled' | 'disabled';
  allowedOrgsOrTenants?: string[];
  defaultPriority?: number;
  configJson?: ProviderBackendOperationalConfig;
}

export interface ProviderBackendOperationalConfig {
  timeoutSeconds?: number;
  maxPages?: number;
  maxItems?: number;
  allowedOrigins?: string[];
  executionMode?: 'local_echo' | 'live' | 'function_manager';
}

export interface ProviderBackendPatchRequest {
  status?: 'enabled' | 'disabled';
  allowedOrgsOrTenants?: string[];
  defaultPriority?: number;
  configJson?: ProviderBackendOperationalConfig;
}

export interface ProviderBackendResponse extends ProviderBackendSetupRequest {
  id: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface IntegrationCatalogSyncRequest {
  backendId: string;
  cacheVersion?: string;
  sourceType?: 'native' | 'third_party';
  apps?: UnknownRecord[];
  tools?: UnknownRecord[];
  appSlugs?: string[];
  toolLimitPerApp?: number;
  includeAllManagedApps?: boolean;
  createAuthConfigs?: boolean;
  componentLimitPerApp?: number;
  includeAllApps?: boolean;
}

export async function listProviderIntegrationBackends(): Promise<ProviderBackendResponse[]> {
  return asArray<ProviderBackendResponse>(await providerAdminFetch<unknown>('backends'));
}

export async function upsertProviderIntegrationBackend(
  request: ProviderBackendSetupRequest
): Promise<ProviderBackendResponse> {
  return providerAdminFetch<ProviderBackendResponse>('backends', {
    method: 'POST',
    body: JSON.stringify(camelToSnakeObject(request)),
  });
}

export async function patchProviderIntegrationBackend(
  backendId: string,
  request: ProviderBackendPatchRequest
): Promise<ProviderBackendResponse> {
  return providerAdminFetch<ProviderBackendResponse>(`backends/${encodeURIComponent(backendId)}`, {
    method: 'PATCH',
    body: JSON.stringify(camelToSnakeObject(request)),
  });
}

export async function syncIntegrations(
  request: IntegrationCatalogSyncRequest
): Promise<UnknownRecord> {
  return providerAdminFetch<UnknownRecord>('sync', {
    method: 'POST',
    body: JSON.stringify(camelToSnakeObject(request)),
  });
}
