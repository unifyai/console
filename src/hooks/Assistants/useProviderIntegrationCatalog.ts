'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { openPendingOAuthTab } from '@/utils/assistants/oauth';
import {
  getProviderIntegrationCatalogCount,
  getProviderIntegrationDetails,
  listProviderIntegrationConnections,
  listProviderIntegrationDefinitionsBySlugs,
  mergeDefinitionsWithConnections,
  listProviderIntegrationDefinitionsPage,
  requestUnityIntegrationToolsSync,
  startProviderIntegrationConnect,
  type ProviderAppCatalogFacets,
  type ProviderAppStatusGroup,
} from '@/lib/client/integrations';
import {
  MOCK_PROVIDER_INTEGRATION_DEFINITIONS,
  shouldUseMockProviderIntegrations,
} from '@/utils/assistants/provider-integration-mock-data';
import { subscribeOAuthComplete } from '@/utils/assistants/oauth';
import {
  broadcastIntegrationConnectSettled,
  subscribeIntegrationDisconnectSettled,
} from '@/lib/assistants/coordinatorIntegrationConnect';
import { isTriggerOnlyConnection } from '@/types/integrations';
import type {
  IntegrationConnection,
  IntegrationDefinition,
  IntegrationSourceKind,
  IntegrationOwnerScope,
  ProviderIntegrationConnectStartResponse,
} from '@/types/integrations';

const PROVIDER_CATALOG_PAGE_SIZE = 100;
const PINNED_STATUS_GROUPS: ProviderAppStatusGroup[] = ['connected', 'needs_attention'];

type ProviderCatalogSourceType = 'native' | 'third_party';

