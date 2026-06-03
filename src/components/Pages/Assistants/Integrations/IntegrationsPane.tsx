'use client';

import * as React from 'react';
import { Search, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
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
import { useAssistantSecrets } from '@/hooks/Assistants/useAssistantSecrets';
import {
  disconnectIntegration,
  isWorkspaceManagedSecretName,
  partitionForIntegrations,
  startOAuthConnect,
  useIntegrationCallbackFlash,
} from '@/hooks/Assistants/useAssistantIntegrations';
import { openPendingOAuthTab } from '@/utils/assistants/oauth';
import { SecretsTable } from '../Secrets/SecretsTable';
import { SecretFormDialog } from '../Secrets/SecretFormDialog';
import { JsonUploadPreviewDialog } from '../Secrets/JsonUploadPreviewDialog';
import type { Secret, SecretActions } from '@/types/assistants/secret';
import type {
  IntegrationCardState,
  IntegrationProviderConfig,
  IntegrationProviderId,
} from '@/types/assistants/integration';
import { AddNewDropdown } from './AddNewDropdown';
import { IntegrationCard } from './IntegrationCard';
import { ApiKeyIntegrationDialog } from './ApiKeyIntegrationDialog';
import { OAuthIntegrationDialog, type OAuthSubmitPayload } from './OAuthIntegrationDialog';
import { getIntegrationProvider } from '@/constants/assistants/integrations';

interface IntegrationsPaneProps {
  ownerId: string;
  assistantId: string;
  secretActions: SecretActions;
  canWrite?: boolean;
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

type PendingDelete =
  | { type: 'secret'; secret: Secret }
  | { type: 'folder'; prefix: string; count: number }
  | { type: 'integration'; provider: IntegrationProviderConfig; state: IntegrationCardState };

type IntegrationDialog = null | {
  mode: 'add' | 'edit';
  provider: IntegrationProviderConfig;
};

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
  canWrite = true,
  onSecretsCountChange,
}: IntegrationsPaneProps) {
  const {
    secrets,
    isLoading,
    isSubmitting,
    formMethods,
    handleSelectSecret,
    handleNewSecret,
    handleDeleteSecret,
    handleDeleteFolder,
    pendingUpload,
    handleFileSelected,
    confirmUploadJson,
    cancelUploadJson,
    sorting,
    handleSort,
    searchQuery,
    handleSearch,
    clearSearch,
    onSubmit,
    fetchSecrets,
  } = useAssistantSecrets(assistantId, ownerId, secretActions);

  // Local UI state.
  const [searchValue, setSearchValue] = React.useState(searchQuery);
  React.useEffect(() => setSearchValue(searchQuery), [searchQuery]);

  const submitSearch = React.useCallback(() => {
    const trimmed = searchValue.trim();
    if (trimmed) handleSearch(trimmed);
    else clearSearch();
  }, [searchValue, handleSearch, clearSearch]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchValue('');
    clearSearch();
  };

  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [customDialogMode, setCustomDialogMode] = React.useState<'create' | 'edit' | null>(null);
  const [integrationDialog, setIntegrationDialog] = React.useState<IntegrationDialog>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
  const { cards, otherSecrets, hiddenSecrets } = React.useMemo(
    () => partitionForIntegrations(secrets),
    [secrets]
  );

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
    const customSecrets = otherSecrets.filter((s) => !isWorkspaceManagedSecretName(s.name)).length;
    return readyCards + customSecrets;
  }, [cards, otherSecrets]);
  React.useEffect(() => {
    onSecretsCountChange?.(activeIntegrationCount);
  }, [activeIntegrationCount, onSecretsCountChange]);
  const hiddenLogIds = React.useMemo(
    () => new Set(hiddenSecrets.map((s) => s.logId)),
    [hiddenSecrets]
  );

  // Any provider that already has a card (connected, configured, or
  // needs_reconnect) is hidden from "Add new" — the user re-enters via
  // Edit/Reconnect on the card instead of the empty-paste flow.
  const hiddenProviderIds = React.useMemo(() => new Set(cards.map((c) => c.provider.id)), [cards]);

  // ---- Action handlers --------------------------------------------------

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleAddNewSelect = (providerId: IntegrationProviderId) => {
    if (providerId === 'custom') {
      handleNewSecret();
      setCustomDialogMode('create');
      return;
    }
    const provider = getIntegrationProvider(providerId);
    if (!provider) return;
    setIntegrationDialog({ mode: 'add', provider });
  };

  const handleEditCustomSecret = (secret: Secret) => {
    handleSelectSecret(secret);
    setCustomDialogMode('edit');
  };

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

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const pd = pendingDelete;
    setPendingDelete(null);
    if (pd.type === 'secret') {
      await handleDeleteSecret(pd.secret);
    } else if (pd.type === 'folder') {
      await handleDeleteFolder(pd.prefix);
    } else if (pd.type === 'integration') {
      const ok = await disconnectIntegration({
        assistantId,
        providerId: pd.provider.id,
      });
      if (ok) await fetchSecrets();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Filter the secrets table to exclude integration-owned + hidden rows.
  const tableSecrets = React.useMemo(
    () => otherSecrets.filter((s) => !hiddenLogIds.has(s.logId)),
    [otherSecrets, hiddenLogIds]
  );

  // OAuth disconnect runs in two stages — title and copy reflect which
  // one will fire when the user confirms.  ``connected`` ⇒ tokens-only
  // (Client ID/Secret kept).  ``needs_reconnect`` ⇒ full removal.
  const oauthDisconnectStage: 'tokens' | 'credentials' | null = (() => {
    if (!pendingDelete || pendingDelete.type !== 'integration') return null;
    if (pendingDelete.provider.auth.kind !== 'oauth_authorization_code') return null;
    return pendingDelete.state.kind === 'connected' ? 'tokens' : 'credentials';
  })();

  const deleteDialogTitle = (() => {
    if (!pendingDelete) return '';
    if (pendingDelete.type === 'folder') {
      return `Delete ${pendingDelete.count} secret${
        pendingDelete.count === 1 ? '' : 's'
      } under "${pendingDelete.prefix}/"?`;
    }
    if (pendingDelete.type === 'secret') {
      return `Delete secret "${pendingDelete.secret.name}"?`;
    }
    if (oauthDisconnectStage === 'credentials') {
      return `Remove ${pendingDelete.provider.label}?`;
    }
    return `Disconnect ${pendingDelete.provider.label}?`;
  })();

  const deleteDialogDescription = (() => {
    if (!pendingDelete || pendingDelete.type !== 'integration') {
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
      {/* Header — search + actions */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        data-testid="integrations-header"
      >
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search secrets…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            data-testid="integrations-search"
          />
          {searchValue && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
              data-testid="integrations-search-clear"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {canWrite && (
          <TooltipProvider delayDuration={200}>
            <AddNewDropdown
              onSelect={handleAddNewSelect}
              disabled={isSubmitting || isIntegrationSubmitting}
              hiddenProviderIds={hiddenProviderIds}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || isIntegrationSubmitting}
                  data-testid="integrations-upload-button"
                  aria-label="Upload JSON"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="max-w-xs whitespace-normal p-3 text-xs"
              >
                <p className="mb-2 font-medium">Upload secrets from JSON file</p>
                <p className="text-muted-foreground">
                  Bulk-add custom secrets from a JSON file. For integration-managed values (like
                  OAuth credentials), use Add new &rarr; the relevant integration instead.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Body — cards + table */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Integration cards section */}
        {cards.length > 0 && (
          <div
            className="bg-muted/20 flex flex-col gap-2 border-b px-3 py-3"
            data-testid="integrations-cards"
          >
            {cards.map((card) => (
              <IntegrationCard
                key={card.provider.id}
                provider={card.provider}
                state={card.state}
                onEdit={() => handleEditIntegration(card.provider)}
                onReconnect={() => handleReconnectIntegration(card.provider)}
                onDisconnect={() => handleDisconnectRequest(card.provider, card.state)}
                busy={isIntegrationSubmitting}
              />
            ))}
          </div>
        )}

        {/* Custom secrets table — rendered directly under the integration
            cards with no separator label. */}
        <div data-testid="integrations-custom-secrets">
          <SecretsTable
            secrets={tableSecrets}
            isLoading={isLoading}
            canWrite={canWrite}
            searchQuery={searchQuery}
            expandedFolders={expandedFolders}
            sorting={sorting}
            onSort={handleSort}
            onToggleFolder={toggleFolder}
            onUpdateSecret={handleEditCustomSecret}
            onDeleteSecret={(s) => setPendingDelete({ type: 'secret', secret: s })}
            onDeleteFolder={(prefix) => {
              const count = secrets.filter(
                (s) => s.name === prefix || s.name.startsWith(prefix + '/')
              ).length;
              setPendingDelete({ type: 'folder', prefix, count });
            }}
          />
        </div>
      </div>

      {/* Hidden file input for JSON uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
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
