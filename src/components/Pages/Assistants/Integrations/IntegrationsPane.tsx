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
import { openPendingOAuthTab, subscribeOAuthComplete } from '@/utils/assistants/oauth';
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
  type IntegrationGalleryFilters,
} from '@/components/Integrations';
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
  isVisible = true,
  onSecretsCountChange,
}: IntegrationsPaneProps) {
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
  } = useAssistantSecrets(assistantId, ownerId, secretActions);
  const [galleryFilters, setGalleryFilters] =
    React.useState<IntegrationGalleryFilters>(DEFAULT_GALLERY_FILTERS);
  const catalogSourceType =
    galleryFilters.category === 'native'
      ? 'native'
      : galleryFilters.category === 'third_party'
        ? 'third_party'
        : null;
  const catalogStatusGroups = React.useMemo(
    () => statusGroupsForFilter(galleryFilters.status),
    [galleryFilters.status]
  );
  const providerCatalog = useProviderIntegrationCatalog(assistantId, {
    query: galleryFilters.query,
    sourceType: catalogSourceType,
    statusGroups: catalogStatusGroups,
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
  const selectedDetail = selectedIntegration
    ? detailsBySlug[selectedIntegration.canonicalSlug]
    : null;
  const selectedDisplayItem = React.useMemo(() => {
    if (!selectedIntegration) return null;
    const refreshedGalleryItem = galleryItems.find(
      (item) => item.canonicalSlug === selectedIntegration.canonicalSlug
    );
    const base = refreshedGalleryItem ?? selectedIntegration;
    if (!selectedDetail) return base;
    const baseConnection =
      base.primaryConnection ??
      base.connections.find((connection) => connection.status !== 'disconnected') ??
      null;
    const detailConnection =
      selectedDetail.connections.find((connection) => connection.status !== 'disconnected') ?? null;
    return {
      ...selectedDetail,
      ...base,
      scopes: selectedDetail.scopes.length > 0 ? selectedDetail.scopes : base.scopes,
      tools: selectedDetail.tools.length > 0 ? selectedDetail.tools : base.tools,
      capabilityGroups:
        selectedDetail.capabilityGroups.length > 0
          ? selectedDetail.capabilityGroups
          : base.capabilityGroups,
      apiKeySchema: selectedDetail.apiKeySchema ?? base.apiKeySchema,
      docsUrl: selectedDetail.docsUrl ?? base.docsUrl,
      sources: base.sources,
      isMock: base.isMock,
      primaryConnection: baseConnection ?? detailConnection,
      connections: base.connections.length > 0 ? base.connections : selectedDetail.connections,
    } as IntegrationGalleryItem;
  }, [galleryItems, selectedDetail, selectedIntegration]);

  React.useEffect(() => {
    if (!selectedIntegration) return;
    if (
      selectedIntegration.source !== 'provider_backed' &&
      selectedIntegration.source !== 'overlay_curated'
    ) {
      return;
    }
    void fetchDetails(selectedIntegration);
  }, [fetchDetails, selectedIntegration]);

  React.useEffect(() => {
    return subscribeOAuthComplete((detail) => {
      if (detail.kind !== 'integration') return;
      refreshProviderCatalog();
      if (
        selectedIntegration &&
        (selectedIntegration.source === 'provider_backed' ||
          selectedIntegration.source === 'overlay_curated')
      ) {
        window.setTimeout(() => void fetchDetails(selectedIntegration), 900);
        window.setTimeout(() => void fetchDetails(selectedIntegration), 1800);
      }
    });
  }, [fetchDetails, refreshProviderCatalog, selectedIntegration]);

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

  const handleOpenConnectDialog = (item: IntegrationGalleryItem) => {
    setSelectedIntegration(null);
    setPendingConnectItem(item);
    setPendingConnectLabel('');
  };

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
      handleOpenConnectDialog(item);
      return;
    }

    void startProviderConnect(item, undefined, options);
  };

  const handleProviderApiKeySubmit = (
    item: IntegrationGalleryItem,
    values: Record<string, string>,
    options: { accountLabel?: string } = {}
  ) => {
    void startProviderConnect(item, values, options);
  };

  const handleConnectDialogSubmit = () => {
    const item = pendingConnectItem;
    if (!item) return;
    setPendingConnectItem(null);
    handleDetailPrimaryAction(item, {
      accountLabel: pendingConnectLabel.trim() || undefined,
    });
  };

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
      // Iterates per field so api_key_multi (e.g. Matterport's Token ID
      // + secret pair) and single-field api_key share one path.
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
          isLoading={shouldShowGallerySkeleton || isProviderCatalogLoading}
          isMock={isProviderCatalogMock}
          busySlug={providerConnectingSlug}
          isRefreshing={isProviderCatalogLoading}
          filters={galleryFilters}
          onFiltersChange={setGalleryFilters}
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
          if (!open) setSelectedIntegration(null);
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
        isDetailLoading={
          !!selectedDisplayItem && isDetailLoading === selectedDisplayItem.canonicalSlug
        }
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
            <DialogTitle>Connect {pendingConnectItem?.displayName ?? 'app'}</DialogTitle>
            <DialogDescription>
              Add an optional label so this account is easy to recognize later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="provider-integration-connect-label" className="text-label-muted">
              Account label
            </label>
            <Input
              id="provider-integration-connect-label"
              value={pendingConnectLabel}
              onChange={(event) => setPendingConnectLabel(event.target.value)}
              placeholder={`e.g. Work ${pendingConnectItem?.displayName ?? 'account'}`}
              autoFocus
              data-testid="provider-integration-connect-label"
            />
            <p className="text-caption">Examples: Work Slack, Personal Gmail, Client Discord.</p>
          </div>
          <DialogFooter>
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
              disabled={Boolean(providerConnectingSlug)}
              onClick={handleConnectDialogSubmit}
              data-testid="provider-integration-connect-submit"
            >
              Connect
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