interface UseProviderIntegrationCatalogOptions {
  ownerScope?: IntegrationOwnerScope;
  query?: string;
  /**
   * Resolve exactly these apps instead of browsing.
   *
   * A caller that already knows which apps it wants — a workflow's declared
   * requirements — must not go through `query`. That is a substring match
   * across display name, slug and description, returned one page at a time,
   * so the app asked for can be crowded off the page by everything else
   * mentioning the same word, and there is no way to tell that from "the
   * catalogue does not have it".
   */
  slugs?: string[];
  sourceType?: ProviderCatalogSourceType | null;
  category?: string | null;
  statusGroups?: ProviderAppStatusGroup[];
  enabled?: boolean;
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

function statusGroupForDefinition(definition: IntegrationDefinition): ProviderAppStatusGroup {
  if (definition.status === 'connected' || definition.status === 'configured') return 'connected';
  if (
    [
      'pending',
      'missing_scope',
      'missing_secrets',
      'needs_reconnect',
      'expired',
      'revoked',
      'error',
    ].includes(definition.status)
  ) {
    return 'needs_attention';
  }
  return 'not_connected';
}

function filterDefinitionsByStatusGroups(
  definitions: IntegrationDefinition[],
  statusGroups: ProviderAppStatusGroup[]
): IntegrationDefinition[] {
  if (statusGroups.length === 0) return definitions;
  const allowed = new Set(statusGroups);
  return definitions.filter((definition) => allowed.has(statusGroupForDefinition(definition)));
}

function mergeUniqueDefinitions(definitions: IntegrationDefinition[]): IntegrationDefinition[] {
  const bySlug = new Map<string, IntegrationDefinition>();
  for (const definition of definitions) {
    bySlug.set(definition.canonicalSlug, definition);
  }
  return Array.from(bySlug.values());
}

export function useProviderIntegrationCatalog(
  assistantId: string,
  options: UseProviderIntegrationCatalogOptions = {}
) {
  const enabled = options.enabled ?? true;
  const ownerScope = options.ownerScope ?? 'assistant';
  const query = options.query ?? '';
  const sourceType = options.sourceType ?? null;
  const category = options.category ?? null;
  const statusGroupsKey = (options.statusGroups ?? []).join(',');
  const statusGroups = React.useMemo(
    () => (statusGroupsKey ? (statusGroupsKey.split(',') as ProviderAppStatusGroup[]) : []),
    [statusGroupsKey]
  );
  const slugsKey = [...new Set(options.slugs ?? [])].sort().join(',');
  const slugs = React.useMemo(() => (slugsKey ? slugsKey.split(',') : []), [slugsKey]);
  const requestKey = `${assistantId}:${ownerScope}:${slugsKey}:${query}:${sourceType ?? 'all'}:${category ?? 'all'}:${statusGroupsKey}`;
  const loadedRequestKeyRef = React.useRef<string | null>(null);
  // Which request the rows on hand belong to.
  //
  // `hasLoaded` means "this hook has loaded something, ever" — it is never
  // reset once true, so on a second request it stays true while `definitions`
  // still holds the *previous* request's rows. A consumer reading it as "the
  // answer is in" concluded the app was missing from a list that had not been
  // asked for it yet.
  const [loadedRequestKey, setLoadedRequestKey] = React.useState<string | null>(null);
  const [definitions, setDefinitions] = React.useState<IntegrationDefinition[]>([]);
  // Connected + needs-attention apps, fetched independently of the browse
  // pagination so they always surface at the top under the "All" filter even
  // when their alphabetical position is far down the catalogue.
  const [pinnedDefinitions, setPinnedDefinitions] = React.useState<IntegrationDefinition[]>([]);
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
  const [hasMoreServer, setHasMoreServer] = React.useState(false);
  const [facets, setFacets] = React.useState<ProviderAppCatalogFacets | null>(null);
  const [catalogVersion, setCatalogVersion] = React.useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const providerConnectionsRef = React.useRef<IntegrationConnection[]>([]);
  const isLoadingMoreRef = React.useRef(false);
  const hasLoadedRef = React.useRef(hasLoaded);

  const hasMore = !isMock && hasLoaded && hasMoreServer;

  React.useEffect(() => {
    hasLoadedRef.current = hasLoaded;
  }, [hasLoaded]);

  const fetchCatalog = React.useCallback(
    async (options?: { background?: boolean }) => {
      if (!enabled || !assistantId) return;
      const background = options?.background ?? false;
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
        setHasMoreServer(false);
        setFacets(null);
        setCatalogVersion(null);
        setGeneratedAt(null);
        setPinnedDefinitions([]);
        providerConnectionsRef.current = [];
        isLoadingMoreRef.current = false;
        loadedRequestKeyRef.current = requestKey;
        setLoadedRequestKey(requestKey);
        return;
      }
      if (!background) {
        setIsLoading(true);
        setIsLoadingMore(false);
        if (!hasLoadedRef.current) {
          setHasLoaded(false);
          setDefinitions([]);
          setPinnedDefinitions([]);
        }
      }
      isLoadingMoreRef.current = false;
      // Named apps: one exact `in` query, no paging and no facets. There is
      // nothing to browse, so an app either comes back or genuinely is not
      // published — a distinction the substring search cannot make.
      if (slugs.length > 0) {
        try {
          const resolved = await listProviderIntegrationDefinitionsBySlugs({
            ownerScope,
            assistantId,
            slugs,
          });
          setDefinitions(resolved);
          setPinnedDefinitions([]);
          setTotal(resolved.length);
          setNextOffset(resolved.length);
          setHasMoreServer(false);
          setFacets(null);
          loadedRequestKeyRef.current = requestKey;
          setLoadedRequestKey(requestKey);
        } catch (error) {
          console.error('Failed to resolve provider integrations by slug', error);
          toast.error('Could not load integrations. Please try again.');
        } finally {
          setIsLoading(false);
          setHasLoaded(true);
        }
        return;
      }
      // Only the "All" view needs the pinned connected/needs-attention rows; the
      // dedicated status filters already scope the main list to those apps.
      const shouldPinConnected = statusGroups.length === 0;
      try {
        const [page, providerConnections, catalogCount, pinnedPage] = await Promise.all([
          listProviderIntegrationDefinitionsPage({
            ownerScope,
            assistantId,
            query,
            sourceType,
            category,
            statusGroups,
            detailLevel: 'summary',
            limit: PROVIDER_CATALOG_PAGE_SIZE,
            offset: 0,
          }),
          listProviderIntegrationConnections({ ownerScope, assistantId }).catch((error) => {
            console.error('Failed to load provider integration connections', error);
            return [];
          }),
          // A search applies a `contains` filter, so the list response's inline
          // count is already the exact match count (the filtered metric aggregation
          // is far slower and would time out). Only the unfiltered/faceted browse
          // needs the metric call for the true catalogue total.
          query?.trim()
            ? Promise.resolve<number | null>(null)
            : getProviderIntegrationCatalogCount({
                ownerScope,
                assistantId,
                sourceType,
                category,
                statusGroups,
              }).catch((error) => {
                console.error('Failed to load provider integration catalog count', error);
                return null;
              }),
          shouldPinConnected
            ? listProviderIntegrationDefinitionsPage({
                ownerScope,
                assistantId,
                query,
                sourceType,
                category,
                statusGroups: PINNED_STATUS_GROUPS,
                detailLevel: 'summary',
                limit: PROVIDER_CATALOG_PAGE_SIZE,
                offset: 0,
              }).catch((error) => {
                console.error('Failed to load connected provider integrations', error);
                return null;
              })
            : Promise.resolve(null),
        ]);
        providerConnectionsRef.current = providerConnections;
        setPinnedDefinitions(
          pinnedPage
            ? mergeDefinitionsWithConnections(
                mergeUniqueDefinitions(pinnedPage.definitions),
                providerConnections
              )
            : []
        );
        setDefinitions(
          filterDefinitionsByStatusGroups(
            mergeDefinitionsWithConnections(
              mergeUniqueDefinitions(page.definitions),
              providerConnections
            ),
            statusGroups
          )
        );
        const resolvedTotal = typeof catalogCount === 'number' ? catalogCount : page.total;
        setTotal(Math.max(resolvedTotal, page.definitions.length));
        setNextOffset(page.offset + page.definitions.length);
        setHasMoreServer(page.definitions.length >= PROVIDER_CATALOG_PAGE_SIZE);
        setFacets(
          page.facets && typeof catalogCount === 'number'
            ? { ...page.facets, total: catalogCount }
            : page.facets
        );
        setCatalogVersion(page.catalogVersion);
        setGeneratedAt(page.generatedAt);
        loadedRequestKeyRef.current = requestKey;
        setLoadedRequestKey(requestKey);
      } catch (error) {
        console.error('Failed to load provider integration catalog', error);
        toast.error('Could not load integrations. Please try again.');
        if (!hasLoadedRef.current) {
          setDefinitions([]);
          setPinnedDefinitions([]);
        }
        setTotal(0);
        setNextOffset(0);
        setHasMoreServer(false);
        setFacets(null);
        setCatalogVersion(null);
        setGeneratedAt(null);
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    },
    [assistantId, category, enabled, ownerScope, query, slugs, sourceType, statusGroups, requestKey]
  );

  const loadMore = React.useCallback(async () => {
    if (!assistantId || isMock || isLoadingMoreRef.current || isLoading || !hasMoreServer) {
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
        category,
        statusGroups,
        detailLevel: 'summary',
        limit: PROVIDER_CATALOG_PAGE_SIZE,
        offset: nextOffset,
      });
      const merged = filterDefinitionsByStatusGroups(
        mergeDefinitionsWithConnections(page.definitions, providerConnectionsRef.current),
        statusGroups
      );
      setDefinitions((current) => {
        const bySlug = new Map(current.map((definition) => [definition.canonicalSlug, definition]));
        for (const definition of merged) {
          bySlug.set(definition.canonicalSlug, definition);
        }
        return Array.from(bySlug.values());
      });
      setTotal((prev) => Math.max(prev, page.offset + page.definitions.length));
      setNextOffset(page.offset + page.definitions.length);
      setHasMoreServer(page.definitions.length >= PROVIDER_CATALOG_PAGE_SIZE);
      setCatalogVersion(page.catalogVersion);
      setGeneratedAt(page.generatedAt);
    } catch (error) {
      console.error('Failed to load more provider integrations', error);
      toast.error('Could not load more integrations. Please try again.');
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [
    assistantId,
    category,
    hasMoreServer,
    isLoading,
    isMock,
    nextOffset,
    ownerScope,
    query,
    sourceType,
    statusGroups,
  ]);

  const refresh = React.useCallback(async () => {
    if (!enabled || !assistantId) return;
    setDefinitions([]);
    setPinnedDefinitions([]);
    setHasLoaded(false);
    hasLoadedRef.current = false;
    await fetchCatalog();
  }, [assistantId, enabled, fetchCatalog]);

  React.useEffect(() => {
    if (loadedRequestKeyRef.current === requestKey) return;
    void fetchCatalog();
  }, [fetchCatalog, requestKey]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('integration_success') !== 'provider') return;
    let cancelled = false;
    const refreshUntilSettled = async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        await fetchCatalog({ background: true });
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
      void fetchCatalog({ background: true });
      window.setTimeout(() => void fetchCatalog({ background: true }), 800);
      window.setTimeout(() => void fetchCatalog({ background: true }), 1600);
    });
  }, [fetchCatalog]);

  React.useEffect(() => {
    return subscribeIntegrationDisconnectSettled((detail) => {
      if (detail.assistantId !== assistantId) return;
      void fetchCatalog({ background: true });
      window.setTimeout(() => void fetchCatalog({ background: true }), 800);
    });
  }, [assistantId, fetchCatalog]);

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
      options: {
        accountLabel?: string;
        /**
         * ``popup`` (default) opens/navigates the OAuth popup.
         * ``manual`` returns ``connectUrl`` without opening a popup so the
         * caller can copy it for a private-window authorize pass.
         */
        navigation?: 'popup' | 'manual';
      } = {}
    ): Promise<ProviderIntegrationConnectStartResponse | null> => {
      const primaryAuthMode = definition.authModes.includes('oauth')
        ? 'oauth'
        : (definition.authModes[0] ?? 'api_key');
      if (isMock) {
        setIsConnecting(definition.canonicalSlug);
        toast.success(`Started ${definition.displayName} connection.`);
        setIsConnecting(null);
        return {
          connectUrl: null,
          authMode: primaryAuthMode,
          requiresBrowserRedirect: false,
          requestedScopes: definition.scopes.map((scope) => scope.id),
          connection: {
            id: `mock-${definition.canonicalSlug}-connection`,
            definitionId: definition.id,
            canonicalSlug: definition.canonicalSlug,
            status: 'connected',
            accountLabel: options.accountLabel ?? null,
            ownerScope: 'assistant',
            source: definition.source,
          },
        };
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
      const navigation = options.navigation ?? 'popup';
      const pendingTab =
        primaryAuthMode === 'oauth' && navigation === 'popup' ? openPendingOAuthTab() : null;
      setIsConnecting(definition.canonicalSlug);
      try {
        const detail =
          definition.scopes.length === 0 && hasDeferredProviderDetails(definition.source)
            ? detailsBySlug[definition.canonicalSlug] || (await fetchDetails(definition))
            : null;
        const connectDefinition = detail?.scopes.length ? detail : definition;
        const data = await startProviderIntegrationConnect({
          ownerScope,
          assistantId: Number.isNaN(Number(assistantId)) ? assistantId : Number(assistantId),
          canonicalAppSlug: connectDefinition.canonicalSlug,
          backendId: connectDefinition.sourceMetadata.backendId,
          providerAppId: connectDefinition.sourceMetadata.providerAppId,
          requestedScopes: connectDefinition.scopes.map((scope) => scope.id),
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
          if (navigation === 'popup') {
            if (pendingTab?.opened) pendingTab.navigate(data.connectUrl);
            else {
              window.open(
                data.connectUrl,
                'unify-oauth-popup',
                'popup=yes,width=560,height=720,resizable=yes,scrollbars=yes'
              );
            }
          }
        } else {
          pendingTab?.close();
          toast.success(`Started ${definition.displayName} connection.`);
        }
        if (!data.connectUrl && data.connection.status === 'connected') {
          broadcastIntegrationConnectSettled({
            assistantId: String(assistantId),
            authMode: 'api_key',
          });
          void requestUnityIntegrationToolsSync({
            assistantId,
            connection: data.connection,
          }).catch((error) => {
            console.warn('Failed to request Unity integration tool sync', error);
          });
        }
        await fetchCatalog({ background: true });
        setDetailsBySlug((current) => {
          const next = { ...current };
          delete next[connectDefinition.canonicalSlug];
          return next;
        });
        return data;
      } catch (error) {
        pendingTab?.close();
        console.error('Failed to start provider integration connection', error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Could not start connection. Please try again.';
        toast.error(message);
        return null;
      } finally {
        setIsConnecting(null);
      }
    },
    [assistantId, detailsBySlug, fetchCatalog, fetchDetails, isMock, ownerScope]
  );

  // Surface the pinned connected/needs-attention apps alongside the paginated
  // browse list (deduped by slug, pinned wins). The gallery model collapses any
  // remaining duplicates, so a connected app that later pages in is not doubled.
  const mergedDefinitions = React.useMemo(() => {
    if (pinnedDefinitions.length === 0) return definitions;
    const bySlug = new Map<string, IntegrationDefinition>();
    for (const definition of [...pinnedDefinitions, ...definitions]) {
      if (!bySlug.has(definition.canonicalSlug)) bySlug.set(definition.canonicalSlug, definition);
    }
    return Array.from(bySlug.values());
  }, [definitions, pinnedDefinitions]);

  return {
    definitions: mergedDefinitions,
    apps: mergedDefinitions,
    detailsBySlug,
    isMock,
    isLoading,
    isLoadingMore,
    hasLoaded,
    hasLoadedRequest: loadedRequestKey === requestKey,
    hasMore,
    total,
    facets,
    catalogVersion,
    generatedAt,
    isDetailLoading,
    isConnecting,
    refresh,
    loadMore,
    fetchDetails,
    startConnect,
  };
}
