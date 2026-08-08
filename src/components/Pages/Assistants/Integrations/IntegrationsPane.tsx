'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { useAssistantSecrets } from '@/hooks/Assistants/useAssistantSecrets';
import {
  disconnectIntegration,
  isWorkspaceManagedSecretName,
  partitionForIntegrations,
  startOAuthConnect,
  useIntegrationCallbackFlash,
} from '@/hooks/Assistants/useAssistantIntegrations';
import { useProviderIntegrationCatalog } from '@/hooks/Assistants/useProviderIntegrationCatalog';
import { useIntegrationGalleryModel } from '@/hooks/Integrations/useIntegrationGalleryModel';
import { useProviderIntegrationDetail } from '@/hooks/Integrations/useProviderIntegrationDetail';
import {
  cancelProviderIntegration,
  disconnectProviderIntegration,
  reconnectProviderIntegration,
  requestUnityIntegrationToolsSync,
  testProviderIntegration,
  updateProviderIntegrationConnection,
  type ProviderAppStatusGroup,
} from '@/lib/client/integrations';
import { buildStaticIntegrationDefinitions } from '@/utils/integrations/static-package-adapter';
import {
  ENABLE_INTEGRATION_LABEL_FILTER,
  effectiveSemanticCategory,
  semanticCategoryFilterActive,
} from '@/lib/integrations/integrationLabelFilter';
import {
  openPendingOAuthTab,
  subscribeOAuthComplete,
  copyAuthorizeUrlForPrivateWindow,
} from '@/utils/assistants/oauth';
import { subscribeIntegrationDisconnectSettled } from '@/lib/assistants/coordinatorIntegrationConnect';
import { SecretFormDialog } from '../Secrets/SecretFormDialog';
import { JsonUploadPreviewDialog } from '../Secrets/JsonUploadPreviewDialog';
import type { SecretActions } from '@/types/assistants/secret';
import type {
  IntegrationCardState,
  IntegrationProviderConfig,
  IntegrationProviderId,
} from '@/types/assistants/integration';
import type {
  IntegrationConnection,
  IntegrationDefinition,
  IntegrationGalleryItem,
} from '@/types/integrations';
import {
  IntegrationGalleryShell,
  ProviderIntegrationDetailSheet,
  type IntegrationConnectSuccessState,
  type IntegrationGalleryFilters,
  type IntegrationOAuthWaitingState,
} from '@/components/Integrations';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { ApiKeyIntegrationDialog } from './ApiKeyIntegrationDialog';
import { OAuthIntegrationDialog, type OAuthSubmitPayload } from './OAuthIntegrationDialog';
import { getIntegrationProvider } from '@/constants/assistants/integrations';
import { TabFooter } from '../Common/TabFooter';

interface IntegrationsPaneProps {
  ownerId: string;
  assistantId: string;
  secretActions: SecretActions;
  canWrite?: boolean;
  isVisible?: boolean;
  /** When false, the assistants surface is hidden behind settings/admin routes. */
  isActiveSurface?: boolean;
  /**
   * Notifies the parent of the number of "connected an app" signals — used
   * by the Coordinator onboarding flow to auto-mark the "Connect your
   * coordinator with your apps" step done the moment a real integration
   * lands. Counts both (a) recognised provider cards in a ``connected`` /
   * ``configured`` state and (b) user-added custom secrets. It deliberately
   * excludes the workspace's own BYOD OAuth tokens (``GOOGLE_*`` /
   * ``MICROSOFT_*`` / ``AZURE_*``) so connecting the workspace doesn't
   * falsely complete the step. Receives ``0`` while nothing qualifies or the
   * list is still loading. */
  onSecretsCountChange?: (count: number) => void;
  initialGalleryFilters?: Partial<
    Pick<IntegrationGalleryFilters, 'query' | 'category' | 'semanticCategory'>
  >;
}

type PendingDelete = {
  type: 'integration';
  provider: IntegrationProviderConfig;
  state: IntegrationCardState;
};

type IntegrationDialog = null | {
  mode: 'add' | 'edit';
  provider: IntegrationProviderConfig;
};

const DEFAULT_GALLERY_FILTERS: IntegrationGalleryFilters = {
  query: '',
  category: 'all',
  semanticCategory: 'all',
  status: 'all',
};

function statusGroupsForFilter(
  status: IntegrationGalleryFilters['status']
): ProviderAppStatusGroup[] {
  if (status === 'connected') return ['connected'];
  if (status === 'needs_attention') return ['needs_attention'];
  if (status === 'not_connected') return ['not_connected'];
  return [];
}

function sourceTypeForDefinition(definition: IntegrationDefinition): 'native' | 'third_party' {
  if (definition.sourceMetadata?.sourceType === 'native') return 'native';
  if (definition.sourceMetadata?.sourceType === 'third_party') return 'third_party';
  return definition.source === 'provider_backed' || definition.source === 'overlay_curated'
    ? 'third_party'
    : 'native';
}

function semanticCategoryKeysForDefinition(definition: IntegrationDefinition): string[] {
  const labelKeys = definition.labels?.categories.map((category) => category.key).filter(Boolean);
  if (labelKeys && labelKeys.length > 0) return labelKeys;
  const fallback = definition.category?.trim().toLowerCase();
  return fallback ? [fallback] : [];
}

