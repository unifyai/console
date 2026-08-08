import { resolvePublicCatalogApps } from '@/lib/client/provider-resolution';
import { camelToSnake, camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import type {
  IntegrationApiKeyField,
  IntegrationApiKeySchema,
  IntegrationCapabilityGroup,
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationDefinition,
  IntegrationLabel,
  IntegrationLabels,
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
import { isTriggerOnlyConnection } from '@/types/integrations';

type UnknownRecord = Record<string, unknown>;

const BUILTINS_APP_DISPLAY_NAME_FIELD = 'display_name';
const BUILTINS_APP_CANONICAL_SLUG_FIELD = 'canonical_app_slug';
const BUILTINS_APP_PUBLIC_FIELDS = [
  'backend_id',
  'provider_app_id',
  'canonical_app_slug',
  'display_name',
  'source_type',
  'source_label',
  'description',
  'category',
  'labels',
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
  'requires_custom_oauth',
  'managed_auth',
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
  name?: string;
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
  labels?: IntegrationLabels | null;
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
  apiKeySchema?: UnknownRecord | IntegrationApiKeySchema | null;
  requiresCustomOauth?: boolean | null;
  managedAuth?: boolean | null;
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
  categories?: Array<{
    value: string;
    label: string;
    count: number;
  }>;
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
  credentialStorage?: string | null;
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
  filter?: string;
  fromFields?: string;
  sorting?: Record<string, 'ascending' | 'descending'>;
}): Promise<LogPayload<T>> {
  const params = new URLSearchParams();
  params.set('projectName', process.env.NEXT_PUBLIC_UNITY_BUILTINS_PROJECT || 'Builtins');
  params.set('context', args.context);
  params.set('limit', String(args.limit));
  params.set('offset', String(args.offset));
  if (args.filter) params.set('filter', args.filter);
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
  const id = scope.id || scope.name || scope.label || `scope-${index}`;
  return {
    id,
    label: scope.label || scope.name || id,
    description: scope.description ?? null,
    required: scope.required,
  };
}

function normalizeIntegrationLabel(value: unknown): IntegrationLabel | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as UnknownRecord;
  const key = typeof record.key === 'string' ? record.key.trim() : '';
  const label =
    typeof record.label === 'string'
      ? record.label.trim()
      : typeof record.name === 'string'
        ? record.name.trim()
        : key;
  if (!key || !label) return null;
  return { key, label };
}

function normalizeIntegrationLabels(value: unknown): IntegrationLabels | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as UnknownRecord;
  const categories = asArray<unknown>(record.categories)
    .map(normalizeIntegrationLabel)
    .filter((label): label is IntegrationLabel => Boolean(label));
  const tags = asArray<unknown>(record.tags)
    .map(normalizeIntegrationLabel)
    .filter((label): label is IntegrationLabel => Boolean(label));
  const primaryCategory =
    normalizeIntegrationLabel(record.primaryCategory ?? record.primary_category) ??
    categories[0] ??
    null;
  if (!primaryCategory && categories.length === 0 && tags.length === 0) return null;
  return { primaryCategory, categories, tags };
}

function normalizeApiKeySchema(
  raw: UnknownRecord | IntegrationApiKeySchema | null | undefined
): IntegrationApiKeySchema | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as UnknownRecord;
  if (Array.isArray(record.fields)) {
    return record as unknown as IntegrationApiKeySchema;
  }
  const properties =
    record.properties && typeof record.properties === 'object'
      ? (record.properties as UnknownRecord)
      : null;
  if (!properties) return null;
  const requiredKeys = new Set(
    Array.isArray(record.required) ? (record.required as unknown[]).map((key) => String(key)) : []
  );
  const fields: IntegrationApiKeyField[] = Object.entries(properties).map(([key, value]) => {
    const prop = (value && typeof value === 'object' ? value : {}) as UnknownRecord;
    return {
      id: key,
      label: typeof prop.title === 'string' ? prop.title : key,
      description: typeof prop.description === 'string' ? prop.description : null,
      placeholder: typeof prop.placeholder === 'string' ? prop.placeholder : undefined,
      required: requiredKeys.has(key) || requiredKeys.has(camelToSnake(key)),
      sensitive: prop.secret !== false,
    };
  });
  if (fields.length === 0) return null;
  return {
    fields,
    submitLabel: typeof record.submitLabel === 'string' ? record.submitLabel : 'Save credentials',
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
    labels: normalizeIntegrationLabels(app.labels),
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
    apiKeySchema: normalizeApiKeySchema(app.apiKeySchema),
    requiresCustomOauth: app.requiresCustomOauth === true,
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
    credentialStorage: connection.credentialStorage ?? null,
  };
}

