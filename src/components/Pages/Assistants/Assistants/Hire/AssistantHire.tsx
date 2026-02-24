import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantFormData, AssistantPreset } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import {
  Loader2,
  Shuffle,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Minus,
  X,
  LayoutList,
  MessageSquare,
} from 'lucide-react';
import { PresetsPanelProps } from '@/components/Pages/Assistants/Assistants/Hire/Presets/AssistantHirePresetsList';
import { HireFormProps } from '@/components/Pages/Assistants/Assistants/Hire/AssistantHireForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import {
  ASSISTANT_ONBOARDING_FEE,
  PRE_HIRE_CHAT_MESSAGE_COST,
} from '@/constants/assistants/settings';
import { useFormContext, UseFormReturn } from 'react-hook-form';
import { AssistantHireChatPanel } from './AssistantHireChatPanel';
import { ChatMessage } from '@/types/assistants/chat';

interface AssistantHireProps extends Partial<PresetsPanelProps>, Partial<HireFormProps> {
  isHireDialogOpen: boolean;
  isHireSubmitting: boolean;
  setIsHireDialogOpen: (value: React.SetStateAction<boolean>) => void;
  isAssistantPresetsOpen: boolean;
  setIsAssistantPresetsOpen: (value: React.SetStateAction<boolean>) => void;
  handleRandomizePreset: () => void;
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
  isFastMode: boolean;
  /** When true the Stripe side-panel is open — focus-trap bypass and
   *  outside-interaction handling are adjusted so the user can interact
   *  with the Stripe Embedded Checkout (e.g. the quantity editor). */
  isStripePanelOpen?: boolean;
}

