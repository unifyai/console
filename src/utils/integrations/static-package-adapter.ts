import {
  INTEGRATION_PROVIDERS,
  customerProvidedSecretKeysFor,
} from '@/constants/assistants/integrations';
import type {
  IntegrationCardState,
  IntegrationProviderConfig,
} from '@/types/assistants/integration';
import type { Secret } from '@/types/assistants/secret';
import type {
  IntegrationApiKeySchema,
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationDefinition,
  IntegrationScope,
  IntegrationSourceMetadata,
} from '@/types/integrations';

function slugForProvider(provider: IntegrationProviderConfig): string {
  return provider.id === 'custom' ? 'custom_secret' : provider.id;
}

function statusFromStaticState(state: IntegrationCardState): IntegrationConnectionStatus {
  switch (state.kind) {
    case 'connected':
      return 'connected';
    case 'configured':
      return 'configured';
    case 'needs_reconnect':
      return 'needs_reconnect';
  }
}

function authModesForProvider(
  provider: IntegrationProviderConfig
): IntegrationDefinition['authModes'] {
  switch (provider.auth.kind) {
    case 'freeform':
      return ['custom'];
    case 'api_key':
      return ['api_key'];
    case 'api_key_multi':
      return ['api_key_multi'];
    case 'oauth_authorization_code':
      return ['oauth'];
  }
}

function apiKeySchemaForProvider(
  provider: IntegrationProviderConfig
): IntegrationApiKeySchema | null {
  if (provider.auth.kind === 'api_key') {
    return {
      fields: [
        {
          id: provider.auth.field.secretKey,
          label: provider.auth.field.label,
          description: provider.auth.field.helpText,
          placeholder: provider.auth.field.placeholder,
          required: !provider.auth.field.optional,
          sensitive: provider.auth.field.sensitive,
          maskedValueLabel: 'Saved secret',
        },
      ],
      submitLabel: 'Save API key',
    };
  }
  if (provider.auth.kind === 'api_key_multi') {
    return {
      fields: provider.auth.fields.map((field) => ({
        id: field.secretKey,
        label: field.label,
        description: field.helpText,
        placeholder: field.placeholder,
        required: !field.optional,
        sensitive: field.sensitive,
        maskedValueLabel: 'Saved secret',
      })),
      submitLabel: 'Save credentials',
    };
  }
  return null;
}

function staticScopesForProvider(provider: IntegrationProviderConfig): IntegrationScope[] {
  if (provider.auth.kind !== 'oauth_authorization_code' || !provider.auth.oauth.scope) return [];
  return provider.auth.oauth.scope.split(/\s+/).map((scope) => ({
    id: scope,
    label: scope,
    required: true,
  }));
}

function sourceMetadataForProvider(provider: IntegrationProviderConfig): IntegrationSourceMetadata {
  return {
    source: provider.id === 'custom' ? 'custom_secret' : 'static_package',
    label: provider.id === 'custom' ? 'Custom credentials' : 'Native connector',
    staticProviderId: provider.id,
  };
}

export function mapStaticProviderToDefinition(
  provider: IntegrationProviderConfig,
  state?: IntegrationCardState,
  ownedSecrets: Secret[] = []
): IntegrationDefinition {
  const sourceMetadata = sourceMetadataForProvider(provider);
  const status = state ? statusFromStaticState(state) : 'not_connected';
  const canonicalSlug = slugForProvider(provider);
  const customerKeys = customerProvidedSecretKeysFor(provider);
  const connection: IntegrationConnection | null =
    state && provider.id !== 'custom'
      ? {
          id: `static:${provider.id}`,
          definitionId: canonicalSlug,
          canonicalSlug,
          source: 'static_package',
          status,
          accountLabel:
            ownedSecrets.length > 0
              ? `${ownedSecrets.length} saved ${ownedSecrets.length === 1 ? 'secret' : 'secrets'}`
              : null,
          healthLabel: state.kind === 'needs_reconnect' ? 'Action needed' : 'Configured',
          reconnectReason:
            state.kind === 'needs_reconnect' && state.missing.length > 0
              ? `Missing ${state.missing.join(', ')}`
              : null,
          sourceMetadata,
        }
      : null;

  return {
    id: canonicalSlug,
    canonicalSlug,
    displayName: provider.label,
    description: provider.shortDescription,
    category: provider.id === 'custom' ? 'Custom app' : 'Native app',
    iconUrl: null,
    authModes: authModesForProvider(provider),
    status,
    source: sourceMetadata.source,
    sourceMetadata,
    scopes: staticScopesForProvider(provider),
    capabilityGroups: [
      {
        id: `${canonicalSlug}-runtime`,
        label: provider.id === 'custom' ? 'Custom credentials' : 'Native connector',
        description:
          provider.id === 'custom'
            ? 'Use this for custom credentials that are specific to your assistant.'
            : 'A curated connector maintained for this app.',
        policyLabels: customerKeys.length > 0 ? [`${customerKeys.length} credential fields`] : [],
      },
    ],
    tools: [],
    apiKeySchema: apiKeySchemaForProvider(provider),
    docsUrl: provider.docsUrl,
    connections: connection ? [connection] : [],
    staticProvider: provider,
  };
}

export function buildStaticIntegrationDefinitions(args: {
  cards: Array<{
    provider: IntegrationProviderConfig;
    state: IntegrationCardState;
    ownedSecrets: Secret[];
  }>;
  includeUnconfigured?: boolean;
}): IntegrationDefinition[] {
  const cardByProviderId = new Map(args.cards.map((card) => [card.provider.id, card]));
  const staticProviders = INTEGRATION_PROVIDERS.filter((provider) => provider.id !== 'custom');
  return staticProviders
    .map((provider) => {
      const card = cardByProviderId.get(provider.id);
      if (!card && !args.includeUnconfigured) return null;
      return mapStaticProviderToDefinition(provider, card?.state, card?.ownedSecrets ?? []);
    })
    .filter((definition): definition is IntegrationDefinition => Boolean(definition));
}

export function buildCustomSecretDefinition(customSecretCount: number): IntegrationDefinition {
  const provider = INTEGRATION_PROVIDERS.find((item) => item.id === 'custom');
  if (!provider) {
    throw new Error('Static integration registry is missing the custom secret entry.');
  }
  const definition = mapStaticProviderToDefinition(provider);
  return {
    ...definition,
    status: customSecretCount > 0 ? 'configured' : 'not_connected',
    connections:
      customSecretCount > 0
        ? [
            {
              id: 'custom:secrets',
              definitionId: definition.id,
              canonicalSlug: definition.canonicalSlug,
              source: 'custom_secret',
              status: 'configured',
              accountLabel: `${customSecretCount} custom ${
                customSecretCount === 1 ? 'secret' : 'secrets'
              }`,
              sourceMetadata: definition.sourceMetadata,
            },
          ]
        : [],
  };
}
