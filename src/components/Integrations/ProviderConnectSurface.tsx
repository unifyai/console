'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
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
import {
  cancelProviderIntegration,
  disconnectProviderIntegration,
  reconnectProviderIntegration,
  requestUnityIntegrationToolsSync,
  testProviderIntegration,
  updateProviderIntegrationConnection,
} from '@/lib/client/integrations';
import { copyAuthorizeUrlForPrivateWindow, subscribeOAuthComplete } from '@/utils/assistants/oauth';
import { ProviderIntegrationDetailSheet } from './ProviderIntegrationDetailSheet';
import type {
  IntegrationConnectSuccessState,
  IntegrationOAuthWaitingState,
} from './IntegrationConnectLoopBanners';
import type {
  IntegrationConnection,
  IntegrationDefinition,
  IntegrationGalleryItem,
  ProviderIntegrationConnectStartResponse,
} from '@/types/integrations';

/**
 * Connecting a provider app: the drawer, the account-label dialog, the OAuth
 * round trip, and every action on an existing connection.
 *
 * All of it lives here because all of it is one flow, and a surface that
 * mounts only part of it is a different product wearing the same drawer.
 * That is not hypothetical — the Workflows shelf mounted
 * `ProviderIntegrationDetailSheet` alone and reimplemented `connect` as a
 * single call. It passed ten of the drawer's twenty-one props, so it had no
 * account-label step, no authorization-in-progress state, and no disconnect,
 * cancel, reconnect, test or relabel. A connection begun there had nothing
 * watching the popup, so it never settled: it left a row wedged in
 * `connecting` that the backend then reused for every later attempt, and the
 * user had no affordance anywhere on that surface to clear it.
 *
 * Data access is injected rather than fetched here, because the two callers
 * hold different catalogues — the gallery browses, the shelf resolves the
 * apps a bundle names. What must not differ is anything below.
 */
export interface ProviderConnectSurfaceProps {
  assistantId: string;
  /** The app to show, already merged with its fetched detail. */
  item: IntegrationGalleryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Re-read this app from the caller's catalogue, for post-connect state. */
  findLatest: (canonicalSlug: string) => IntegrationGalleryItem | null;
  startConnect: (
    definition: IntegrationDefinition,
    apiKeyValues?: Record<string, string>,
    options?: { accountLabel?: string; navigation?: 'popup' | 'manual' }
  ) => Promise<ProviderIntegrationConnectStartResponse | null>;
  refresh: () => Promise<void> | void;
  fetchDetails: (definition: IntegrationDefinition) => Promise<unknown>;
  isMock?: boolean;
  isDetailLoading?: boolean;
  connectingSlug?: string | null;
  canManageCustomAuth?: boolean;
  /**
   * Open the account-label step for this app directly, without the drawer.
   * The gallery's cards connect in one click; set this, and clear it from
   * `onConnectIntentHandled`.
   */
  connectIntent?: IntegrationGalleryItem | null;
  onConnectIntentHandled?: () => void;
  /** Caller tracks which app is open (the gallery keeps its own selection). */
  onSelectItem?: (item: IntegrationGalleryItem) => void;
  /** Fired once the app reports connected, so a caller can act on it. */
  onConnected?: (canonicalSlug: string) => void;
  /**
   * Handle a primary action this surface does not own — a native app, a
   * static package, a custom secret. Return true when handled.
   */
  onUnmanagedPrimaryAction?: (item: IntegrationGalleryItem) => boolean;
  /** Same, for a connection belonging to a static package. Return true when handled. */
  onUnmanagedConnectionAction?: (
    connection: IntegrationConnection,
    action: 'reconnect' | 'disconnect'
  ) => boolean;
  ariaLabel?: string;
}

