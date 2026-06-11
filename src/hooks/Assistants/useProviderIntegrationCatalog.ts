'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { openPendingOAuthTab } from '@/utils/assistants/oauth';
import {
  getProviderIntegrationDetails,
  listProviderIntegrationConnections,
  listProviderIntegrationDefinitionsPage,
  requestUnityIntegrationToolsSync,
  startProviderIntegrationConnect,
} from '@/lib/client/integrations';
import {
  MOCK_PROVIDER_INTEGRATION_DEFINITIONS,
  shouldUseMockProviderIntegrations,
} from '@/utils/assistants/provider-integration-mock-data';
import { subscribeOAuthComplete } from '@/utils/assistants/oauth';
import type {
  IntegrationConnection,
  IntegrationDefinition,
  IntegrationSourceKind,
  IntegrationOwnerScope,
  ProviderIntegrationConnectStartResponse,
} from '@/types/integrations';

const PROVIDER_CATALOG_PAGE_SIZE = 100;

type ProviderCatalogSourceType = 'native' | 'third_party';

interface UseProviderIntegrationCatalogOptions {
  ownerScope?: IntegrationOwnerScope;
  query?: string;
  sourceType?: ProviderCatalogSourceType | null;
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

function mergeDefinitionsWithConnections(
  providerDefinitions: IntegrationDefinition[],
  providerConnections: IntegrationConnection[]
): IntegrationDefinition[] {
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
  return providerDefinitions.map((definition) => {
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
  });
}

export function useProviderIntegrationCatalog(
  assistantId: string,
  options: UseProviderIntegrationCatalogOptions = {}
) {
  const ownerScope = options.ownerScope ?? 'assistant';
  const query = options.query ?? '';
  const sourceType = options.sourceType ?? null;
  const [definitions, setDefinitions] = React.useState<IntegrationDefinition[]>([]);
  const [detailsBySlug, setDetailsBySlug] = React.useState<Record<string, IntegrationDefinition>>(
    {}
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [isDetailLoading, setIsDetailLoading] = React.useState<string | null>(null);
  const [isConnecting, setIsConnecting] = React.useState<string | null>(null);
  const [isMock, setIsMock] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [nextOffset, setNextOffset] = React.useState(0);
  const providerConnectionsRef = React.useRef<IntegrationConnection[]>([]);
  const isLoadingMoreRef = React.useRef(false);

  const hasMore = !isMock && hasLoaded && nextOffset < total;

  const fetchCatalog = React.useCallback(async () => {
    if (!assistantId) return;
    const useMock = shouldUseMockProviderIntegrations();
    setIsMock(useMock);
    if (useMock) {
      setDefinitions(MOCK_PROVIDER_INTEGRATION_DEFINITIONS);
      setDetailsBySlug({});
      setIsLoading(false);
      setIsLoadingMore(false);
      setHasLoaded(true);
      setTotal(MOCK_PROVIDER_INTEGRATION_DEFINITIONS.length);
      setNextOffset(MOCK_PROVIDER_INTEGRATION_DEFINITIONS.length);
      providerConnectionsRef.current = [];
      isLoadingMoreRef.current = false;
      return;
    }
    setIsLoading(true);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    try {
      const [page, providerConnections] = await Promise.all([
        listProviderIntegrationDefinitionsPage({
          ownerScope,
          assistantId,
          query,
          sourceType,
          limit: PROVIDER_CATALOG_PAGE_SIZE,
          offset: 0,
        }),
        listProviderIntegrationConnections({ ownerScope, assistantId }).catch((error) => {
          console.error('Failed to load provider integration connections', error);
          return [];
        }),
      ]);
      providerConnectionsRef.current = providerConnections;
      setDefinitions(mergeDefinitionsWithConnections(page.definitions, providerConnections));
      setTotal(page.total);
      setNextOffset(
        Math.min(page.offset + Math.max(page.definitions.length, page.limit), page.total)
      );
    } catch (error) {
      console.error('Failed to load provider integration catalog', error);
      toast.error('Could not load integrations. Please try again.');
      setDefinitions([]);
      setTotal(0);
      setNextOffset(0);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [assistantId, ownerScope, query, sourceType]);

  const loadMore = React.useCallback(async () => {
    if (!assistantId || isMock || isLoadingMoreRef.current || isLoading || nextOffset >= total) {
      return;
    }
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const page = await listProviderIntegrationDefinitionsPage({
        ownerScope,
        assistantId,
        query,
        sourceType,
        limit: PROVIDER_CATALOG_PAGE_SIZE,
        offset: nextOffset,
      });
      const merged = mergeDefinitionsWithConnections(
        page.definitions,
        providerConnectionsRef.current
      );
      setDefinitions((current) => {
        const bySlug = new Map(current.map((definition) => [definition.canonicalSlug, definition]));
        for (const definition of merged) {
          bySlug.set(definition.canonicalSlug, definition);
        }
        return Array.from(bySlug.values());
      });
      setTotal(page.total);
      setNextOffset(
        Math.min(page.offset + Math.max(page.definitions.length, page.limit), page.total)
      );
    } catch (error) {
      console.error('Failed to load more provider integrations', error);
      toast.error('Could not load more integrations. Please try again.');
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [assistantId, isLoading, isMock, nextOffset, ownerScope, query, sourceType, total]);

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
    isLoadingMore,
    hasLoaded,
    hasMore,
    total,
    isDetailLoading,
    isConnecting,
    refresh: fetchCatalog,
    loadMore,
    fetchDetails,
    startConnect,
  };
}