function quoteFilterValue(value: string): string {
  return JSON.stringify(value);
}

function orSearchTerms(query: string | undefined): string[] {
  if (!query?.includes('|')) return [];
  return [
    ...new Set(
      query
        .split('|')
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function categoryFilterExpr(category: string): string {
  const quoted = quoteFilterValue(category);
  return `(${[
    `category.lower() == ${quoted}`,
    `len([label for label in labels["categories"] if label["key"] == ${quoted}]) > 0`,
  ].join(' or ')})`;
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
    if (
      connection.status === 'disconnected' ||
      isTriggerOnlyConnection(connection) ||
      bySlug.has(connection.canonicalSlug)
    )
      continue;
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
  category?: string | null;
  statuses?: IntegrationConnectionStatus[];
  statusGroups?: ProviderAppStatusGroup[];
  connections?: IntegrationConnection[];
}): string | undefined {
  const filters: string[] = [];
  if (args.sourceType) filters.push(`source_type == ${quoteFilterValue(args.sourceType)}`);
  const category = args.category?.trim().toLowerCase();
  if (category) filters.push(categoryFilterExpr(category));
  const query = args.query?.trim().toLowerCase();
  if (query) {
    // Match against the identity/description fields only. Broader fields like
    // category/source_label produce noisy, over-broad matches. This is an
    // indexed `contains` over a small catalogue (~1k rows) and stays sub-second;
    // the result set is the search result, so its inline count is exact. Plain
    // user searches keep phrase semantics; generated onboarding searches can
    // opt into OR matching with a pipe-separated query.
    const terms = orSearchTerms(args.query);
    const values = terms.length > 1 ? terms : [query];
    const searchFilters = values.flatMap((value) => {
      const quoted = quoteFilterValue(value);
      return [
        `display_name.lower().contains(${quoted})`,
        `canonical_app_slug.lower().contains(${quoted})`,
        `description.lower().contains(${quoted})`,
      ];
    });
    filters.push(`(${searchFilters.join(' or ')})`);
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
    if (connection.status === 'disconnected' || isTriggerOnlyConnection(connection)) continue;
    bySlug.set(connection.canonicalSlug, [
      ...(bySlug.get(connection.canonicalSlug) ?? []),
      connection,
    ]);
  }
  return bySlug;
}

function facetsFromConnections(
  total: number,
  connections: IntegrationConnection[],
  apps: ProviderAppPayload[] = []
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
    categories: categoryFacetsFromApps(apps),
  };
}

function categoryFacetsFromApps(
  apps: ProviderAppPayload[]
): ProviderAppCatalogFacets['categories'] {
  const byValue = new Map<string, { value: string; label: string; count: number }>();
  for (const app of apps) {
    const labels = normalizeIntegrationLabels(app.labels);
    const categories =
      labels?.categories && labels.categories.length > 0
        ? labels.categories
        : app.category?.trim()
          ? [{ key: app.category.trim().toLowerCase(), label: app.category.trim() }]
          : [];
    const seenForApp = new Set<string>();
    for (const category of categories) {
      if (!category.key || seenForApp.has(category.key)) continue;
      seenForApp.add(category.key);
      const current = byValue.get(category.key);
      if (current) current.count += 1;
      else byValue.set(category.key, { value: category.key, label: category.label, count: 1 });
    }
  }
  return Array.from(byValue.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
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
  category?: string | null;
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
    filter: catalogFilterExpr({ ...args, connections: providerConnections }),
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
  const items = resolvePublicCatalogApps(
    (data.logs ?? [])
      .map((log) => log.entries)
      .filter(Boolean)
      .map((app) => overlayAppConnections(app as ProviderAppPayload, bySlug))
  );
  return {
    definitions: items.map(mapProviderAppToDefinition),
    total: typeof data.count === 'number' ? data.count : items.length,
    limit,
    offset,
    facets: facetsFromConnections(
      typeof data.count === 'number' ? data.count : items.length,
      pageConnections,
      items
    ),
    catalogVersion: null,
    generatedAt: null,
  };
}

function extractMetricCount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value || typeof value !== 'object') return null;
  for (const nested of Object.values(value as UnknownRecord)) {
    const found = extractMetricCount(nested);
    if (found !== null) return found;
  }
  return null;
}

