import type {
  IntegrationProviderConfig,
  IntegrationProviderId,
} from '@/types/assistants/integration';

export type IntegrationOwnerScope = 'assistant' | 'user' | 'team' | 'org';
export type IntegrationToolApprovalLevel = 'auto' | 'specific_approval' | 'forbidden';
export type IntegrationToolBehaviorHint =
  | 'read_only'
  | 'mutates_state'
  | 'destructive'
  | 'sensitive_data'
  | 'bulk_data'
  | 'idempotent'
  | 'external'
  | 'creates_resource'
  | 'updates_resource'
  | 'unknown_effects';

export type IntegrationSourceKind =
  | 'static_package'
  | 'provider_backed'
  | 'overlay_curated'
  | 'custom_secret'
  | 'workspace_integration';

export type IntegrationAuthMode =
  | 'oauth'
  | 'api_key'
  | 'api_key_multi'
  | 'custom'
  | 'native'
  | 'oauth_authorization_code';

export type IntegrationConnectionStatus =
  | 'connected'
  | 'configured'
  | 'pending'
  | 'missing_scope'
  | 'missing_secrets'
  | 'needs_reconnect'
  | 'expired'
  | 'revoked'
  | 'disconnected'
  | 'error'
  | 'not_connected';

export interface IntegrationScope {
  id: string;
  label: string;
  description?: string | null;
  required?: boolean;
}

export interface IntegrationCapabilityGroup {
  id: string;
  label: string;
  description?: string | null;
  scopes?: IntegrationScope[];
  toolIds?: string[];
  policyLabels?: string[];
}

export interface IntegrationLabel {
  key: string;
  label: string;
}

export interface IntegrationLabels {
  primaryCategory?: IntegrationLabel | null;
  categories: IntegrationLabel[];
  tags: IntegrationLabel[];
}

export interface IntegrationToolPreview {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  providerToolId?: string | null;
  canonicalName?: string | null;
  functionManagerName?: string | null;
  appSlug?: string | null;
  appDisplayName?: string | null;
  providerAppId?: string | null;
  connectionId?: string | null;
  activationState?:
    | 'connected_ready'
    | 'not_connected'
    | 'missing_scope'
    | 'disabled_by_policy'
    | 'expired'
    | 'error';
  actionClass?: 'read' | 'write' | 'destructive' | 'bulk_export' | 'sensitive_read' | string;
  behaviorHints?: IntegrationToolBehaviorHint[];
  requiredScopes?: IntegrationScope[];
  confirmationRequired?: boolean;
  approvalLevel?: IntegrationToolApprovalLevel;
}

export interface IntegrationApiKeyField {
  id: string;
  label: string;
  description?: string | null;
  placeholder?: string;
  required?: boolean;
  sensitive?: boolean;
  maskedValueLabel?: string | null;
}

export interface IntegrationApiKeySchema {
  fields: IntegrationApiKeyField[];
  submitLabel?: string;
}

export interface IntegrationSourceMetadata {
  source: IntegrationSourceKind;
  label: string;
  sourceType?: 'native' | 'third_party';
  backendId?: string | null;
  providerAppId?: string | null;
  providerConnectionId?: string | null;
  staticProviderId?: IntegrationProviderId;
  overlayCurated?: boolean;
  nativeMetadata?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
}

export interface IntegrationConnection {
  id: string;
  definitionId: string;
  canonicalSlug: string;
  source: IntegrationSourceKind;
  status: IntegrationConnectionStatus;
  ownerScope?: IntegrationOwnerScope;
  accountLabel?: string | null;
  healthLabel?: string | null;
  lastCheckedAt?: string | null;
  reconnectReason?: string | null;
  grantedScopes?: IntegrationScope[];
  enabledCapabilities?: IntegrationCapabilityGroup[];
  toolPolicy?: Record<string, IntegrationToolApprovalLevel>;
  sourceMetadata?: IntegrationSourceMetadata;
}

export interface IntegrationDefinition {
  id: string;
  canonicalSlug: string;
  displayName: string;
  description?: string | null;
  category?: string | null;
  labels?: IntegrationLabels | null;
  iconUrl?: string | null;
  authModes: IntegrationAuthMode[];
  status: IntegrationConnectionStatus;
  source: IntegrationSourceKind;
  sourceMetadata: IntegrationSourceMetadata;
  scopes: IntegrationScope[];
  capabilityGroups: IntegrationCapabilityGroup[];
  tools: IntegrationToolPreview[];
  toolCount?: number;
  apiKeySchema?: IntegrationApiKeySchema | null;
  // OAuth-capable app with no provider-managed credentials: it can only be
  // connected once an admin registers a custom ("bring your own") OAuth app.
  requiresCustomOauth?: boolean;
  docsUrl?: string | null;
  connections: IntegrationConnection[];
  staticProvider?: IntegrationProviderConfig;
}

export interface IntegrationGalleryItem extends IntegrationDefinition {
  sources: IntegrationSourceMetadata[];
  primaryConnection?: IntegrationConnection | null;
  isMock?: boolean;
}

export interface ProviderIntegrationCatalogState {
  definitions: IntegrationDefinition[];
  connections: IntegrationConnection[];
  isMock: boolean;
}

export interface ProviderIntegrationConnectStartRequest {
  ownerScope: IntegrationOwnerScope;
  assistantId?: string | number;
  canonicalAppSlug: string;
  backendId?: string | null;
  providerAppId?: string | null;
  requestedScopes: string[];
  authMode: IntegrationAuthMode;
  redirectUrl: string;
  apiKeyValues?: Record<string, string>;
  accountLabel?: string;
}

export interface ProviderIntegrationConnectStartResponse {
  connection: IntegrationConnection;
  connectUrl?: string | null;
  authMode: IntegrationAuthMode;
  requiresBrowserRedirect: boolean;
  requestedScopes: string[];
}

export interface IntegrationToolPolicyItem {
  toolId: string;
  providerToolId: string;
  canonicalName: string;
  displayName: string;
  actionClass: IntegrationToolPreview['actionClass'];
  behaviorHints?: IntegrationToolBehaviorHint[];
  defaultApprovalLevel: IntegrationToolApprovalLevel;
  approvalLevel: IntegrationToolApprovalLevel;
  activationState?: IntegrationToolPreview['activationState'];
  confirmationRequired?: boolean;
}

export interface IntegrationToolPolicyResponse {
  connectionId: string;
  canonicalAppSlug: string;
  appDisplayName?: string | null;
  accountLabel?: string | null;
  policies: IntegrationToolPolicyItem[];
}
