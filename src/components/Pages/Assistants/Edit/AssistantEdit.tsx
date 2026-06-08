import * as React from 'react';
import {
  Assistant,
  AssistantFormData,
  AssistantActions,
  AvailableSocialPlatform,
} from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/UI/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/alert-dialog';
import { Button } from '@/components/UI/button';
import { Loader2, X, Trash2, AlertTriangle } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { assistantDisplayName } from '@/lib/assistants/displayName';

interface AssistantEditProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  formMethods: UseFormReturn<AssistantFormData>;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  children: React.ReactNode;
  isProcessingPhoto?: boolean;
  isProcessingVoice?: boolean;
  /** Callback to open the Stripe side panel for payment setup */
  onAddPaymentMethod?: () => void;
  /** When true the Stripe side-panel is open — focus-trap bypass and
   *  outside-interaction handling are adjusted so the user can interact
   *  with the Stripe Embedded Checkout (e.g. the quantity editor). */
  isStripePanelOpen?: boolean;
  /** Handler to delete/end-contract for the assistant */
  onDeleteAssistant?: (assistant: Assistant) => Promise<void>;
  /** Whether the user has permission to delete */
  canDelete?: boolean;
}

export function AssistantEdit({
  isOpen,
  onClose,
  assistant,
  formMethods,
  onSubmit,
  isSubmitting,
  children,
  isProcessingPhoto,
  isProcessingVoice,
  onAddPaymentMethod,
  isStripePanelOpen = false,
  onDeleteAssistant,
  canDelete = false,
}: AssistantEditProps) {
  const [isCloseTooltipOpen, setIsCloseTooltipOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const isPrimaryActionDisabled = isSubmitting || !!isProcessingVoice || !!isProcessingPhoto;

  const handleDeleteConfirm = async () => {
    if (!assistant || isDeleting || !onDeleteAssistant) return;
    setIsDeleting(true);
    try {
      await onDeleteAssistant(assistant);
      setIsDeleteAlertOpen(false);
      onClose();
    } catch (error) {
      console.error('Error during delete:', error);
      setIsDeleteAlertOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Bypass Dialog focus-trap for the Stripe side-panel ──────────────────
  // Radix Dialog's FocusScope traps focus inside the dialog. When the Stripe
  // side-panel (Sheet) is open, this prevents interaction with inputs inside
  // the Stripe Embedded Checkout iframe (e.g. the quantity editor).
  // We add capturing-phase listeners that stop propagation for focus events
  // targeting the Stripe panel, so the FocusScope never sees them.
  React.useEffect(() => {
    if (!isStripePanelOpen || !isOpen) return;

    const stopIfStripePanel = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-testid="stripe-side-panel"]') || target?.tagName === 'IFRAME') {
        e.stopPropagation();
      }
    };

    document.addEventListener('focusin', stopIfStripePanel, true);
    document.addEventListener('focusout', stopIfStripePanel, true);
    return () => {
      document.removeEventListener('focusin', stopIfStripePanel, true);
      document.removeEventListener('focusout', stopIfStripePanel, true);
    };
  }, [isStripePanelOpen, isOpen]);

  const handleDialogClose = (open: boolean) => {
    if (!isPrimaryActionDisabled) {
      if (!open) {
        onClose();
      }
    }
  };

  const handleDialogInteractOutside = (e: Event) => {
    const target = e.target as HTMLElement;

    // Allow interaction with the Stripe side-panel (Sheet) when it's open
    if (isStripePanelOpen && target.closest('[data-testid="stripe-side-panel"]')) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    if (!isPrimaryActionDisabled) {
      setIsCloseTooltipOpen(true);
      // Auto-hide tooltip after a short delay
      setTimeout(() => setIsCloseTooltipOpen(false), 2500);
    }
  };

  const submitButtonLabel = () => {
    if (isSubmitting) return 'Updating...';
    if (isProcessingVoice) return 'Processing Voice...';
    if (isProcessingPhoto) return 'Processing Photo...';
    return 'Update Martian';
  };

  const displayName = assistantDisplayName(assistant);

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent
        className="flex h-[90vh] max-w-5xl flex-col gap-0 p-0"
        onInteractOutside={handleDialogInteractOutside}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          // Allow pointer events on the Stripe side-panel
          if (isStripePanelOpen && target.closest('[data-testid="stripe-side-panel"]')) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
        }}
        hideClose
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-title">Edit {displayName}</DialogTitle>
            </div>
            <TooltipProvider delayDuration={100}>
              <Tooltip open={isCloseTooltipOpen} onOpenChange={setIsCloseTooltipOpen}>
                <TooltipTrigger asChild>
                  <Button
                    variant="warning"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={onClose}
                    disabled={isPrimaryActionDisabled}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close Edit Dialog</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  <p>Click here to close and discard changes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

        <DialogFooter className="flex flex-shrink-0 items-center border-t px-6 py-3">
          <div className="flex w-full items-center justify-between">
            <div>
              {canDelete && onDeleteAssistant && (
                <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isPrimaryActionDisabled || isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      End contract
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center">
                        <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
                        Confirm End Contract
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        You are about to remove <strong>{displayName}</strong> from your team. This
                        action cannot be undone. Are you sure?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        className={cn(
                          'hover:bg-destructive/90 bg-destructive',
                          isDeleting && 'cursor-not-allowed opacity-70'
                        )}
                      >
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Proceed
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isPrimaryActionDisabled || isDeleting}
            >
              {isPrimaryActionDisabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitButtonLabel()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
