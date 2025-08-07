import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantFormData, AssistantPreset, AssistantActions, AvailableSocialPlatform } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { LayoutList, Loader2, Shuffle, AlertTriangle, Lock, Info, Timer, MessageSquare, PanelLeftOpen, PanelLeftClose } from 'lucide-react'; // Added icons
import { PresetsPanelProps } from '@/components/Pages/Assistants/Assistants/Hire/Presets/AssistantHirePresetsList';
import { HireFormProps } from '@/components/Pages/Assistants/Assistants/Hire/AssistantHireForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/UI/popover";
import { ApprovalStatus } from '@/types/user';
import { ASSISTANT_ONBOARDING_FEE } from '@/constants/assistants/settings';
import { useFormContext, UseFormReturn } from 'react-hook-form';
import { AssistantHireChatPanel } from './AssistantHireChatPanel';

interface AssistantHireProps extends Partial<PresetsPanelProps>, Partial<HireFormProps> {
    isHireDialogOpen: boolean;
    isHireSubmitting: boolean; 
    setIsHireDialogOpen: (value: React.SetStateAction<boolean>) => void;
    isAssistantPresetsOpen: boolean;
    setIsAssistantPresetsOpen: (value: React.SetStateAction<boolean>) => void;
    handleRandomizePreset: () => void;
    currentFilteredPresets: AssistantPreset[];
    onHireAttempt: () => Promise<void>; 
    children: React.ReactNode;
    isProcessingVoice?: boolean;
    isCheckingBalance: boolean; 
    showInsufficientFundsHint: boolean; 
    setShowInsufficientFundsHint: React.Dispatch<React.SetStateAction<boolean>>; 
    userApprovalStatus: ApprovalStatus | 'loading'; 
    isLoadingUserApproval: boolean; 
    onRequestAccess: () => Promise<boolean | void>;
    formMethods: UseFormReturn<AssistantFormData>;
    availableSocialPlatforms: AvailableSocialPlatform[];
    isLoadingSocialPlatforms: boolean;
}

