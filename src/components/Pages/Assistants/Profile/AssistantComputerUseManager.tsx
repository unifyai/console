'use client';

import React from 'react';
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
import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import type { Assistant, DesktopMode } from '@/types/assistants/assistant';
import {
  disableManagedDesktop,
  enableManagedDesktop,
  getManagedDesktopNetworkIdentityRotation,
  getManagedDesktopStatus,
  rotateManagedDesktopNetworkIdentity,
  type ManagedDesktopNetworkIdentity,
  type NetworkIdentity,
  type NetworkIdentityRotation,
} from '@/lib/assistants/computerUse';

interface AssistantComputerUseManagerProps {
  assistant: Assistant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onAddPaymentMethod: () => void;
}

const OS_OPTIONS: { mode: DesktopMode; label: string; monthlyCost: number }[] = [
  { mode: 'ubuntu', label: 'Ubuntu', monthlyCost: 50 },
  { mode: 'windows', label: 'Windows', monthlyCost: 75 },
];

const NETWORK_IDENTITY_POLL_INTERVAL_MS = 5_000;
const NETWORK_REGION_LABELS = new Map<string, string>([
  ['us-central1', 'Iowa, United States'],
  ['us-east1', 'South Carolina, United States'],
  ['us-east4', 'Northern Virginia, United States'],
  ['us-west1', 'Oregon, United States'],
  ['us-west2', 'Los Angeles, United States'],
  ['us-west3', 'Salt Lake City, United States'],
  ['us-west4', 'Las Vegas, United States'],
  ['europe-west1', 'St. Ghislain, Belgium'],
  ['europe-west2', 'London, United Kingdom'],
  ['europe-west3', 'Frankfurt, Germany'],
  ['europe-west4', 'Eemshaven, Netherlands'],
  ['europe-west6', 'Zürich, Switzerland'],
  ['europe-north1', 'Hamina, Finland'],
]);

function formatNetworkRegion(region: string | null | undefined): string {
  const regionCode = region?.match(/\/regions\/([^/]+)$/)?.[1] ?? region;
  return (regionCode && NETWORK_REGION_LABELS.get(regionCode)) || regionCode || '—';
}

function applyRotation(
  identity: ManagedDesktopNetworkIdentity | null,
  rotation: NetworkIdentityRotation | undefined
): ManagedDesktopNetworkIdentity | null {
  if (!rotation) return identity;
  return {
    gcpAddressName: identity?.gcpAddressName ?? null,
    address: rotation.address ?? identity?.address ?? null,
    region: rotation.region ?? identity?.region ?? null,
    hostname: rotation.hostname ?? identity?.hostname ?? null,
    state: rotation.state ?? identity?.state ?? 'pending',
    activeOperation:
      rotation.activeOperation !== undefined
        ? rotation.activeOperation
        : (identity?.activeOperation ?? null),
    rotation: identity?.rotation ?? null,
  };
}