export async function getProviderIntegrationCatalogCount(args: {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
  sourceType?: 'native' | 'third_party' | null;
  category?: string | null;
  statuses?: IntegrationConnectionStatus[];
  statusGroups?: ProviderAppStatusGroup[];
}): Promise<number | null> {
  const needsConnectionFilter =
    (args.statuses?.length ?? 0) > 0 || (args.statusGroups?.length ?? 0) > 0;
  const connections = needsConnectionFilter
    ? await listProviderIntegrationConnections({
        ownerScope: args.ownerScope,
        assistantId: args.assistantId,
      }).catch(() => [])
    : [];
  const filter = catalogFilterExpr({ ...args, connections });
  const params = new URLSearchParams();
  params.set('projectName', process.env.NEXT_PUBLIC_UNITY_BUILTINS_PROJECT || 'Builtins');
  params.set('context', 'Integrations/Apps');
  // Count over a field present on every catalog row; the log's own `id` is not an
  // entry field and would always yield 0.
  params.set('key', JSON.stringify([BUILTINS_APP_CANONICAL_SLUG_FIELD]));
  if (filter) params.set('filter', filter);
  const response = await fetch(`/api/logs/count?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  return extractMetricCount(parsed);
}

/**
 * Gallery rows for a known set of slugs, in one request, with no tools.
 *
 * The workflows shelf needs a logo, a display name, the auth modes and the
 * connection status for each app a bundle requires. It was getting them
 * from `getProviderIntegrationDetails` once per slug — and that call also
 * queries the `Integrations/Tools` context for up to 500 rows per app.
 *
 * Measured against the live catalogue, three of the shelf's eight slugs
 * cost 34.9s and 16.9MB that way, essentially all of it tool rows the
 * shelf never renders. All eight through this path: one request, 1.5s,
 * 12KB. Tools stay where they belong — behind opening a drawer.
 *
 * Same field list as every other app read, deliberately: the win is not
 * fetching tools, not trimming columns. (The row's own `tools` field is
 * empty in the published catalogue, and an `exclude_fields` approach would
 * be worse than the allow-list — it lets the row's embedding vector
 * through.)
 */
/**
 * Fold the owner's live connection rows onto their app definitions.
 *
 * The app row carries at most a *summary* of one connection — a status, an
 * id and a label, flattened onto the app itself. The drawer needs the rows:
 * "Authorization in progress", Cancel setup, Disconnect, per-account tool
 * policy and the multi-account list are all read off `connections`, and a
 * summary reconstituted into a single synthetic row silently drops eleven
 * of its eighteen fields and every account after the first.
 *
 * Both the browse catalogue and a by-slug resolve go through here, so the
 * two cannot hand the same drawer different data.
 */
export function mergeDefinitionsWithConnections(
  providerDefinitions: IntegrationDefinition[],
  providerConnections: IntegrationConnection[]
): IntegrationDefinition[] {
  const visibleConnections = providerConnections.filter(
    (connection) => connection.status !== 'disconnected' && !isTriggerOnlyConnection(connection)
  );
  const bySlug = new Map<string, IntegrationConnection[]>();
  for (const connection of visibleConnections) {
    bySlug.set(connection.canonicalSlug, [
      ...(bySlug.get(connection.canonicalSlug) ?? []),
      connection,
    ]);
  }
  return providerDefinitions.map((definition) => {
    const connections = bySlug.get(definition.canonicalSlug) ?? [];
    if (connections.length === 0) return definition;
    return {
      ...definition,
      status: connections[0]?.status ?? definition.status,
      connections: [
        ...connections,
        ...definition.connections.filter(
          (item) =>
            !connections.some((connection) => connection.id === item.id) &&
            item.status !== 'disconnected'
        ),
      ],
    };
  });
}

export async function listProviderIntegrationDefinitionsBySlugs(args: {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
  slugs: string[];
}): Promise<IntegrationDefinition[]> {
  const slugs = [...new Set(args.slugs)].filter(Boolean);
  if (slugs.length === 0) return [];

  const [appPage, providerConnections] = await Promise.all([
    builtinsLogFetch<ProviderAppPayload>({
      context: 'Integrations/Apps',
      limit: slugs.length,
      offset: 0,
      filter: `canonical_app_slug in ${JSON.stringify([...slugs].sort())}`,
      fromFields: BUILTINS_APP_PUBLIC_FIELDS,
    }),
    listProviderIntegrationConnections({
      ownerScope: args.ownerScope,
      assistantId: args.assistantId,
    }).catch(() => []),
  ]);

  const bySlug = connectionsBySlug(providerConnections);
  const definitions = (appPage.logs ?? [])
    .map((log) => log.entries)
    .filter(Boolean)
    .map((app) => mapProviderAppToDefinition(overlayAppConnections(app!, bySlug)));
  return mergeDefinitionsWithConnections(definitions, providerConnections);
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
      filter: `canonical_app_slug == ${quoteFilterValue(args.canonicalSlug)}`,
      fromFields: BUILTINS_APP_PUBLIC_FIELDS,
    }),
    builtinsLogFetch<UnknownRecord>({
      context: 'Integrations/Tools',
      limit: 500,
      offset: 0,
      filter: toolAppSlugFilter(args.canonicalSlug),
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

export type IntegrationUsageMode = 'primary' | 'explicit' | 'pool';

export type IntegrationAppPreference = {
  canonicalAppSlug: string;
  ownerScope: IntegrationOwnerScope;
  usageMode: IntegrationUsageMode;
  poolCursor: number;
  updatedAt?: string | null;
};

export async function getProviderIntegrationAppPreference(args: {
  canonicalSlug: string;
  ownerScope?: IntegrationOwnerScope;
  assistantId: string | number;
}): Promise<IntegrationAppPreference> {
  const params = new URLSearchParams();
  params.set('owner_scope', args.ownerScope ?? 'assistant');
  params.set('assistant_id', String(args.assistantId));
  const data = await integrationFetch<Record<string, unknown>>(
    `apps/${encodeURIComponent(args.canonicalSlug)}/preferences?${params.toString()}`
  );
  const camel = snakeToCamelObject(data) as Record<string, unknown>;
  return {
    canonicalAppSlug: String(camel.canonicalAppSlug ?? args.canonicalSlug),
    ownerScope: (camel.ownerScope as IntegrationOwnerScope) ?? 'assistant',
    usageMode: (camel.usageMode as IntegrationUsageMode) ?? 'primary',
    poolCursor: Number(camel.poolCursor ?? 0),
    updatedAt: (camel.updatedAt as string | null | undefined) ?? null,
  };
}

export async function updateProviderIntegrationAppPreference(args: {
  canonicalSlug: string;
  ownerScope?: IntegrationOwnerScope;
  assistantId: string | number;
  usageMode: IntegrationUsageMode;
}): Promise<IntegrationAppPreference> {
  const data = await integrationFetch<Record<string, unknown>>(
    `apps/${encodeURIComponent(args.canonicalSlug)}/preferences`,
    {
      method: 'PATCH',
      body: JSON.stringify(
        camelToSnakeObject({
          ownerScope: args.ownerScope ?? 'assistant',
          assistantId: args.assistantId,
          usageMode: args.usageMode,
        })
      ),
    }
  );
  const camel = snakeToCamelObject(data) as Record<string, unknown>;
  return {
    canonicalAppSlug: String(camel.canonicalAppSlug ?? args.canonicalSlug),
    ownerScope: (camel.ownerScope as IntegrationOwnerScope) ?? 'assistant',
    usageMode: (camel.usageMode as IntegrationUsageMode) ?? 'primary',
    poolCursor: Number(camel.poolCursor ?? 0),
    updatedAt: (camel.updatedAt as string | null | undefined) ?? null,
  };
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

export interface ProviderCustomAuthConfig {
  backendId: string;
  toolkitSlug: string;
  authConfigId: string;
  authScheme: string;
  scopes: string[];
  managed: boolean;
  oauthRedirectUri?: string | null;
  displayName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ProviderCustomAuthConfigRequest {
  toolkitSlug: string;
  clientId: string;
  clientSecret: string;
  authScheme?: string;
  scopes?: string[];
  displayName?: string | null;
  oauthRedirectUri?: string | null;
}

export async function listProviderCustomAuthConfigs(
  backendId: string
): Promise<ProviderCustomAuthConfig[]> {
  const data = await providerAdminFetch<{ configs?: ProviderCustomAuthConfig[] }>(
    `backends/${encodeURIComponent(backendId)}/custom-auth`
  );
  return Array.isArray(data?.configs) ? data.configs : [];
}

export async function setProviderCustomAuthConfig(
  backendId: string,
  request: ProviderCustomAuthConfigRequest
): Promise<ProviderCustomAuthConfig> {
  return providerAdminFetch<ProviderCustomAuthConfig>(
    `backends/${encodeURIComponent(backendId)}/custom-auth`,
    {
      method: 'PUT',
      body: JSON.stringify(camelToSnakeObject(request)),
    }
  );
}

export async function deleteProviderCustomAuthConfig(
  backendId: string,
  toolkitSlug: string
): Promise<void> {
  await providerAdminFetch(
    `backends/${encodeURIComponent(backendId)}/custom-auth/${encodeURIComponent(toolkitSlug)}`,
    { method: 'DELETE' }
  );
}
