import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import type {
  IntegrationApiKeySchema,
  IntegrationCapabilityGroup,
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationDefinition,
  IntegrationOwnerScope,
  IntegrationScope,
  IntegrationSourceMetadata,
  IntegrationToolApprovalLevel,
  IntegrationToolPolicyResponse,
  IntegrationToolPreview,
  ProviderIntegrationConnectStartRequest,
  ProviderIntegrationConnectStartResponse,
} from '@/types/integrations';

type UnknownRecord = Record<string, unknown>;

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
  const name = String(
    action.name ||
      action.canonicalName ||
      action.canonical_name ||
      action.toolId ||
      action.id ||
      `tool-${index}`
  );
  const displayName = String(
    action.displayName ||
      action.display_name ||
      action.toolDisplayName ||
      action.tool_display_name ||
      name
  ).replace(/[_-]/g, ' ');
  return {
    id: String(action.id || action.toolId || `${canonicalSlug}:${name}`),
    name,
    displayName,
    description:
      typeof action.description === 'string'
        ? action.description
        : (action.summary as string) || null,
    activationState: action.activationState as IntegrationToolPreview['activationState'],
    actionClass: action.actionClass as IntegrationToolPreview['actionClass'],
    confirmationRequired: Boolean(action.confirmationRequired ?? action.confirmation_required),
    approvalLevel: (action.approvalLevel ?? action.approval_level) as
      | IntegrationToolApprovalLevel
      | undefined,
    providerToolId:
      typeof action.providerToolId === 'string'
        ? action.providerToolId
        : typeof action.provider_tool_id === 'string'
          ? action.provider_tool_id
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

export async function listProviderIntegrationDefinitions(args: {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
}): Promise<IntegrationDefinition[]> {
  const params = new URLSearchParams();
  params.set('owner_scope', args.ownerScope);
  if (args.assistantId !== undefined) params.set('assistant_id', String(args.assistantId));
  const data = await integrationFetch<
    ProviderAppPayload[] | { apps?: ProviderAppPayload[]; items?: ProviderAppPayload[] }
  >(`apps?${params.toString()}`);
  return asArray<ProviderAppPayload>(data).map(mapProviderAppToDefinition);
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
  const params = new URLSearchParams();
  const limit = args.limit ?? 100;
  const offset = args.offset ?? 0;
  params.set('owner_scope', args.ownerScope);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  params.set('detail_level', args.detailLevel ?? 'summary');
  if (args.assistantId !== undefined) params.set('assistant_id', String(args.assistantId));
  if (args.query?.trim()) params.set('query', args.query.trim());
  if (args.sourceType) params.set('source_type', args.sourceType);
  for (const status of args.statuses ?? []) {
    params.append('status', status);
  }
  for (const statusGroup of args.statusGroups ?? []) {
    params.append('status_group', statusGroup);
  }
  const data = await integrationFetch<ProviderAppPagePayload | ProviderAppPayload[]>(
    `apps?${params.toString()}`
  );
  const items = asArray<ProviderAppPayload>(data);
  const page = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  return {
    definitions: items.map(mapProviderAppToDefinition),
    total: typeof page?.total === 'number' ? page.total : items.length,
    limit: typeof page?.limit === 'number' ? page.limit : limit,
    offset: typeof page?.offset === 'number' ? page.offset : offset,
    facets: page?.facets ?? null,
    catalogVersion: page?.catalogVersion ?? null,
    generatedAt: page?.generatedAt ?? null,
  };
}

export async function getProviderIntegrationDetails(args: {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
  canonicalSlug: string;
}): Promise<IntegrationDefinition> {
  const params = new URLSearchParams();
  params.set('owner_scope', args.ownerScope);
  if (args.assistantId !== undefined) params.set('assistant_id', String(args.assistantId));
  const data = await integrationFetch<ProviderAppPayload>(
    `apps/${encodeURIComponent(args.canonicalSlug)}?${params.toString()}`
  );
  return mapProviderAppToDefinition(data);
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
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Unity integration sync request failed (${response.status})`);
  }
}

export async function getProviderIntegrationToolPolicy(
  connectionId: string
): Promise<IntegrationToolPolicyResponse> {
  return integrationFetch<IntegrationToolPolicyResponse>(`connections/${connectionId}/tool-policy`);
}

export async function patchProviderIntegrationToolPolicy(
  connectionId: string,
  request: {
    toolPolicies?: Record<string, IntegrationToolApprovalLevel>;
    bulkApprovalLevel?: IntegrationToolApprovalLevel;
    actionClasses?: Array<NonNullable<IntegrationToolPreview['actionClass']>>;
    resetToDefaults?: boolean;
  }
): Promise<IntegrationToolPolicyResponse> {
  return integrationFetch<IntegrationToolPolicyResponse>(
    `connections/${connectionId}/tool-policy`,
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
  credentialsSecretRef?: string | null;
  webhookSecretRef?: string | null;
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