export function ProviderConnectSurface({
  assistantId,
  item,
  open,
  onOpenChange,
  findLatest,
  startConnect,
  refresh,
  fetchDetails,
  isMock = false,
  isDetailLoading = false,
  connectingSlug = null,
  canManageCustomAuth = true,
  connectIntent = null,
  onConnectIntentHandled,
  onSelectItem,
  onConnected,
  onUnmanagedPrimaryAction,
  onUnmanagedConnectionAction,
  ariaLabel,
}: ProviderConnectSurfaceProps) {
  const [pendingConnectItem, setPendingConnectItem] = React.useState<IntegrationGalleryItem | null>(
    null
  );
  const [pendingConnectLabel, setPendingConnectLabel] = React.useState('');
  const [pendingDisconnect, setPendingDisconnect] = React.useState<IntegrationConnection | null>(
    null
  );
  const [busyConnectionId, setBusyConnectionId] = React.useState<string | null>(null);
  const [oauthWaiting, setOauthWaiting] = React.useState<IntegrationOAuthWaitingState | null>(null);
  const [connectSuccess, setConnectSuccess] = React.useState<IntegrationConnectSuccessState | null>(
    null
  );
  const pendingOAuthMetaRef = React.useRef<{
    item: IntegrationGalleryItem;
    accountLabel?: string;
  } | null>(null);

  const countLiveConnections = React.useCallback((target: IntegrationGalleryItem | null) => {
    if (!target) return 0;
    return target.connections.filter((connection) => connection.status !== 'disconnected').length;
  }, []);

  const finishConnectLoopSuccess = React.useCallback(
    (target: IntegrationGalleryItem, accountLabel?: string) => {
      const refreshed = findLatest(target.canonicalSlug) ?? target;
      onSelectItem?.(refreshed);
      setOauthWaiting(null);
      setConnectSuccess({
        canonicalSlug: refreshed.canonicalSlug,
        displayName: refreshed.displayName,
        accountLabel,
        accountCount: Math.max(
          1,
          countLiveConnections(refreshed),
          countLiveConnections(target) + 1
        ),
      });
      pendingOAuthMetaRef.current = null;
      onConnected?.(refreshed.canonicalSlug);
    },
    [countLiveConnections, findLatest, onConnected, onSelectItem]
  );

  const beginConnect = React.useCallback(
    async (
      target: IntegrationGalleryItem,
      options: { accountLabel?: string; navigation?: 'popup' | 'manual' } = {}
    ) => {
      const accountLabel = options.accountLabel?.trim() || undefined;
      const navigation = options.navigation ?? 'popup';
      pendingOAuthMetaRef.current = { item: target, accountLabel };
      setConnectSuccess(null);
      onSelectItem?.(target);

      const data = await startConnect(target, undefined, { accountLabel, navigation });
      if (!data) {
        pendingOAuthMetaRef.current = null;
        setOauthWaiting(null);
        return;
      }

      if (isMock || !data.connectUrl) {
        finishConnectLoopSuccess(target, accountLabel);
        return;
      }

      if (navigation === 'manual') {
        const copied = await copyAuthorizeUrlForPrivateWindow(data.connectUrl);
        toast.message(
          copied
            ? 'Authorize URL copied. Paste it into a private/incognito window and sign in as the next account.'
            : 'Open a private/incognito window and paste the authorize URL from Copy authorize URL.'
        );
      }

      setOauthWaiting({
        canonicalSlug: target.canonicalSlug,
        displayName: target.displayName,
        accountLabel,
        connectUrl: data.connectUrl,
        mode: navigation,
      });
    },
    [finishConnectLoopSuccess, isMock, onSelectItem, startConnect]
  );

  // The popup settles out of band. Without this subscription a connection
  // begun here stays `connecting` forever — which is what stranded rows the
  // backend then reused on every retry.
  React.useEffect(() => {
    return subscribeOAuthComplete((detail) => {
      if (detail.kind !== 'integration') return;
      void refresh();
      const pending = pendingOAuthMetaRef.current;
      if (pending) {
        window.setTimeout(() => finishConnectLoopSuccess(pending.item, pending.accountLabel), 900);
      }
      if (item && (item.source === 'provider_backed' || item.source === 'overlay_curated')) {
        window.setTimeout(() => void fetchDetails(item), 900);
        window.setTimeout(() => void fetchDetails(item), 1800);
      }
    });
  }, [fetchDetails, finishConnectLoopSuccess, item, refresh]);

  const openConnectDialog = React.useCallback(
    (target: IntegrationGalleryItem, options: { preserveConnectSuccess?: boolean } = {}) => {
      if (!options.preserveConnectSuccess) setConnectSuccess(null);
      setPendingConnectItem(target);
      setPendingConnectLabel('');
    },
    []
  );

  // Keyed on the intent alone. Callers pass an inline handler, so depending
  // on its identity would re-open the dialog on every parent render for as
  // long as the intent is set.
  const onConnectIntentHandledRef = React.useRef(onConnectIntentHandled);
  onConnectIntentHandledRef.current = onConnectIntentHandled;
  React.useEffect(() => {
    if (!connectIntent) return;
    openConnectDialog(connectIntent);
    onConnectIntentHandledRef.current?.();
  }, [connectIntent, openConnectDialog]);

  const handlePrimaryAction = React.useCallback(
    (target: IntegrationGalleryItem, options: { accountLabel?: string } = {}) => {
      if (onUnmanagedPrimaryAction?.(target)) return;
      if (!options.accountLabel) {
        openConnectDialog(target);
        return;
      }
      void beginConnect(target, { accountLabel: options.accountLabel, navigation: 'popup' });
    },
    [beginConnect, onUnmanagedPrimaryAction, openConnectDialog]
  );

  const handleApiKeySubmit = React.useCallback(
    (
      target: IntegrationGalleryItem,
      values: Record<string, string>,
      options: { accountLabel?: string } = {}
    ) => {
      void (async () => {
        const data = await startConnect(target, values, { accountLabel: options.accountLabel });
        if (data) finishConnectLoopSuccess(target, options.accountLabel?.trim() || undefined);
      })();
    },
    [finishConnectLoopSuccess, startConnect]
  );

  const isAddingAnotherAccount = Boolean(
    pendingConnectItem &&
    (countLiveConnections(pendingConnectItem) > 0 ||
      (connectSuccess !== null &&
        connectSuccess.canonicalSlug === pendingConnectItem.canonicalSlug))
  );
  const connectLabelRequiredMissing =
    isAddingAnotherAccount && pendingConnectLabel.trim().length === 0;

  const submitConnectDialog = (navigation: 'popup' | 'manual') => {
    const target = pendingConnectItem;
    if (!target) return;
    const accountLabel = pendingConnectLabel.trim() || undefined;
    if (isAddingAnotherAccount && !accountLabel) {
      toast.error('Account label is required when adding another account.');
      return;
    }
    setPendingConnectItem(null);
    setPendingConnectLabel('');
    void beginConnect(target, { accountLabel, navigation });
  };

  // ---- Actions on an existing connection --------------------------------

  const afterConnectionChange = React.useCallback(async () => {
    await refresh();
    if (item) await fetchDetails(item);
  }, [fetchDetails, item, refresh]);

  const handleReconnect = async (connection: IntegrationConnection) => {
    if (onUnmanagedConnectionAction?.(connection, 'reconnect')) return;
    setBusyConnectionId(connection.id);
    try {
      const updated = await reconnectProviderIntegration(connection.id);
      const definition = findLatest(connection.canonicalSlug);
      if (definition?.authModes.includes('oauth')) {
        await startConnect(definition, undefined, {
          accountLabel: connection.accountLabel ?? undefined,
        });
      } else {
        await requestUnityIntegrationToolsSync({ assistantId, connection: updated }).catch(
          (error) => {
            console.warn('Failed to request Unity integration tool sync after reconnect', error);
          }
        );
        toast.success('Reconnect started.');
      }
      await refresh();
    } catch (error) {
      console.error('Failed to reconnect provider integration', error);
      toast.error('Could not reconnect. Please try again.');
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleDisconnectRequest = (connection: IntegrationConnection) => {
    if (onUnmanagedConnectionAction?.(connection, 'disconnect')) return;
    setPendingDisconnect(connection);
  };

  const confirmDisconnect = async () => {
    const connection = pendingDisconnect;
    if (!connection) return;
    setPendingDisconnect(null);
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
      await afterConnectionChange();
    } catch (error) {
      console.error('Failed to disconnect provider integration', error);
      toast.error('Could not disconnect. Please try again.');
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleCancel = async (connection: IntegrationConnection) => {
    setBusyConnectionId(connection.id);
    try {
      await cancelProviderIntegration(connection.id);
      toast.success('Setup cancelled.');
      await afterConnectionChange();
    } catch (error) {
      console.error('Failed to cancel provider integration setup', error);
      toast.error('Could not cancel setup. Please try again.');
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleTest = async (connection: IntegrationConnection) => {
    if (connection.source !== 'provider_backed' && connection.source !== 'overlay_curated') return;
    setBusyConnectionId(connection.id);
    try {
      const updated = await testProviderIntegration(connection.id);
      await requestUnityIntegrationToolsSync({ assistantId, connection: updated }).catch(
        (error) => {
          console.warn(
            'Failed to request Unity integration tool sync after connection test',
            error
          );
        }
      );
      toast.success('Connection is healthy.');
      await afterConnectionChange();
    } catch (error) {
      console.error('Failed to test provider integration', error);
      toast.error('Could not test connection. Please try again.');
    } finally {
      setBusyConnectionId(null);
    }
  };

  const handleLabelUpdate = async (connection: IntegrationConnection, accountLabel: string) => {
    if (connection.source !== 'provider_backed' && connection.source !== 'overlay_curated') return;
    setBusyConnectionId(connection.id);
    try {
      await updateProviderIntegrationConnection(connection.id, {
        accountLabel: accountLabel.trim() || null,
      });
      toast.success('Account label updated.');
      await afterConnectionChange();
    } catch (error) {
      console.error('Failed to update provider integration label', error);
      toast.error('Could not update label. Please try again.');
      throw error;
    } finally {
      setBusyConnectionId(null);
    }
  };

  // A connection that lands by any route — popup, manual authorize, API key
  // — must reach the caller, not only the ones this surface starts.
  React.useEffect(() => {
    if (!open || !item) return;
    if (item.status === 'connected' || item.status === 'configured') {
      onConnected?.(item.canonicalSlug);
    }
  }, [item, onConnected, open]);

  return (
    <>
      <ProviderIntegrationDetailSheet
        item={item}
        open={open}
        assistantId={assistantId}
        busy={Boolean(connectingSlug)}
        busyConnectionId={busyConnectionId}
        canManageCustomAuth={canManageCustomAuth}
        isDetailLoading={isDetailLoading}
        onOpenChange={(next) => {
          if (!next) {
            setOauthWaiting(null);
            setConnectSuccess(null);
            pendingOAuthMetaRef.current = null;
          }
          onOpenChange(next);
        }}
        onPrimaryAction={handlePrimaryAction}
        onApiKeySubmit={handleApiKeySubmit}
        onReconnectConnection={(connection) => void handleReconnect(connection)}
        onDisconnectConnection={(connection) => handleDisconnectRequest(connection)}
        onCancelConnection={(connection) => void handleCancel(connection)}
        onTestConnection={(connection) => void handleTest(connection)}
        onUpdateConnectionLabel={(connection, accountLabel) =>
          handleLabelUpdate(connection, accountLabel)
        }
        oauthWaiting={
          oauthWaiting && item && oauthWaiting.canonicalSlug === item.canonicalSlug
            ? oauthWaiting
            : null
        }
        connectSuccess={
          connectSuccess && item && connectSuccess.canonicalSlug === item.canonicalSlug
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
          if (!item) return;
          openConnectDialog(item, { preserveConnectSuccess: true });
        }}
        onDismissConnectSuccess={() => setConnectSuccess(null)}
        aria-label={ariaLabel}
      />

      <Dialog
        open={!!pendingConnectItem}
        onOpenChange={(next) => {
          if (!next) {
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
              disabled={Boolean(connectingSlug) || connectLabelRequiredMissing}
              onClick={() => submitConnectDialog('manual')}
              data-testid="provider-integration-connect-private-window"
            >
              Open in private window
            </Button>
            <Button
              type="button"
              disabled={Boolean(connectingSlug) || connectLabelRequiredMissing}
              onClick={() => submitConnectDialog('popup')}
              data-testid="provider-integration-connect-submit"
            >
              Continue to authorize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDisconnect}
        onOpenChange={(next) => !next && setPendingDisconnect(null)}
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
              onClick={confirmDisconnect}
              className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
