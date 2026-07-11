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
  getManagedDesktopStatus,
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
  const [error, setError] = React.useState<string | null>(null);

  const isEnabled =
    assistant?.managedDesktopStatus === 'active' ||
    assistant?.managedDesktopStatus === 'grace_period';

  React.useEffect(() => {
    if (!open || !assistant) return;
    void (async () => {
      const result = await getManagedDesktopStatus(assistant.agentId);
      if (result.info?.monthlyCost != null) {
        setMonthlyCost(result.info.monthlyCost);
      }
    })();
  }, [assistant, open]);

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
                  tooltipMessage={`Enabling ${option.label} deducts $${option.monthlyCost} credits for the first month.`}
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
    </>
  );
}
