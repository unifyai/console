'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { openPendingOAuthTab } from '@/utils/assistants/oauth';
import {
  getProviderIntegrationDetails,
  listProviderIntegrationConnections,
  listProviderIntegrationDefinitions,
  requestUnityIntegrationToolsSync,
  startProviderIntegrationConnect,
} from '@/lib/client/integrations';
import {
  MOCK_PROVIDER_INTEGRATION_DEFINITIONS,
  shouldUseMockProviderIntegrations,
} from '@/utils/assistants/provider-integration-mock-data';
import { subscribeOAuthComplete } from '@/utils/assistants/oauth';
import type {
  IntegrationDefinition,
  IntegrationSourceKind,
  IntegrationOwnerScope,
  ProviderIntegrationConnectStartResponse,
} from '@/types/integrations';

interface UseProviderIntegrationCatalogOptions {
  ownerScope?: IntegrationOwnerScope;
}

function buildProviderIntegrationCallbackUrl(returnTo: string, assistantId: string): string {
  const url = new URL('/integrations/callback', window.location.origin);
  url.searchParams.set('return', returnTo);
  url.searchParams.set('assistant_id', assistantId);
  return url.toString();
}

function hasDeferredProviderDetails(source: IntegrationSourceKind): boolean {
  return source === 'provider_backed' || source === 'overlay_curated';
}

