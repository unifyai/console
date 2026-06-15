'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Label } from '@/components/UI/label';
import { Badge } from '@/components/UI/badge';
import { AlertCircle, Link2, Loader2 } from 'lucide-react';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { useAssistantContactManager } from '@/hooks/Assistants/useAssistantContactManager';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import {
  ByodProviderCard,
  DisplayContactField,
  FeatureChecklist,
  PROVIDER_LABELS,
  ProviderBadge,
} from './AssistantContactManager';
import type { OAuthProvider } from '@/types/assistants/contact';

interface AssistantWorkspaceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  onSuccess: () => void;
  /** Whether the current user can edit workspace details. */
  canWrite?: boolean;
  /** Provider to preselect when the dialog is opened from a provider-specific CTA. */
  initialProvider?: OAuthProvider | null;
}

/**
 * Standalone modal for the workspace OAuth flow — connect-your-own-account
 * (Google / Microsoft 365), feature scope selection, and disconnect.
 *
 * Carved out of ``AssistantContactManager``'s Email tab so the workspace
 * configuration has a dedicated entry in the row dropdown and can be
 * opened from elsewhere (e.g. the Email tab's "Add/update config" CTA)
 * without dragging the rest of the contact-tab UI along.
 *
 * Reuses ``useAssistantContactManager`` with ``initialTab='email'`` for
 * the BYOD state — connect / disconnect / features / loading flags all
 * flow through that hook unchanged.  Phone / WhatsApp / Discord state
 * the hook produces is unused here and harmless.
 */