export function AssistantHire ({
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
    isCheckingBalance,
    showInsufficientFundsHint,
    setShowInsufficientFundsHint,
    userApprovalStatus,
    isLoadingUserApproval, 
    onRequestAccess,
    availableSocialPlatforms,
    isLoadingSocialPlatforms,
    formMethods,
}: AssistantHireProps) {
    const [hireForm, presetsPanel] = React.Children.toArray(children);
    const [rightPanelView, setRightPanelView] = React.useState<'presets' | 'chat'>('presets');
    const [isRightPanelExpanded, setIsRightPanelExpanded] = React.useState(false);
    
    // Reset to presets view when dialog is opened/closed
    React.useEffect(() => {
        if (isHireDialogOpen) {
            setRightPanelView('presets');
        }
    }, [isHireDialogOpen]);

    const { watch } = useFormContext<AssistantFormData>();
    const socialAccounts = watch("social_accounts", []) || [];

    const totalOnboardingFee = React.useMemo(() => {
        const socialCosts = socialAccounts
            .filter(acc => acc.isVerified)
            .reduce((sum, acc) => {
                const platformInfo = availableSocialPlatforms.find(p => p.name === acc.platform);
                return sum + (platformInfo?.cost || ASSISTANT_ONBOARDING_FEE); // Fallback cost
            }, 0);
        return ASSISTANT_ONBOARDING_FEE + socialCosts;
    }, [socialAccounts, availableSocialPlatforms]);

    const handleSelectAndSwitch = (preset: AssistantPreset) => {
        // Get the original onPresetSelect function from the PresetsPanel child component's props
        const originalOnPresetSelect = (presetsPanel as React.ReactElement<any>).props.onPresetSelect;
        if (originalOnPresetSelect) {
            originalOnPresetSelect(preset);
        }
        setRightPanelView('chat');
    };

    const handleToggleRightPanel = () => {
        setIsAssistantPresetsOpen(prev => {
            const isClosing = prev;
            if (isClosing && isRightPanelExpanded) {
                setIsRightPanelExpanded(false); 
            }
            return !prev;
        });
    };
    
    const handleToggleExpand = () => setIsRightPanelExpanded(p => !p);

    const isUserApproved = userApprovalStatus === "approved";
    const isPrimaryActionDisabled = isHireSubmitting || !!isProcessingVoice || !isUserApproved || isLoadingUserApproval || isLoadingSocialPlatforms;
    const isOverallDialogBusy = isPrimaryActionDisabled || isCheckingBalance || isLoadingUserApproval || isLoadingSocialPlatforms;


    const handleDialogClose = (open: boolean) => {
        if (!isOverallDialogBusy) {
            setIsHireDialogOpen(open);
            if (!open) {
                setShowInsufficientFundsHint(false);
                setIsRightPanelExpanded(false); 
            }
        }
    };

    const handleDialogInteractOutside = (e: Event) => {
        if (isOverallDialogBusy) {
            e.preventDefault();
        }
        const target = e.target as HTMLElement;
        if (target.closest('[data-radix-popover-content]')) {
             e.preventDefault();
        }
    };
    
    const hireButtonLabel = () => {
        if (isLoadingUserApproval && userApprovalStatus === 'loading') return "Checking Access...";
        if (isLoadingUserApproval) return "Processing..."; 
        if (isCheckingBalance) return "Checking Balance...";
        if (isHireSubmitting) return "Hiring..."; 
        if (isProcessingVoice) return "Processing Voice...";
        if (isLoadingSocialPlatforms) return "Loading data...";
        return "Hire Assistant";
    };

    const renderAccessMessage = () => {
        let message = "";
        let showRequestButton = false;
        let icon = <Info className="h-12 w-12 text-primary mb-4" />;

        if (userApprovalStatus === "pending") {
            message = "We're reviewing your request for assistant hiring and will get back to you soon!";
            icon = <Timer className="h-12 w-12 text-primary mb-4" />;
        } else { // null, "rejected", "revoked"
            message = "Hiring assistants is currently in Beta. Feel free to request access below!";
            icon = <Lock className="h-12 w-12 text-primary mb-4" />;
            showRequestButton = true;
        }

        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-0">
                {icon}
                <h3 className="text-xl font-semibold mb-3">
                    {userApprovalStatus === "pending" ? "Request Pending" : "Access Required"}
                </h3>
                <p className="text-muted-foreground mb-6">{message}</p>
                {showRequestButton && (
                    <Button onClick={onRequestAccess} disabled={isLoadingUserApproval}>
                        {isLoadingUserApproval ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Request Access
                    </Button>
                )}
            </div>
        );
    };


    return (
        <Dialog 
            open={isHireDialogOpen} 
            onOpenChange={handleDialogClose}
        >
            <DialogContent 
                className={cn(
                    "max-w-5xl h-[90vh] flex flex-col p-0 gap-0",
                    isAssistantPresetsOpen && isUserApproved && !isRightPanelExpanded && "max-w-6xl"
                )} 
                onInteractOutside={handleDialogInteractOutside}
                onPointerDownOutside={(e) => { 
                    if (isOverallDialogBusy) e.preventDefault();
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-radix-popover-content]')) {
                         e.preventDefault();
                    }
                }}
            >
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <DialogTitle>Hire Assistant</DialogTitle>
                    <DialogDescription>
                        {isUserApproved ? "Hire an existing assistant or create your own." : "Request access to hire new assistants."}
                    </DialogDescription>
                </DialogHeader>

                {userApprovalStatus === 'loading' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-0">
                        <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
                        <p className="text-muted-foreground">Checking your access status...</p>
                    </div>
                ) : !isUserApproved ? (
                    renderAccessMessage()
                ) : (
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        {/* Form Panel Section */}
                        <AnimatePresence initial={false}>
                            {!isRightPanelExpanded && (
                                <motion.div
                                    key="hire-form-panel"
                                    initial={{ width: "0%", opacity: 0 }}
                                    animate={{ width: isAssistantPresetsOpen ? "60%" : "100%", opacity: 1 }}
                                    exit={{ width: "0%", opacity: 0 }}
                                    transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
                                    className="h-full flex-shrink-0 min-w-0 bg-background relative flex flex-col"
                                >
                                    <div className="flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0">
                                        <h3 className="text-lg font-semibold">Your Assistant</h3>
                                        <div className="flex items-center gap-1">
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleRandomizePreset} disabled={isPrimaryActionDisabled}>
                                                            <Shuffle className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Randomize</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightPanelView(p => p === 'presets' ? 'chat' : 'presets')} disabled={isPrimaryActionDisabled || !isAssistantPresetsOpen}>
                                                            {rightPanelView === 'presets' ? <MessageSquare className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>{rightPanelView === 'presets' ? "Chat with Assistant" : "Show Presets"}</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleToggleRightPanel} disabled={isPrimaryActionDisabled}>
                                                            <PanelLeftOpen className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>{isAssistantPresetsOpen ? "Hide Right Panel" : "Show Right Panel"}</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-hidden">
                                        {hireForm}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Presets/Chat Panel Section */}
                        <AnimatePresence>
                            {isAssistantPresetsOpen && (
                                <motion.div
                                    key="hire-right-panel"
                                    initial={{ width: "0%" }}
                                    animate={{ width: isRightPanelExpanded ? "100%" : "40%" }}
                                    exit={{ width: "0%" }}
                                    transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
                                    className="h-full flex-shrink-0 overflow-hidden bg-background"
                                >
                                    {rightPanelView === 'presets' ? (
                                        React.cloneElement(presetsPanel as React.ReactElement<any>, {
                                            onPresetSelect: handleSelectAndSwitch,
                                            onToggleExpand: handleToggleExpand,
                                            isExpanded: isRightPanelExpanded,
                                            onClose: () => setIsAssistantPresetsOpen(false)
                                        })
                                    ) : (
                                        <AssistantHireChatPanel
                                            onToggleExpand={handleToggleExpand}
                                            isExpanded={isRightPanelExpanded}
                                            onClose={() => setIsAssistantPresetsOpen(false)}
                                        />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                <DialogFooter className="px-6 py-3 border-t flex-shrink-0 flex items-center">
                    <div className="text-sm mr-auto">
                        <span className="text-muted-foreground">Total Onboarding Fee: </span>
                        <span className="font-semibold">{totalOnboardingFee.toFixed(2)} Credits</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Popover
                            modal={true} 
                            open={showInsufficientFundsHint && isUserApproved} 
                            onOpenChange={(isOpenByRadix) => {
                                if (!isOpenByRadix) {
                                    setShowInsufficientFundsHint(false);
                                }
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button 
                                    type="button" 
                                    onClick={onHireAttempt} 
                                    className="bg-green-600 hover:bg-green-700 text-white" 
                                    disabled={isPrimaryActionDisabled}
                                >
                                    {(isLoadingUserApproval || isCheckingBalance || isHireSubmitting || isProcessingVoice || isLoadingSocialPlatforms) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {hireButtonLabel()}
                                </Button>
                            </PopoverTrigger>
                            {isUserApproved && ( 
                                <PopoverContent 
                                    side="top" 
                                    align="end" 
                                    className="w-80"
                                >
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center">
                                                <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
                                                <h3 className="font-medium leading-none text-destructive">Insufficient Funds</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Your required balance is ${totalOnboardingFee.toFixed(2)}. Please recharge your account.
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
                            )}
                        </Popover>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}