export function useProviderIntegrationCatalog(
  assistantId: string,
  options: UseProviderIntegrationCatalogOptions = {}
) {
  const ownerScope = options.ownerScope ?? 'assistant';
  const [definitions, setDefinitions] = React.useState<IntegrationDefinition[]>([]);
  const [detailsBySlug, setDetailsBySlug] = React.useState<Record<string, IntegrationDefinition>>(
    {}
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [isDetailLoading, setIsDetailLoading] = React.useState<string | null>(null);
  const [isConnecting, setIsConnecting] = React.useState<string | null>(null);
  const [isMock, setIsMock] = React.useState(false);

  const fetchCatalog = React.useCallback(async () => {
    if (!assistantId) return;
    const useMock = shouldUseMockProviderIntegrations();
    setIsMock(useMock);
    if (useMock) {
      setDefinitions(MOCK_PROVIDER_INTEGRATION_DEFINITIONS);
      setDetailsBySlug({});
      setIsLoading(false);
      setHasLoaded(true);
      return;
    }
    setIsLoading(true);
    try {
      const [providerDefinitions, providerConnections] = await Promise.all([
        listProviderIntegrationDefinitions({ ownerScope, assistantId }),
        listProviderIntegrationConnections({ ownerScope, assistantId }).catch((error) => {
          console.error('Failed to load provider integration connections', error);
          return [];
        }),
      ]);
      const visibleConnections = providerConnections.filter(
        (connection) => connection.status !== 'disconnected'
      );
      const connectionsBySlug = new Map<string, typeof visibleConnections>();
      for (const connection of visibleConnections) {
        connectionsBySlug.set(connection.canonicalSlug, [
          ...(connectionsBySlug.get(connection.canonicalSlug) ?? []),
          connection,
        ]);
      }
      setDefinitions(
        providerDefinitions.map((definition) => {
          const connections = connectionsBySlug.get(definition.canonicalSlug) ?? [];
          if (connections.length === 0) return definition;
          return {
            ...definition,
            status: connections[0].status,
            connections: [
              ...connections,
              ...definition.connections.filter(
                (item) =>
                  !connections.some((connection) => connection.id === item.id) &&
                  item.status !== 'disconnected'
              ),
            ],
          };
        })
      );
    } catch (error) {
      console.error('Failed to load provider integration catalog', error);
      toast.error('Could not load integrations. Please try again.');
      setDefinitions([]);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [assistantId, ownerScope]);

  React.useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('integration_success') !== 'provider') return;
    let cancelled = false;
    const refreshUntilSettled = async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        await fetchCatalog();
        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
    };
    void refreshUntilSettled();
    return () => {
      cancelled = true;
    };
  }, [fetchCatalog]);

  React.useEffect(() => {
    return subscribeOAuthComplete((detail) => {
      if (detail.kind !== 'integration') return;
      void fetchCatalog();
      window.setTimeout(() => void fetchCatalog(), 800);
      window.setTimeout(() => void fetchCatalog(), 1600);
    });
  }, [fetchCatalog]);

  const fetchDetails = React.useCallback(
    async (definition: IntegrationDefinition): Promise<IntegrationDefinition | null> => {
      if (isMock || !hasDeferredProviderDetails(definition.source)) {
        setDetailsBySlug((current) => ({ ...current, [definition.canonicalSlug]: definition }));
        return definition;
      }
      setIsDetailLoading(definition.canonicalSlug);
      try {
        const detail = await getProviderIntegrationDetails({
          ownerScope,
          assistantId: Number.isNaN(Number(assistantId)) ? assistantId : Number(assistantId),
          canonicalSlug: definition.canonicalSlug,
        });
        setDetailsBySlug((current) => ({ ...current, [definition.canonicalSlug]: detail }));
        return detail;
      } catch (error) {
        console.error('Failed to load provider integration details', error);
        toast.error('Could not load integration details. Please try again.');
        return null;
      } finally {
        setIsDetailLoading(null);
      }
    },
    [assistantId, isMock, ownerScope]
  );

  const startConnect = React.useCallback(
    async (
      definition: IntegrationDefinition,
      apiKeyValues?: Record<string, string>,
      options: { accountLabel?: string } = {}
    ): Promise<ProviderIntegrationConnectStartResponse | null> => {
      if (isMock) {
        setIsConnecting(definition.canonicalSlug);
        toast.success(`Started ${definition.displayName} connection.`);
        setIsConnecting(null);
        return null;
      }
      if (
        definition.sourceMetadata?.sourceType === 'native' ||
        definition.authModes.includes('native')
      ) {
        toast.message(
          `${definition.displayName} is a native integration and does not require provider connection.`
        );
        return null;
      }
      const primaryAuthMode = definition.authModes.includes('oauth')
        ? 'oauth'
        : (definition.authModes[0] ?? 'api_key');
      const pendingTab = primaryAuthMode === 'oauth' ? openPendingOAuthTab() : null;
      setIsConnecting(definition.canonicalSlug);
      try {
        const data = await startProviderIntegrationConnect({
          ownerScope,
          assistantId: Number.isNaN(Number(assistantId)) ? assistantId : Number(assistantId),
          canonicalAppSlug: definition.canonicalSlug,
          backendId: definition.sourceMetadata.backendId,
          requestedScopes: definition.scopes.map((scope) => scope.id),
          authMode: primaryAuthMode,
          redirectUrl:
            primaryAuthMode === 'oauth'
              ? buildProviderIntegrationCallbackUrl(
                  `${window.location.pathname}${window.location.search}`,
                  assistantId
                )
              : window.location.pathname,
          apiKeyValues,
          accountLabel: options.accountLabel,
        });
        if (data.connectUrl) {
          if (pendingTab?.opened) pendingTab.navigate(data.connectUrl);
          else {
            window.open(
              data.connectUrl,
              'unify-oauth-popup',
              'popup=yes,width=560,height=720,resizable=yes,scrollbars=yes'
            );
          }
        } else {
          pendingTab?.close();
          toast.success(`Started ${definition.displayName} connection.`);
        }
        if (!data.connectUrl && data.connection.status === 'connected') {
          void requestUnityIntegrationToolsSync({
            assistantId,
            connection: data.connection,
          }).catch((error) => {
            console.warn('Failed to request Unity integration tool sync', error);
          });
        }
        await fetchCatalog();
        setDetailsBySlug((current) => {
          const next = { ...current };
          delete next[definition.canonicalSlug];
          return next;
        });
        return data;
      } catch (error) {
        pendingTab?.close();
        console.error('Failed to start provider integration connection', error);
        toast.error('Could not start connection. Please try again.');
        return null;
      } finally {
        setIsConnecting(null);
      }
    },
    [assistantId, fetchCatalog, isMock, ownerScope]
  );

  return {
    definitions,
    apps: definitions,
    detailsBySlug,
    isMock,
    isLoading,
    hasLoaded,
    isDetailLoading,
    isConnecting,
    refresh: fetchCatalog,
    fetchDetails,
    startConnect,
  };
}