export function AssistantComputerUseManager({
  assistant,
  open,
  onOpenChange,
  onUpdated,
  onAddPaymentMethod,
}: AssistantComputerUseManagerProps) {
  const [monthlyCost, setMonthlyCost] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = React.useState(false);
  const [confirmRotateOpen, setConfirmRotateOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [networkIdentity, setNetworkIdentity] =
    React.useState<ManagedDesktopNetworkIdentity | null>(null);
  const [isNetworkIdentityLoading, setIsNetworkIdentityLoading] = React.useState(false);
  const [isRotatingNetworkIdentity, setIsRotatingNetworkIdentity] = React.useState(false);

  const isEnabled =
    assistant?.managedDesktopStatus === 'active' ||
    assistant?.managedDesktopStatus === 'grace_period';

  React.useEffect(() => {
    if (!open || !assistant) return;
    let cancelled = false;
    setIsNetworkIdentityLoading(true);
    void (async () => {
      try {
        const result = await getManagedDesktopStatus(assistant.agentId);
        if (cancelled) return;
        if (result.info?.monthlyCost != null) {
          setMonthlyCost(result.info.monthlyCost);
        }
        setNetworkIdentity(applyRotation(null, result.info?.networkIdentity ?? undefined));
        if (result.detail) {
          setError(
            typeof result.detail === 'string'
              ? result.detail
              : 'Failed to load Computer Use status'
          );
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load Computer Use status');
        }
      } finally {
        if (!cancelled) {
          setIsNetworkIdentityLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assistant, open]);

  const rotationActive = Boolean(networkIdentity?.activeOperation);

  React.useEffect(() => {
    if (!open || !assistant || !rotationActive) return;
    let cancelled = false;

    const refreshRotation = async () => {
      const result = await getManagedDesktopNetworkIdentityRotation(assistant.agentId);
      if (cancelled) return;
      if (result.info) {
        setNetworkIdentity((current) => applyRotation(current, result.info));
      } else if (result.detail) {
        setError(
          typeof result.detail === 'string'
            ? result.detail
            : 'Failed to load network identity rotation status'
        );
      }
    };

    void refreshRotation();
    const interval = window.setInterval(
      () => void refreshRotation(),
      NETWORK_IDENTITY_POLL_INTERVAL_MS
    );
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [assistant, open, rotationActive]);

  const handleEnable = async (desktopMode: DesktopMode) => {
    if (!assistant) return;
    setIsLoading(true);
    setError(null);
    const result = await enableManagedDesktop(Number(assistant.agentId), desktopMode);
    setIsLoading(false);
    if (result.assistant) {
      onUpdated();
      onOpenChange(false);
      return;
    }
    setError(typeof result.detail === 'string' ? result.detail : 'Failed to enable Computer Use');
  };

  const handleDisable = async () => {
    if (!assistant) return;
    setIsLoading(true);
    setError(null);
    const result = await disableManagedDesktop(Number(assistant.agentId));
    setIsLoading(false);
    setConfirmDisableOpen(false);
    if (result.assistant) {
      onUpdated();
      onOpenChange(false);
      return;
    }
    setError(typeof result.detail === 'string' ? result.detail : 'Failed to disable Computer Use');
  };

  const handleRotateNetworkIdentity = async () => {
    if (!assistant) return;
    setIsRotatingNetworkIdentity(true);
    setError(null);
    const result = await rotateManagedDesktopNetworkIdentity(assistant.agentId);
    setIsRotatingNetworkIdentity(false);
    setConfirmRotateOpen(false);
    if (result.info) {
      setNetworkIdentity((current) => applyRotation(current, result.info));
    }
    if (result.detail) {
      setError(
        typeof result.detail === 'string' ? result.detail : 'Failed to rotate network identity'
      );
      return;
    }

    const rotation = await getManagedDesktopNetworkIdentityRotation(assistant.agentId);
    if (rotation.info) {
      setNetworkIdentity((current) => applyRotation(current, rotation.info));
    } else if (rotation.detail) {
      setError(
        typeof rotation.detail === 'string'
          ? rotation.detail
          : 'Failed to load network identity rotation status'
      );
    }
  };

  if (!assistant) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Computer Use</DialogTitle>
            <DialogDescription>
              Managed virtual machines for external computer use. Workspace files and browser
              session profile remain archived when disabled and restore on the same OS.
            </DialogDescription>
          </DialogHeader>

          {assistant.managedDesktopStatus === 'grace_period' && (
            <p className="text-body text-warning">
              Computer Use is in a grace period due to insufficient credits. Top up your wallet to
              avoid losing access.
            </p>
          )}

          {isEnabled ? (
            <div className="space-y-3">
              <p className="text-body">
                Active: <strong>{assistant.desktopMode}</strong>
                {monthlyCost != null ? ` — $${monthlyCost}/month` : null}
              </p>

              <div className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-body font-medium">Network identity</p>
                    <p className="text-caption text-muted-foreground">
                      {isNetworkIdentityLoading
                        ? 'Loading network identity…'
                        : (networkIdentity?.address ?? 'No network address available')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      isNetworkIdentityLoading ||
                      isRotatingNetworkIdentity ||
                      rotationActive ||
                      !networkIdentity
                    }
                    onClick={() => setConfirmRotateOpen(true)}
                  >
                    {isRotatingNetworkIdentity || rotationActive ? 'Rotating…' : 'Rotate IP'}
                  </Button>
                </div>
                {networkIdentity && (
                  <dl className="text-caption mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                    <dt>Region</dt>
                    <dd>{formatNetworkRegion(networkIdentity.region)}</dd>
                    <dt>Hostname</dt>
                    <dd>{networkIdentity.hostname ?? '—'}</dd>
                    <dt>Status</dt>
                    <dd>
                      {rotationActive
                        ? `Rotation in progress (${networkIdentity.activeOperation})`
                        : (networkIdentity.state ?? '—')}
                    </dd>
                  </dl>
                )}
              </div>

              <Button
                variant="destructive"
                onClick={() => setConfirmDisableOpen(true)}
                disabled={isLoading}
              >
                Disable Computer Use
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {OS_OPTIONS.map((option) => (
                <BillableActionGuard
                  key={option.mode}
                  creditsRequired={option.monthlyCost}
                  onAddPaymentMethod={onAddPaymentMethod}
                >
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => void handleEnable(option.mode)}
                  >
                    {option.label} — ${option.monthlyCost}/month
                  </Button>
                </BillableActionGuard>
              ))}
            </div>
          )}

          {error && <p className="text-body text-error">{error}</p>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDisableOpen} onOpenChange={setConfirmDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Computer Use?</AlertDialogTitle>
            <AlertDialogDescription>
              The managed VM will be released. Archived files are retained, but the assistant cannot
              use external computer tools until you re-enable the add-on.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDisable()}>Disable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRotateOpen} onOpenChange={setConfirmRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate this IP address?</AlertDialogTitle>
            <AlertDialogDescription>
              Rotating the IP can interrupt active browser sessions. Websites that allowlist the
              current IP may also require their allowlists to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRotatingNetworkIdentity}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRotatingNetworkIdentity}
              onClick={() => void handleRotateNetworkIdentity()}
            >
              {isRotatingNetworkIdentity ? 'Rotating…' : 'Rotate IP'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