function definitionNeedsAttention(definition: IntegrationDefinition): boolean {
  return [
    'missing_scope',
    'missing_secrets',
    'needs_reconnect',
    'expired',
    'revoked',
    'error',
    'pending',
  ].includes(definition.status);
}

function staticDefinitionMatchesFilters(
  definition: IntegrationDefinition,
  filters: IntegrationGalleryFilters
): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      definition.displayName,
      definition.description,
      definition.category,
      ...(definition.labels?.tags.map((label) => label.label) ?? []),
      definition.canonicalSlug,
      definition.sourceMetadata.label,
      definition.sourceMetadata.providerAppId,
      ...definition.tools.map((tool) => `${tool.displayName} ${tool.description ?? ''}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filters.category !== 'all' && sourceTypeForDefinition(definition) !== filters.category) {
    return false;
  }
  if (
    semanticCategoryFilterActive(filters.semanticCategory) &&
    !semanticCategoryKeysForDefinition(definition).includes(filters.semanticCategory)
  ) {
    return false;
  }
  if (filters.status === 'connected') {
    return definition.status === 'connected' || definition.status === 'configured';
  }
  if (filters.status === 'needs_attention') {
    return definitionNeedsAttention(definition);
  }
  if (filters.status === 'not_connected') {
    return definition.status === 'not_connected';
  }
  return true;
}

/**
 * The Integrations tab body.  Replaces the older ``SecretsPane`` —
 * adds a status-aware card row above the standard secrets table for
 * any registered integration whose secrets are present, and swaps the
 * single ``+`` button for an ``Add new ▾`` dropdown that lets the user
 * pick between "Custom secret" (the freeform key/value flow) and
 * per-integration variants (OAuth Connect / API-key paste).
 *
 * Universal-masking rule: every value rendered inside this pane is
 * masked, regardless of the underlying ``sensitive`` flag.  Values
 * never reach the browser anyway — ``getSecrets`` returns names +
 * descriptions only.
 */
export function IntegrationsPane({
  ownerId,
  assistantId,
  secretActions,
  canWrite = false,
  isVisible = true,
  isActiveSurface = true,
  onSecretsCountChange,
  initialGalleryFilters,
}: IntegrationsPaneProps) {
  const integrationsDataEnabled = isVisible && isActiveSurface;
  const {
    secrets,
    isSubmitting,
    formMethods,
    handleNewSecret,
    pendingUpload,
    confirmUploadJson,
    cancelUploadJson,
    onSubmit,
    fetchSecrets,
  } = useAssistantSecrets(assistantId, ownerId, secretActions, {
    enabled: integrationsDataEnabled,
  });
  const [galleryFilters, setGalleryFilters] =
    React.useState<IntegrationGalleryFilters>(DEFAULT_GALLERY_FILTERS);
  React.useEffect(() => {
    if (!initialGalleryFilters) return;
    setGalleryFilters((current) => ({
      ...current,
      ...initialGalleryFilters,
      semanticCategory: effectiveSemanticCategory(
        initialGalleryFilters.semanticCategory ?? current.semanticCategory
      )
        ? (initialGalleryFilters.semanticCategory ?? current.semanticCategory)
        : 'all',
    }));
  }, [initialGalleryFilters]);
  const catalogSourceType =
    galleryFilters.category === 'native'
      ? 'native'
      : galleryFilters.category === 'third_party'
        ? 'third_party'
        : null;
  const catalogSemanticCategory = effectiveSemanticCategory(galleryFilters.semanticCategory);
  const catalogStatusGroups = React.useMemo(
    () => statusGroupsForFilter(galleryFilters.status),
    [galleryFilters.status]
  );
  const providerCatalog = useProviderIntegrationCatalog(assistantId, {
    query: galleryFilters.query,
    sourceType: catalogSourceType,
    category: catalogSemanticCategory,
    statusGroups: catalogStatusGroups,
    enabled: integrationsDataEnabled,
  });
  const {
    definitions: providerDefinitions,
    detailsBySlug,
    facets: providerCatalogFacets,
    fetchDetails,
    hasMore: hasMoreProviderIntegrations,
    hasLoaded: hasProviderCatalogLoaded,
    isConnecting: providerConnectingSlug,
    isDetailLoading,
    isLoadingMore: isProviderCatalogLoadingMore,
    isLoading: isProviderCatalogLoading,
    isMock: isProviderCatalogMock,
    loadMore: loadMoreProviderIntegrations,
    refresh: refreshProviderCatalog,
    startConnect: startProviderConnect,
    total: providerCatalogTotal,
  } = providerCatalog;

  // Local UI state.
  const [customDialogMode, setCustomDialogMode] = React.useState<'create' | 'edit' | null>(null);
  const [integrationDialog, setIntegrationDialog] = React.useState<IntegrationDialog>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);
  const [pendingProviderDisconnect, setPendingProviderDisconnect] =
    React.useState<IntegrationConnection | null>(null);
  const [pendingConnectItem, setPendingConnectItem] = React.useState<IntegrationGalleryItem | null>(
    null
  );
  const [pendingConnectLabel, setPendingConnectLabel] = React.useState('');
  const [selectedIntegration, setSelectedIntegration] =
    React.useState<IntegrationGalleryItem | null>(null);
  const [busyConnectionId, setBusyConnectionId] = React.useState<string | null>(null);
  const [oauthWaiting, setOauthWaiting] = React.useState<IntegrationOAuthWaitingState | null>(null);
  const [connectSuccess, setConnectSuccess] = React.useState<IntegrationConnectSuccessState | null>(
    null
  );
  const pendingOAuthMetaRef = React.useRef<{
    item: IntegrationGalleryItem;
    accountLabel?: string;
  } | null>(null);

  // Auto-close the custom-secret dialog when its in-flight submit
  // settles (mirrors SecretsPane's pattern).
  const prevIsSubmittingRef = React.useRef(isSubmitting);
  React.useEffect(() => {
    const wasSubmitting = prevIsSubmittingRef.current;
    prevIsSubmittingRef.current = isSubmitting;
    if (customDialogMode && wasSubmitting && !isSubmitting) {
      setCustomDialogMode(null);
      handleNewSecret();
    }
  }, [isSubmitting, customDialogMode, handleNewSecret]);

  // Surface OAuth callback flash messages once per page load.
  const flash = useIntegrationCallbackFlash();
  React.useEffect(() => {
    if (flash.success) {
      const provider = getIntegrationProvider(flash.success.providerId as IntegrationProviderId);
      const label = provider?.label ?? flash.success.providerId;
      toast.success(`Connected to ${label}.`);
      // Secondary informational toast when auto-pin couldn't make a
      // clean choice (e.g. EH multi-org / no-named-org cases).  Long
      // duration since the user may want to act on the override hint.
      if (flash.success.notice) {
        toast.message(flash.success.notice.message, { duration: 10000 });
      }
      flash.clear();
    } else if (flash.error) {
      toast.error(flash.error.message);
      flash.clear();
    }
  }, [flash]);

  // Partition secrets into integration cards + freeform custom secrets +
  // hidden OAuth-managed secrets (filtered out of the table view per
  // the existing-convention hide rule).
  const { cards, otherSecrets } = React.useMemo(() => partitionForIntegrations(secrets), [secrets]);

  const visibleCustomSecrets = React.useMemo(
    () => otherSecrets.filter((s) => !isWorkspaceManagedSecretName(s.name)),
    [otherSecrets]
  );

  const staticDefinitions = React.useMemo(
    () => buildStaticIntegrationDefinitions({ cards, includeUnconfigured: true }),
    [cards]
  );
  const filteredStaticDefinitions = React.useMemo(
    () =>
      staticDefinitions.filter((definition) =>
        staticDefinitionMatchesFilters(definition, galleryFilters)
      ),
    [galleryFilters, staticDefinitions]
  );

  const galleryItems = useIntegrationGalleryModel({
    providerDefinitions,
    staticDefinitions: filteredStaticDefinitions,
    mockDefinitions: providerDefinitions,
    useMock: isProviderCatalogMock,
  });
  const shouldShowGallerySkeleton = !hasProviderCatalogLoaded && !isProviderCatalogMock;
  // The drawer's data — the per-app detail fetched and folded over the
  // list's summary. Shared with the Workflows shelf, which mounts the same
  // drawer and must therefore show the same thing.
  const selectedDisplayItem = useProviderIntegrationDetail({
    selected: selectedIntegration,
    latest: React.useMemo(
      () =>
        selectedIntegration
          ? (galleryItems.find(
              (item) => item.canonicalSlug === selectedIntegration.canonicalSlug
            ) ?? null)
          : null,
      [galleryItems, selectedIntegration]
    ),
    detailsBySlug,
    fetchDetails,
  });

  React.useEffect(() => {
    return subscribeIntegrationDisconnectSettled((detail) => {
      if (detail.assistantId !== assistantId) return;
      refreshProviderCatalog();
      if (
        selectedIntegration &&
        (selectedIntegration.source === 'provider_backed' ||
          selectedIntegration.source === 'overlay_curated')
      ) {
        window.setTimeout(() => void fetchDetails(selectedIntegration), 900);
      }
    });
  }, [assistantId, fetchDetails, refreshProviderCatalog, selectedIntegration]);

  // Report how many *app integrations* are actually wired up — used by the
  // Coordinator onboarding flow to auto-complete the "connect apps" step.
  // Two things count as "connected an app":
  //   1. A recognised provider card in a ``connected`` (OAuth) or
  //      ``configured`` (API-key) state.
  //   2. A user-added custom secret (freeform ``otherSecrets``).
  // We deliberately avoid a raw ``secrets.length``: connecting the workspace
  // dumps OAuth tokens (``GOOGLE_*`` / ``MICROSOFT_*`` / ``AZURE_*``) into the
  // same freeform bucket, so those are filtered out via
  // ``isWorkspaceManagedSecretName`` — otherwise the step would auto-complete
  // the moment the workspace connected.
  const activeIntegrationCount = React.useMemo(() => {
    const readyCards = cards.filter(
      (c) => c.state.kind === 'connected' || c.state.kind === 'configured'
    ).length;
    const providerConnections = providerDefinitions.filter(
      (app) =>
        (app.source === 'provider_backed' || app.source === 'overlay_curated') &&
        (app.status === 'connected' || app.status === 'configured')
    ).length;
    return readyCards + visibleCustomSecrets.length + providerConnections;
  }, [cards, providerDefinitions, visibleCustomSecrets.length]);
  React.useEffect(() => {
    onSecretsCountChange?.(activeIntegrationCount);
  }, [activeIntegrationCount, onSecretsCountChange]);
  // ---- Action handlers --------------------------------------------------

  const handleEditIntegration = (provider: IntegrationProviderConfig) => {
    setIntegrationDialog({ mode: 'edit', provider });
  };

  const handleReconnectIntegration = async (provider: IntegrationProviderConfig) => {
    if (provider.auth.kind !== 'oauth_authorization_code') return;
    await startOAuthConnect({
      assistantId,
      providerId: provider.id,
      redirectAfter: window.location.pathname,
    });
  };

  const handleDisconnectRequest = (
    provider: IntegrationProviderConfig,
    state: IntegrationCardState
  ) => {
    setPendingDelete({ type: 'integration', provider, state });
  };

  const handleOpenConnectDialog = (
    item: IntegrationGalleryItem,
    options: { keepSheetOpen?: boolean; preserveConnectSuccess?: boolean } = {}
  ) => {
    if (!options.keepSheetOpen) {
      setSelectedIntegration(null);
    }
    if (!options.preserveConnectSuccess) {
      setConnectSuccess(null);
    }
    setPendingConnectItem(item);
    setPendingConnectLabel('');
  };

  const countLiveConnections = React.useCallback((item: IntegrationGalleryItem | null) => {
    if (!item) return 0;
    return item.connections.filter((connection) => connection.status !== 'disconnected').length;
  }, []);

  const finishConnectLoopSuccess = React.useCallback(
    (item: IntegrationGalleryItem, accountLabel?: string) => {
      const refreshed =
        galleryItems.find((entry) => entry.canonicalSlug === item.canonicalSlug) ?? item;
      setSelectedIntegration(refreshed);
      setOauthWaiting(null);
      setConnectSuccess({
        canonicalSlug: refreshed.canonicalSlug,
        displayName: refreshed.displayName,
        accountLabel,
        accountCount: Math.max(1, countLiveConnections(refreshed), countLiveConnections(item) + 1),
      });
      pendingOAuthMetaRef.current = null;
    },
    [countLiveConnections, galleryItems]
  );

  const beginProviderConnect = React.useCallback(
    async (
      item: IntegrationGalleryItem,
      options: {
        accountLabel?: string;
        navigation?: 'popup' | 'manual';
      } = {}
    ) => {
      const accountLabel = options.accountLabel?.trim() || undefined;
      const navigation = options.navigation ?? 'popup';
      pendingOAuthMetaRef.current = { item, accountLabel };
      setConnectSuccess(null);
      setSelectedIntegration(item);

      const data = await startProviderConnect(item, undefined, {
        accountLabel,
        navigation,
      });
      if (!data) {
        pendingOAuthMetaRef.current = null;
        setOauthWaiting(null);
        return;
      }

      if (isProviderCatalogMock || !data.connectUrl) {
        finishConnectLoopSuccess(item, accountLabel);
        return;
      }

      if (navigation === 'manual') {
        const copied = await copyAuthorizeUrlForPrivateWindow(data.connectUrl);
        if (copied) {
          toast.message(
            'Authorize URL copied. Paste it into a private/incognito window and sign in as the next account.'
          );
        } else {
          toast.message(
            'Open a private/incognito window and paste the authorize URL from Copy authorize URL.'
          );
        }
      }

      setOauthWaiting({
        canonicalSlug: item.canonicalSlug,
        displayName: item.displayName,
        accountLabel,
        connectUrl: data.connectUrl,
        mode: navigation,
      });
    },
    [finishConnectLoopSuccess, isProviderCatalogMock, startProviderConnect]
  );

  React.useEffect(() => {
    return subscribeOAuthComplete((detail) => {
      if (detail.kind !== 'integration') return;
      refreshProviderCatalog();
      const pending = pendingOAuthMetaRef.current;
      if (pending) {
        window.setTimeout(() => {
          finishConnectLoopSuccess(pending.item, pending.accountLabel);
        }, 900);
      }
      if (
        selectedIntegration &&
        (selectedIntegration.source === 'provider_backed' ||
          selectedIntegration.source === 'overlay_curated')
      ) {
        window.setTimeout(() => void fetchDetails(selectedIntegration), 900);
        window.setTimeout(() => void fetchDetails(selectedIntegration), 1800);
      }
    });
  }, [fetchDetails, finishConnectLoopSuccess, refreshProviderCatalog, selectedIntegration]);

  const handleGalleryPrimaryAction = (item: IntegrationGalleryItem) => {
    if (item.status === 'connected' || item.status === 'configured') {
      setSelectedIntegration(item);
      return;
    }
    if (item.source === 'provider_backed' || item.source === 'overlay_curated') {
      handleOpenConnectDialog(item);
      return;
    }
    setSelectedIntegration(item);
  };

  const handleDetailPrimaryAction = (
    item: IntegrationGalleryItem,
    options: { accountLabel?: string } = {}
  ) => {
    if (item.sourceMetadata?.sourceType === 'native') {
      setSelectedIntegration(item);
      toast.message(
        `${item.displayName} is available natively and does not need a provider connection.`
      );
      return;
    }

    if (item.source === 'custom_secret') {
      setSelectedIntegration(null);
      handleNewSecret();
      setCustomDialogMode('create');
      return;
    }

    if (item.staticProvider) {
      setSelectedIntegration(null);
      const mode = item.status === 'connected' || item.status === 'configured' ? 'edit' : 'add';
      setIntegrationDialog({ mode, provider: item.staticProvider });
      return;
    }

    if (
      !options.accountLabel &&
      (item.source === 'provider_backed' || item.source === 'overlay_curated')
    ) {
      handleOpenConnectDialog(item, { keepSheetOpen: true });
      return;
    }

    void beginProviderConnect(item, {
      accountLabel: options.accountLabel,
      navigation: 'popup',
    });
  };

  const handleProviderApiKeySubmit = (
    item: IntegrationGalleryItem,
    values: Record<string, string>,
    options: { accountLabel?: string } = {}
  ) => {
    void (async () => {
      const data = await startProviderConnect(item, values, {
        accountLabel: options.accountLabel,
      });
      if (data) {
        finishConnectLoopSuccess(item, options.accountLabel?.trim() || undefined);
      }
    })();
  };

  const handleConnectDialogSubmit = (navigation: 'popup' | 'manual' = 'popup') => {
    const item = pendingConnectItem;
    if (!item) return;
    const accountLabel = pendingConnectLabel.trim() || undefined;
    const addingAnother =
      countLiveConnections(item) > 0 ||
      (connectSuccess !== null && connectSuccess.canonicalSlug === item.canonicalSlug);
    if (addingAnother && !accountLabel) {
      toast.error('Account label is required when adding another account.');
      return;
    }
    setPendingConnectItem(null);
    setPendingConnectLabel('');
    void beginProviderConnect(item, { accountLabel, navigation });
  };

  const isAddingAnotherAccount = Boolean(
    pendingConnectItem &&
    (countLiveConnections(pendingConnectItem) > 0 ||
      (connectSuccess !== null &&
        connectSuccess.canonicalSlug === pendingConnectItem.canonicalSlug))
  );
  const connectLabelRequiredMissing =
    isAddingAnotherAccount && pendingConnectLabel.trim().length === 0;

  const handleConnectionReconnect = async (connection: IntegrationConnection) => {
    if (connection.source === 'static_package' && connection.sourceMetadata?.staticProviderId) {
      const card = cards.find(
        (item) => item.provider.id === connection.sourceMetadata?.staticProviderId
      );
      if (card) {
        await handleReconnectIntegration(card.provider);
      }
      return;
    }

    setBusyConnectionId(connection.id);
    try {
      const updatedConnection = await reconnectProviderIntegration(connection.id);
      const definition = galleryItems.find(
        (item) => item.canonicalSlug === connection.canonicalSlug
      );
      if (definition?.authModes.includes('oauth')) {
        await startProviderConnect(definition, undefined, {
          accountLabel: connection.accountLabel ?? undefined,
        });
      } else {
        await requestUnityIntegrationToolsSync({
          assistantId,
          connection: updatedConnection,
        }).catch((error) => {
          console.warn('Failed to request Unity integration tool sync after reconnect', error);
        });
        toast.success('Reconnect started.');
      }
      await refreshProviderCatalog();
    } catch (error) {
      console.error('Failed to reconnect provider integration', error);
      toast.error('Could not reconnect. Please try again.');
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleConnectionDisconnect = async (connection: IntegrationConnection) => {
    if (connection.source === 'static_package' && connection.sourceMetadata?.staticProviderId) {
      const card = cards.find(
        (item) => item.provider.id === connection.sourceMetadata?.staticProviderId
      );
      if (card) handleDisconnectRequest(card.provider, card.state);
      return;
    }

    setPendingProviderDisconnect(connection);
  };

  const confirmProviderDisconnect = async () => {
    const connection = pendingProviderDisconnect;
    if (!connection) return;
    setPendingProviderDisconnect(null);
    setBusyConnectionId(connection.id);
    try {
      await disconnectProviderIntegration(connection.id);
      await requestUnityIntegrationToolsSync({
        assistantId,
        connection,
        reason: 'disconnected',
      }).catch((error) => {
        console.warn('Failed to request Unity integration tool sync after disconnect', error);
      });
      toast.success('Disconnected.');
      await refreshProviderCatalog();
      if (selectedIntegration) await fetchDetails(selectedIntegration);
    } catch (error) {
      console.error('Failed to disconnect provider integration', error);
      toast.error('Could not disconnect. Please try again.');
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleConnectionCancel = async (connection: IntegrationConnection) => {
    setBusyConnectionId(connection.id);
    try {
      await cancelProviderIntegration(connection.id);
      toast.success('Setup cancelled.');
      await refreshProviderCatalog();
      if (selectedIntegration) await fetchDetails(selectedIntegration);
    } catch (error) {
      console.error('Failed to cancel provider integration setup', error);
      toast.error('Could not cancel setup. Please try again.');
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleConnectionTest = async (connection: IntegrationConnection) => {
    if (connection.source !== 'provider_backed' && connection.source !== 'overlay_curated') return;

    setBusyConnectionId(connection.id);
    try {
      const updatedConnection = await testProviderIntegration(connection.id);
      await requestUnityIntegrationToolsSync({
        assistantId,
        connection: updatedConnection,
      }).catch((error) => {
        console.warn('Failed to request Unity integration tool sync after connection test', error);
      });
      toast.success('Connection is healthy.');
      await refreshProviderCatalog();
      if (selectedIntegration) await fetchDetails(selectedIntegration);
    } catch (error) {
      console.error('Failed to test provider integration', error);
      toast.error('Could not test connection. Please try again.');
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleConnectionLabelUpdate = async (
    connection: IntegrationConnection,
    accountLabel: string
  ) => {
    if (connection.source !== 'provider_backed' && connection.source !== 'overlay_curated') return;

    setBusyConnectionId(connection.id);
    try {
      await updateProviderIntegrationConnection(connection.id, {
        accountLabel: accountLabel.trim() || null,
      });
      toast.success('Account label updated.');
      await refreshProviderCatalog();
      if (selectedIntegration) await fetchDetails(selectedIntegration);
    } catch (error) {
      console.error('Failed to update provider integration label', error);
      toast.error('Could not update label. Please try again.');
      throw error;
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const pd = pendingDelete;
    setPendingDelete(null);
    const ok = await disconnectIntegration({
      assistantId,
      providerId: pd.provider.id,
    });
    if (ok) await fetchSecrets();
  };

  const closeCustomDialog = () => {
    if (isSubmitting) return;
    setCustomDialogMode(null);
    handleNewSecret();
  };

  // ---- Integration dialog submit handlers ------------------------------

  const [isIntegrationSubmitting, setIsIntegrationSubmitting] = React.useState(false);

  const handleApiKeySubmit = async (changedFields: Record<string, string>) => {
    if (!integrationDialog) return;
    const provider = integrationDialog.provider;
    if (provider.auth.kind !== 'api_key' && provider.auth.kind !== 'api_key_multi') return;
    if (Object.keys(changedFields).length === 0) {
      // Edit-mode "keep existing" — dialog already closed.
      return;
    }
    setIsIntegrationSubmitting(true);
    const toastId = toast.loading(
      integrationDialog.mode === 'edit'
        ? `Updating ${provider.label}…`
        : `Saving ${provider.label}…`
    );
    try {
      // For both Add and Edit: delete any existing same-name secret then
      // create afresh.  Avoids needing to know the logId in the hook.
      // Iterates per field so api_key_multi (e.g. Salto KS / Valos) and
      // single-field api_key share one path.
      for (const [secretKey, value] of Object.entries(changedFields)) {
        const existing = secrets.find((s) => s.name === secretKey);
        if (existing) {
          const del = await secretActions.delete(existing.logId, ownerId, assistantId);
          if ('detail' in del && del.detail) {
            throw new Error(del.detail);
          }
        }
        const create = await secretActions.create(assistantId, ownerId, {
          name: secretKey,
          value,
        });
        if ('detail' in create && create.detail) {
          throw new Error(create.detail);
        }
      }
      toast.success(`${provider.label} saved.`, { id: toastId });
      setIntegrationDialog(null);
      await fetchSecrets();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed.';
      toast.error(msg, { id: toastId });
    } finally {
      setIsIntegrationSubmitting(false);
    }
  };

  const handleOAuthSubmit = async (payload: OAuthSubmitPayload) => {
    if (!integrationDialog) return;
    const provider = integrationDialog.provider;
    if (provider.auth.kind !== 'oauth_authorization_code') return;
    const oauthConfig = provider.auth.oauth;
    const isEditing = integrationDialog.mode === 'edit';

    if (isEditing && !payload.anyChanged) {
      // Nothing to do.
      setIntegrationDialog(null);
      return;
    }

    // Open the OAuth tab NOW, synchronously in this submit gesture.
    // We persist credentials (awaits) before connecting below, which
    // would otherwise leave window.open post-await and get popup-blocked
    // (forcing a same-tab redirect that drops any in-progress call).
    const oauthTab = openPendingOAuthTab();

    setIsIntegrationSubmitting(true);
    const toastId = toast.loading(
      isEditing
        ? `Updating ${provider.label} credentials…`
        : `Saving ${provider.label} credentials…`
    );
    try {
      // 1. Persist new/changed credentials.  Delete + create per key so
      //    we don't need an upsert helper.
      for (const [secretKey, value] of Object.entries(payload.changedFields)) {
        const existing = secrets.find((s) => s.name === secretKey);
        if (existing) {
          const del = await secretActions.delete(existing.logId, ownerId, assistantId);
          if ('detail' in del && del.detail) throw new Error(del.detail);
        }
        const create = await secretActions.create(assistantId, ownerId, {
          name: secretKey,
          value,
        });
        if ('detail' in create && create.detail) throw new Error(create.detail);
      }

      // 2. If editing and any credential changed, drop OAuth-managed
      //    secrets so the next call won't try to use a stale refresh
      //    token minted against the old credentials.
      if (isEditing && payload.anyChanged) {
        const managedKeys = new Set(oauthConfig.managedSecretKeys);
        const managedSecrets = secrets.filter((s) => managedKeys.has(s.name));
        for (const s of managedSecrets) {
          await secretActions.delete(s.logId, ownerId, assistantId).catch(() => undefined);
        }
      }

      toast.success(
        isEditing
          ? `${provider.label} credentials saved. Reconnecting…`
          : `${provider.label} credentials saved. Connecting…`,
        { id: toastId }
      );
      setIntegrationDialog(null);
      // 3. Trigger Connect.  Browser navigates to the authorize URL —
      //    no need to refresh secrets locally; the callback redirect
      //    will return us to this page.
      await startOAuthConnect({
        assistantId,
        providerId: provider.id,
        redirectAfter: window.location.pathname,
        pendingTab: oauthTab,
      });
    } catch (e) {
      oauthTab.close();
      const msg = e instanceof Error ? e.message : 'Save failed.';
      toast.error(msg, { id: toastId });
    } finally {
      setIsIntegrationSubmitting(false);
    }
  };

  // ---- Render ----------------------------------------------------------

  // OAuth disconnect runs in two stages — title and copy reflect which
  // one will fire when the user confirms.  ``connected`` ⇒ tokens-only
  // (Client ID/Secret kept).  ``needs_reconnect`` ⇒ full removal.
  const oauthDisconnectStage: 'tokens' | 'credentials' | null = (() => {
    if (!pendingDelete) return null;
    if (pendingDelete.provider.auth.kind !== 'oauth_authorization_code') return null;
    return pendingDelete.state.kind === 'connected' ? 'tokens' : 'credentials';
  })();

  const deleteDialogTitle = (() => {
    if (!pendingDelete) return '';
    if (oauthDisconnectStage === 'credentials') {
      return `Remove ${pendingDelete.provider.label}?`;
    }
    return `Disconnect ${pendingDelete.provider.label}?`;
  })();

  const deleteDialogDescription = (() => {
    if (!pendingDelete) {
      return 'This action cannot be undone.';
    }
    if (oauthDisconnectStage === 'tokens') {
      return `Removes the OAuth tokens for this assistant. Your Client ID and Client Secret are kept so you can reconnect with one click.`;
    }
    if (oauthDisconnectStage === 'credentials') {
      return `Removes ${pendingDelete.provider.label} entirely. Your saved Client ID and Client Secret will be deleted from this assistant.`;
    }
    return `Removes ${pendingDelete.provider.label} credentials from this assistant.`;
  })();

  return (
    <div className="flex h-full flex-col" data-testid="integrations-pane">
      <div className="min-h-0 flex-1">
        <IntegrationGalleryShell
          items={shouldShowGallerySkeleton ? [] : galleryItems}
          isLoading={shouldShowGallerySkeleton}
          isMock={isProviderCatalogMock}
          busySlug={providerConnectingSlug}
          isRefreshing={isProviderCatalogLoading}
          filters={galleryFilters}
          onFiltersChange={setGalleryFilters}
          enableSemanticCategoryFilter={ENABLE_INTEGRATION_LABEL_FILTER}
          total={providerCatalogTotal + filteredStaticDefinitions.length}
          facets={providerCatalogFacets}
          hasMore={hasMoreProviderIntegrations}
          isLoadingMore={isProviderCatalogLoadingMore}
          onLoadMore={loadMoreProviderIntegrations}
          onOpen={setSelectedIntegration}
          onPrimaryAction={handleGalleryPrimaryAction}
          onRefresh={refreshProviderCatalog}
        />
      </div>

      <TabFooter
        testId="integrations-footer"
        right={
          <span className="text-caption">
            {activeIntegrationCount} connected · {galleryItems.length} of{' '}
            {providerCatalogTotal + filteredStaticDefinitions.length} apps
          </span>
        }
      />

      {/* Custom secret create/edit dialog */}
      <SecretFormDialog
        open={customDialogMode !== null}
        mode={customDialogMode ?? 'create'}
        formMethods={formMethods}
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
        onClose={closeCustomDialog}
      />

      {/* Integration dialogs */}
      {(integrationDialog?.provider.auth.kind === 'api_key' ||
        integrationDialog?.provider.auth.kind === 'api_key_multi') && (
        <ApiKeyIntegrationDialog
          open={true}
          mode={integrationDialog.mode}
          provider={integrationDialog.provider}
          isSubmitting={isIntegrationSubmitting}
          onSubmit={handleApiKeySubmit}
          onClose={() => setIntegrationDialog(null)}
        />
      )}
      {integrationDialog?.provider.auth.kind === 'oauth_authorization_code' && (
        <OAuthIntegrationDialog
          open={true}
          mode={integrationDialog.mode}
          provider={integrationDialog.provider}
          isSubmitting={isIntegrationSubmitting}
          onSubmit={handleOAuthSubmit}
          onClose={() => setIntegrationDialog(null)}
        />
      )}

      <ProviderIntegrationDetailSheet
        item={selectedDisplayItem}
        open={!!selectedDisplayItem}
        assistantId={assistantId}
        busy={Boolean(providerConnectingSlug)}
        busyConnectionId={busyConnectionId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIntegration(null);
            setOauthWaiting(null);
            setConnectSuccess(null);
            pendingOAuthMetaRef.current = null;
          }
        }}
        onPrimaryAction={handleDetailPrimaryAction}
        onApiKeySubmit={handleProviderApiKeySubmit}
        onReconnectConnection={(connection) => void handleConnectionReconnect(connection)}
        onDisconnectConnection={(connection) => void handleConnectionDisconnect(connection)}
        onCancelConnection={(connection) => void handleConnectionCancel(connection)}
        onTestConnection={(connection) => void handleConnectionTest(connection)}
        onUpdateConnectionLabel={(connection, accountLabel) =>
          handleConnectionLabelUpdate(connection, accountLabel)
        }
        canManageCustomAuth={canWrite}
        isDetailLoading={
          !!selectedDisplayItem && isDetailLoading === selectedDisplayItem.canonicalSlug
        }
        oauthWaiting={
          oauthWaiting &&
          selectedDisplayItem &&
          oauthWaiting.canonicalSlug === selectedDisplayItem.canonicalSlug
            ? oauthWaiting
            : null
        }
        connectSuccess={
          connectSuccess &&
          selectedDisplayItem &&
          connectSuccess.canonicalSlug === selectedDisplayItem.canonicalSlug
            ? connectSuccess
            : null
        }
        onCancelOAuthWaiting={() => {
          setOauthWaiting(null);
          pendingOAuthMetaRef.current = null;
        }}
        onCopyOAuthAuthorizeUrl={() => {
          if (!oauthWaiting?.connectUrl) return;
          void copyAuthorizeUrlForPrivateWindow(oauthWaiting.connectUrl).then((copied) => {
            if (copied) {
              toast.message('Authorize URL copied. Paste it into a private/incognito window.');
            } else {
              toast.error('Could not copy authorize URL. Please try again.');
            }
          });
        }}
        onAddAnotherAccount={() => {
          if (!selectedDisplayItem) return;
          handleOpenConnectDialog(selectedDisplayItem, {
            keepSheetOpen: true,
            preserveConnectSuccess: true,
          });
        }}
        onDismissConnectSuccess={() => setConnectSuccess(null)}
      />

      <Dialog
        open={!!pendingConnectItem}
        onOpenChange={(open) => {
          if (!open) {
            setPendingConnectItem(null);
            setPendingConnectLabel('');
          }
        }}
      >
        <DialogContent data-testid="provider-integration-connect-dialog">
          <DialogHeader>
            <DialogTitle>
              {isAddingAnotherAccount
                ? `Add another ${pendingConnectItem?.displayName ?? 'app'} account`
                : `Connect ${pendingConnectItem?.displayName ?? 'app'}`}
            </DialogTitle>
            <DialogDescription>
              {isAddingAnotherAccount
                ? 'A label is required so you can tell these accounts apart later. Then authorize in the popup — you stay signed into Console.'
                : 'Label this account, then authorize it in the popup. You stay signed into Console — only the popup switches identity.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="provider-integration-connect-label" className="text-label-muted">
                Account label{isAddingAnotherAccount ? ' (required)' : ''}
              </label>
              <Input
                id="provider-integration-connect-label"
                value={pendingConnectLabel}
                onChange={(event) => setPendingConnectLabel(event.target.value)}
                placeholder={`e.g. Work ${pendingConnectItem?.displayName ?? 'account'}`}
                autoFocus
                required={isAddingAnotherAccount}
                aria-required={isAddingAnotherAccount}
                data-testid="provider-integration-connect-label"
              />
              <p className="text-caption">
                Examples: djl11, approver-bot, Work {pendingConnectItem?.displayName ?? 'account'}.
              </p>
            </div>
            <Alert
              className="border-[color:var(--status-warning)]/40 bg-[var(--status-warning-bg)]"
              data-testid="provider-integration-connect-identity-warning"
            >
              <AlertTitle className="text-sm">Use a different identity</AlertTitle>
              <AlertDescription className="text-xs leading-5 text-muted-foreground">
                If the popup skips straight to Approve, it is still using the account already signed
                into that provider in this browser. Switch accounts in the popup, or open the
                authorize link in a private window.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingConnectItem(null);
                setPendingConnectLabel('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(providerConnectingSlug) || connectLabelRequiredMissing}
              onClick={() => handleConnectDialogSubmit('manual')}
              data-testid="provider-integration-connect-private-window"
            >
              Open in private window
            </Button>
            <Button
              type="button"
              disabled={Boolean(providerConnectingSlug) || connectLabelRequiredMissing}
              onClick={() => handleConnectDialogSubmit('popup')}
              data-testid="provider-integration-connect-submit"
            >
              Continue to authorize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog (covers all delete-style actions) */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent data-testid="integrations-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
            >
              {pendingDelete?.type === 'integration'
                ? oauthDisconnectStage === 'credentials'
                  ? 'Remove'
                  : 'Disconnect'
                : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingProviderDisconnect}
        onOpenChange={(open) => !open && setPendingProviderDisconnect(null)}
      >
        <AlertDialogContent data-testid="provider-integration-disconnect-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this app?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the current authorization for this assistant. You can reconnect the app
              later if you need it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmProviderDisconnect}
              className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* JSON upload preview */}
      {pendingUpload && (
        <JsonUploadPreviewDialog
          pendingUpload={pendingUpload}
          isSubmitting={isSubmitting}
          onConfirm={confirmUploadJson}
          onCancel={cancelUploadJson}
        />
      )}
    </div>
  );
}