export function AssistantHire({
  isHireDialogOpen,
  isHireSubmitting,
  setIsHireDialogOpen,
  isAssistantPresetsOpen,
  setIsAssistantPresetsOpen,
  handleRandomizePreset,
  currentFilteredPresets,
  onHireAttempt,
  children,
  isProcessingVoice,
  isProcessingPhoto,
  isCheckingBalance,
  showInsufficientFundsHint,
  setShowInsufficientFundsHint,
  onAddPaymentMethod,
  formMethods,
  isFastMode,
  isStripePanelOpen = false,
}: AssistantHireProps) {
  const [hireForm, presetsPanel] = React.Children.toArray(children);
  const [rightPanelView, setRightPanelView] = React.useState<'presets' | 'chat'>('presets');
  const [layoutMode, setLayoutMode] = React.useState<'split' | 'left' | 'right'>('split');
  const [chatHistories, setChatHistories] = React.useState<Record<string, ChatMessage[]>>({});
  const [isCloseTooltipOpen, setIsCloseTooltipOpen] = React.useState(false);

  // Reset to presets view when dialog is opened/closed
  React.useEffect(() => {
    if (isHireDialogOpen) {
      setRightPanelView('presets');
      setLayoutMode('split');
    } else {
      // Clear chat histories when dialog is fully closed to ensure fresh state next time
      setChatHistories({});
    }
  }, [isHireDialogOpen]);

  const { watch, getValues } = useFormContext<AssistantFormData>();
  const watchedConfigFields = watch(['firstName', 'surname', 'age', 'nationality', 'about']);

  const assistantConfigKey = React.useMemo(() => {
    const [firstName, surname, age, nationality, about] = watchedConfigFields;
    // Simple serialization of the core assistant properties to create a unique key
    return `${firstName || ''}-${surname || ''}-${age || 'N/A'}-${nationality || ''}-${about || ''}`;
  }, [watchedConfigFields]);

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

  const totalOnboardingFee = ASSISTANT_ONBOARDING_FEE;

  const handlePresetSelect = (preset: AssistantPreset) => {
    if (isHireSubmitting || isCheckingBalance) return;
    const originalOnPresetSelect = (presetsPanel as React.ReactElement<any>).props.onPresetSelect;
    if (originalOnPresetSelect) {
      originalOnPresetSelect(preset);
    }
  };

  const handleToggleView = () => setRightPanelView((p) => (p === 'presets' ? 'chat' : 'presets'));

  const isPrimaryActionDisabled = isHireSubmitting || !!isProcessingVoice || !!isProcessingPhoto;
  const isOverallDialogBusy = isPrimaryActionDisabled || isCheckingBalance;

  const handleDialogClose = (open: boolean) => {
    if (!isOverallDialogBusy) {
      setIsHireDialogOpen(open);
      if (!open) {
        setShowInsufficientFundsHint(false);
        setLayoutMode('split');
      }
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
    if (isCheckingBalance) return 'Checking Balance...';
    if (isHireSubmitting) return 'Hiring Assistant...';
    if (isProcessingVoice) return 'Processing Voice...';
    if (isProcessingPhoto) return 'Processing Photo...';
    return 'Hire Assistant';
  };

  return (
    <Dialog open={isHireDialogOpen} onOpenChange={handleDialogClose}>
      <DialogContent
        className={cn(
          'flex h-[90vh] max-w-5xl flex-col gap-0 p-0',
          isAssistantPresetsOpen && layoutMode === 'split' && 'max-w-6xl'
        )}
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
              <DialogTitle className="text-h3">Hire Assistant</DialogTitle>
              <DialogDescription className="text-subtitle">
                Hire an existing assistant or create your own.
              </DialogDescription>
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
                    <span className="sr-only">Close Hire Dialog</span>
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
            animate={{
              width: !isAssistantPresetsOpen
                ? '100%'
                : layoutMode === 'left'
                  ? '100%'
                  : layoutMode === 'right'
                    ? '0%'
                    : '60%',
            }}
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.2 }}
            className="relative flex h-full min-w-0 flex-shrink-0 flex-col overflow-hidden bg-background"
          >
            <div
              className={cn('flex h-full w-full flex-col', layoutMode === 'right' && 'invisible')}
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b px-6 py-3.5">
                <h3 className="text-title">Your Assistant</h3>
                <div className="flex items-center gap-1">
                  {layoutMode === 'split' && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setLayoutMode('right')}
                            disabled={!isAssistantPresetsOpen}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Minimize panel</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label="Randomize Assistant"
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleRandomizePreset}
                          disabled={isOverallDialogBusy}
                        >
                          <Shuffle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Randomize</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setLayoutMode(layoutMode === 'left' ? 'split' : 'left')}
                          disabled={!isAssistantPresetsOpen}
                        >
                          {layoutMode === 'left' ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{layoutMode === 'left' ? 'Shrink panel' : 'Maximize panel'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{hireForm}</div>
            </div>
          </motion.div>

          {/* Presets/Chat Panel Section */}
          <AnimatePresence>
            {isAssistantPresetsOpen && (
              <motion.div
                key="hire-right-panel"
                initial={{ width: '0%' }}
                animate={{
                  width: layoutMode === 'left' ? '0%' : layoutMode === 'right' ? '100%' : '40%',
                }}
                exit={{ width: '0%' }}
                transition={{ type: 'tween', ease: 'easeInOut', duration: 0.2 }}
                className="h-full flex-shrink-0 overflow-hidden bg-background"
              >
                <div className={cn('h-full w-full', layoutMode === 'left' && 'invisible')}>
                  {rightPanelView === 'presets' ? (
                    React.cloneElement(presetsPanel as React.ReactElement<any>, {
                      onPresetSelect: handlePresetSelect,
                      layoutMode: layoutMode,
                      setLayoutMode: setLayoutMode,
                      onClose: () => setIsAssistantPresetsOpen(false),
                      onToggleView: handleToggleView,
                      isFastMode: isFastMode,
                      onAddPaymentMethod: onAddPaymentMethod,
                    })
                  ) : (
                    <AssistantHireChatPanel
                      layoutMode={layoutMode}
                      setLayoutMode={setLayoutMode}
                      onClose={() => setIsAssistantPresetsOpen(false)}
                      assistantConfigKey={assistantConfigKey}
                      chatHistories={chatHistories}
                      setChatHistories={setChatHistories}
                      onToggleView={handleToggleView}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="flex flex-shrink-0 items-center border-t px-6 py-3">
          <div className="text-body mr-auto">
            <span className="text-muted-foreground">Total Onboarding Fee: </span>
            <span className="text-strong">{totalOnboardingFee.toFixed(2)} Credits</span>
          </div>
          <div className="flex items-center gap-2">
            {rightPanelView === 'presets' ? (
              <BillableActionGuard
                onAddPaymentMethod={onAddPaymentMethod}
                creditsRequired={PRE_HIRE_CHAT_MESSAGE_COST}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setIsAssistantPresetsOpen(true);
                    setLayoutMode('split');
                    setRightPanelView('chat');
                  }}
                >
                  <div className="flex flex-row items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    Chat Now
                  </div>
                </Button>
              </BillableActionGuard>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-8"
                onClick={() => {
                  setIsAssistantPresetsOpen(true);
                  setLayoutMode('split');
                  setRightPanelView('presets');
                }}
              >
                <div className="flex flex-row items-center gap-1">
                  <LayoutList className="h-4 w-4" />
                  Browse Assistants
                </div>
              </Button>
            )}
            <Popover
              modal={true}
              open={showInsufficientFundsHint}
              onOpenChange={(isOpenByRadix) => {
                if (!isOpenByRadix) {
                  setShowInsufficientFundsHint(false);
                }
              }}
            >
              <PopoverTrigger asChild>
                <BillableActionGuard
                  onAddPaymentMethod={onAddPaymentMethod}
                  creditsRequired={ASSISTANT_ONBOARDING_FEE}
                >
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => onHireAttempt(chatHistories[assistantConfigKey])}
                    className="h-8"
                    disabled={isPrimaryActionDisabled}
                  >
                    {(isCheckingBalance ||
                      isHireSubmitting ||
                      isProcessingVoice ||
                      isProcessingPhoto) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {hireButtonLabel()}
                  </Button>
                </BillableActionGuard>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
                      <h3 className="text-title text-destructive">Insufficient Funds</h3>
                    </div>
                    <p className="text-body text-muted-foreground">
                      Your required balance is ${totalOnboardingFee.toFixed(2)}. Please recharge
                      your account.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open('/billing', '_blank');
                      setShowInsufficientFundsHint(false);
                    }}
                  >
                    Go to Billing
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
