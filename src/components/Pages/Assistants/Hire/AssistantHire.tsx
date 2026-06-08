import * as React from 'react';
import { motion } from 'framer-motion';
import { AssistantFormData, AssistantPreset } from '@/types/assistants/assistant';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Loader2, X } from 'lucide-react';
import { PresetsPanelProps } from '@/components/Pages/Assistants/Hire/Presets/AssistantHirePresetsList';
import { HireFormProps } from '@/components/Pages/Assistants/Hire/AssistantHireForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { UseFormReturn } from 'react-hook-form';
import { ChatMessage } from '@/types/assistants/chat';

interface AssistantHireProps extends Partial<PresetsPanelProps>, Partial<HireFormProps> {
  isHireDialogOpen: boolean;
  isHireSubmitting: boolean;
  setIsHireDialogOpen: (value: React.SetStateAction<boolean>) => void;
  isAssistantPresetsOpen: boolean;
  setIsAssistantPresetsOpen: (value: React.SetStateAction<boolean>) => void;
  currentFilteredPresets: AssistantPreset[];
  onHireAttempt: (chatHistory?: ChatMessage[]) => Promise<void>;
  children: React.ReactNode;
  isProcessingVoice?: boolean;
  isProcessingPhoto?: boolean;
  isCheckingBalance: boolean;
  showInsufficientFundsHint: boolean;
  setShowInsufficientFundsHint: React.Dispatch<React.SetStateAction<boolean>>;
  onAddPaymentMethod?: () => void;
  formMethods: UseFormReturn<AssistantFormData>;
  /** When true the Stripe side-panel is open — focus-trap bypass and
   *  outside-interaction handling are adjusted so the user can interact
   *  with the Stripe Embedded Checkout (e.g. the quantity editor). */
  isStripePanelOpen?: boolean;
}

export function AssistantHire({
  isHireDialogOpen,
  isHireSubmitting,
  setIsHireDialogOpen,
  onHireAttempt,
  children,
  isProcessingVoice,
  isProcessingPhoto,
  isStripePanelOpen = false,
}: AssistantHireProps) {
  const [hireForm] = React.Children.toArray(children);
  const [isCloseTooltipOpen, setIsCloseTooltipOpen] = React.useState(false);

  // ── Bypass Dialog focus-trap for the Stripe side-panel ──────────────────
  // Radix Dialog's FocusScope listens for focusin/focusout on `document`
  // (bubbling phase) and redirects focus back inside the dialog when it
  // leaves. When the Stripe side-panel (a separate Sheet/Dialog) is open,
  // this trapping prevents the user from interacting with inputs inside
  // the Stripe Embedded Checkout iframe (e.g. the quantity editor).
  //
  // We add a *capturing-phase* listener that stops propagation for focus
  // events whose target is inside the Stripe panel. Because capturing
  // fires before bubbling, this prevents the FocusScope handler from ever
  // seeing those events, so focus stays wherever the user put it.
  React.useEffect(() => {
    if (!isStripePanelOpen || !isHireDialogOpen) return;

    const stripePanelSelector = '[data-testid="stripe-side-panel"]';

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(stripePanelSelector)) {
        e.stopImmediatePropagation();
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      // If focus is moving TO the Stripe panel, suppress so the dialog
      // FocusScope doesn't pull it back.
      if (related?.closest(stripePanelSelector)) {
        e.stopImmediatePropagation();
      }
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
    };
  }, [isStripePanelOpen, isHireDialogOpen]);

  const isPrimaryActionDisabled = isHireSubmitting || !!isProcessingVoice || !!isProcessingPhoto;
  const isOverallDialogBusy = isPrimaryActionDisabled;

  const handleDialogClose = (open: boolean) => {
    if (!isOverallDialogBusy) {
      setIsHireDialogOpen(open);
    }
  };

  const handleDialogInteractOutside = (e: Event) => {
    const target = e.target as HTMLElement;
    // Allow interaction with popovers (e.g., Select, Dropdown) inside the dialog
    if (target.closest('[data-radix-popover-content]')) {
      return;
    }

    // Allow interaction with the Stripe side-panel (Sheet) when it's open
    if (isStripePanelOpen && target.closest('[data-testid="stripe-side-panel"]')) {
      return;
    }

    // For any other click outside, prevent closing
    e.preventDefault();

    // Show tooltip only if dialog is not busy and the Stripe panel isn't open
    if (!isOverallDialogBusy && !isStripePanelOpen) {
      setIsCloseTooltipOpen(true);
    }
  };

  const hireButtonLabel = () => {
    if (isHireSubmitting) return 'Onboarding Martian...';
    if (isProcessingVoice) return 'Processing Voice...';
    if (isProcessingPhoto) return 'Processing Photo...';
    return 'Onboard Martian';
  };

  return (
    <Dialog open={isHireDialogOpen} onOpenChange={handleDialogClose}>
      <DialogContent
        className="flex h-[90vh] max-w-5xl flex-col gap-0 p-0"
        onInteractOutside={handleDialogInteractOutside}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          // Prevent closing when clicking on popover content
          if (target.closest('[data-radix-popover-content]')) {
            e.preventDefault();
            return;
          }
          // Allow pointer events on the Stripe side-panel
          if (isStripePanelOpen && target.closest('[data-testid="stripe-side-panel"]')) {
            e.preventDefault();
            return;
          }
          // Prevent closing for any other outside pointer down event
          e.preventDefault();
        }}
        hideClose
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <DialogTitle className="text-h3">Onboard Martian</DialogTitle>
            </div>
            <TooltipProvider delayDuration={100}>
              <Tooltip open={isCloseTooltipOpen} onOpenChange={setIsCloseTooltipOpen}>
                <TooltipTrigger asChild>
                  <Button
                    variant="warning"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => handleDialogClose(false)}
                    disabled={isOverallDialogBusy}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close onboard dialog</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  <p>Click here to close and reset your changes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Form Panel Section */}
          <motion.div
            key="hire-form-panel"
            initial={false}
            animate={{ width: '100%' }}
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.2 }}
            className="relative flex h-full min-w-0 flex-shrink-0 flex-col overflow-hidden bg-background"
          >
            <div className="min-h-0 flex-1 overflow-hidden">{hireForm}</div>
          </motion.div>
        </div>

        <DialogFooter className="flex flex-shrink-0 items-center border-t px-6 py-3">
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => onHireAttempt()}
              className="h-8"
              disabled={isPrimaryActionDisabled}
            >
              {(isHireSubmitting || isProcessingVoice || isProcessingPhoto) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {hireButtonLabel()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