export function AssistantWorkspaceManager({
  isOpen,
  onClose,
  assistant,
  assistantActions,
  onSuccess,
  canWrite = true,
  initialProvider = null,
}: AssistantWorkspaceManagerProps) {
  const { workspaceGoogle, workspaceMicrosoft } = useFeatures();
  const assistantName = assistantDisplayName(assistant);
  const workspaceDescription = assistant.isCoordinator ? (
    <>
      Connect <strong className="font-bold text-foreground">your own</strong> Google or Microsoft
      account so {assistantName} can help with your day-to-day task.
    </>
  ) : (
    <>
      <span className="block">
        Create a <strong className="font-bold text-foreground">new</strong> Google or Microsoft
        account for {assistantName}, so they can join your team, gain their own unique access
        controls to the files and applications you use via{' '}
        <strong className="font-bold text-foreground">their own</strong> new account, and can work
        alongside your team.
      </span>
      <span className="mt-2 block">
        Do <strong className="font-bold text-foreground">not</strong> connect {assistantName} to
        your own Google/Microsoft account. Only Marty should have access to your personal account.
      </span>
      <span className="text-title mt-4 block text-foreground">Steps</span>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Log out of your own account.</li>
        <li>Create a new account for {assistantName}, or ask your IT team to do so.</li>
        <li>Log into the new account for {assistantName} on your machine.</li>
        <li>Click the corresponding workspace below to auto-sync for {assistantName}.</li>
      </ol>
    </>
  );

  const {
    byodProvider,
    setByodProvider,
    selectedFeatures,
    toggleFeature,
    availableFeaturesForByod,
    requiredFeaturesForByod,
    grantedFeatures,
    isLoadingFeatures,
    hasFeaturesChanged,
    connectAccount,
    updateFeatures,
    disconnectAccount,
    isConnecting,
    isDisconnecting,
    confirmDisconnect,
    setConfirmDisconnect,
    isByodEmail,
    isPlatformEmail,
  } = useAssistantContactManager({
    assistant,
    isOpen,
    assistantActions,
    onSuccess,
    initialTab: 'email',
  });

  const isBusy = isConnecting || isDisconnecting;

  React.useEffect(() => {
    if (isOpen && initialProvider && !isByodEmail) {
      setByodProvider(initialProvider);
    }
  }, [isOpen, initialProvider, isByodEmail, setByodProvider]);

  const handleDialogClose = (open: boolean) => {
    if (!isBusy && !open) onClose();
  };

  const handleInteractOutside = (e: React.MouseEvent) => {
    if (isBusy) e.preventDefault();
  };

  // ---- body --------------------------------------------------------------

  const renderBody = () => {
    if (assistant.email && isLoadingFeatures) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-caption">Loading workspace details...</span>
        </div>
      );
    }

    // Read-only viewer
    if (!canWrite) {
      if (assistant.email) {
        return (
          <div className="space-y-2">
            <DisplayContactField label="Connected Email" value={assistant.email} />
            {assistant.emailProvider && <ProviderBadge provider={assistant.emailProvider} />}
          </div>
        );
      }
      return <p className="text-body text-muted-foreground">No workspace configured.</p>;
    }

    // Coordinator contact mailboxes are shared routing addresses; they do not
    // represent a connected workspace account.
    if (isPlatformEmail && !assistant.isCoordinator) {
      return (
        <div className="space-y-3">
          <div className="flex items-center">
            <Label>Email Address</Label>
            {assistant.emailProvider && <ProviderBadge provider={assistant.emailProvider} />}
          </div>
          <DisplayContactField label="" value={assistant.email!} />
          <p className="text-caption text-muted-foreground">
            Platform-managed email. Delete it to connect your own account instead.
          </p>
        </div>
      );
    }

    // BYOD account already connected
    if (isByodEmail) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>Connected Email</Label>
            <Badge variant="outline" className="text-xs">
              <Link2 className="mr-1 h-3 w-3" />
              {PROVIDER_LABELS[grantedFeatures?.provider ?? assistant.emailProvider ?? ''] ??
                'Connected'}
            </Badge>
          </div>
          <DisplayContactField label="" value={assistant.email!} />

          {isLoadingFeatures ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-caption">Loading features...</span>
            </div>
          ) : availableFeaturesForByod.length > 0 ? (
            <div className="space-y-2">
              <Label>Features</Label>
              <FeatureChecklist
                features={availableFeaturesForByod}
                selected={selectedFeatures}
                required={requiredFeaturesForByod}
                onToggle={toggleFeature}
              />
            </div>
          ) : null}
        </div>
      );
    }

    // No connection yet — pick a provider. Each provider stays visible even when
    // the deployment hasn't configured its OAuth client (reported by Orchestra);
    // it's disabled with an explanatory tooltip rather than hidden.
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex gap-2">
            <ByodProviderCard
              provider="google"
              isSelected={byodProvider === 'google'}
              onSelect={() => setByodProvider(byodProvider === 'google' ? null : 'google')}
              disabled={isConnecting}
              unavailableReason={
                workspaceGoogle
                  ? undefined
                  : "Google workspace connect isn't configured on this deployment"
              }
            />
            <ByodProviderCard
              provider="microsoft"
              isSelected={byodProvider === 'microsoft'}
              onSelect={() => setByodProvider(byodProvider === 'microsoft' ? null : 'microsoft')}
              disabled={isConnecting}
              unavailableReason={
                workspaceMicrosoft
                  ? undefined
                  : "Microsoft workspace connect isn't configured on this deployment"
              }
            />
          </div>

          {byodProvider && (
            <div className="space-y-3 pt-1">
              <Label className="text-caption text-muted-foreground">
                Select features to grant access to:
              </Label>
              <FeatureChecklist
                features={availableFeaturesForByod}
                selected={selectedFeatures}
                required={requiredFeaturesForByod}
                onToggle={toggleFeature}
                disabled={isConnecting}
              />
              <Button onClick={connectAccount} disabled={isConnecting || !byodProvider}>
                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---- footer ------------------------------------------------------------

  const renderFooter = () => {
    if (confirmDisconnect) {
      return (
        <div className="flex w-full items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmDisconnect(false)}
            disabled={isDisconnecting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={disconnectAccount} disabled={isDisconnecting}>
            {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Disconnect
          </Button>
        </div>
      );
    }

    if (isByodEmail && canWrite) {
      return (
        <div className="flex w-full items-center justify-end gap-2">
          {hasFeaturesChanged && (
            <Button onClick={updateFeatures} disabled={isConnecting}>
              {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Features
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setConfirmDisconnect(true)}
            disabled={isBusy}
          >
            Disconnect
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent onInteractOutside={handleInteractOutside as any}>
        <DialogHeader>
          <DialogTitle className="text-title">Workspace</DialogTitle>
          <DialogDescription className="text-subtitle">{workspaceDescription}</DialogDescription>
        </DialogHeader>

        {confirmDisconnect ? (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h3 className="text-h2 mt-4">Disconnect account?</h3>
            <p className="text-body-muted mx-auto mt-2 max-w-sm">
              This will revoke access and remove the connected account. Your assistant will no
              longer be able to act on workspace surfaces via this account.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto py-4 pt-2">{renderBody()}</div>
        )}

        <DialogFooter>{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
