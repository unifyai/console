import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantFormData, AssistantPreset, AssistantActions, AvailableSocialPlatform } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { Loader2, Shuffle, AlertTriangle, Lock, Info, Timer, PanelRightClose, PanelRightOpen, Maximize2, Minimize2, Minus, X, MessageSquare } from 'lucide-react';
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
    isProcessingPhoto,
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
    const socialAccounts = watch("social_accounts", []) || [];
    const watchedConfigFields = watch(["first_name", "surname", "age", "region", "about"]);

    const assistantConfigKey = React.useMemo(() => {
        const [first_name, surname, age, region, about] = watchedConfigFields;
        // Simple serialization of the core assistant properties to create a unique key
        return `${first_name || ''}-${surname || ''}-${age || 'N/A'}-${region || ''}-${about || ''}`;
    }, [watchedConfigFields]);

    const totalOnboardingFee = React.useMemo(() => {
        const socialCosts = socialAccounts
            .filter(acc => acc.isVerified)
            .reduce((sum, acc) => {
                const platformInfo = availableSocialPlatforms.find(p => p.name === acc.platform);
                return sum + (platformInfo?.cost || ASSISTANT_ONBOARDING_FEE); // Fallback cost
            }, 0);
        return ASSISTANT_ONBOARDING_FEE + socialCosts;
    }, [socialAccounts, availableSocialPlatforms]);

    const handlePresetSelect = (preset: AssistantPreset) => {
        const originalOnPresetSelect = (presetsPanel as React.ReactElement<any>).props.onPresetSelect;
        if (originalOnPresetSelect) {
            originalOnPresetSelect(preset);
        }
    };

    const handleToggleRightPanel = () => {
        setIsAssistantPresetsOpen(prev => {
            const isClosing = prev;
            if (isClosing && layoutMode === 'right') {
                setLayoutMode('split'); 
            }
            return !prev;
        });
    };
    const handleToggleView = () => setRightPanelView(p => p === 'presets' ? 'chat' : 'presets');

    const isUserApproved = userApprovalStatus === "approved";
    const isPrimaryActionDisabled = isHireSubmitting || !!isProcessingVoice || !!isProcessingPhoto || !isUserApproved || isLoadingUserApproval || isLoadingSocialPlatforms;
    const isOverallDialogBusy = isPrimaryActionDisabled || isCheckingBalance || isLoadingUserApproval || isLoadingSocialPlatforms ; 

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

        // For any other click outside, prevent closing
        e.preventDefault();

        // Show tooltip only if dialog is not busy
        if (!isOverallDialogBusy) {
            setIsCloseTooltipOpen(true);
        }
    };
    
    const hireButtonLabel = () => {
        if (isLoadingUserApproval && userApprovalStatus === 'loading') return "Checking Access...";
        if (isLoadingUserApproval) return "Processing..."; 
        if (isCheckingBalance) return "Checking Balance...";
        if (isHireSubmitting) return "Hiring..."; 
        if (isProcessingVoice) return "Processing Voice...";
        if (isProcessingPhoto) return "Processing Photo...";
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
                    isAssistantPresetsOpen && isUserApproved && layoutMode === 'split' && "max-w-6xl"
                )} 
                onInteractOutside={handleDialogInteractOutside}
                onPointerDownOutside={(e) => { 
                    const target = e.target as HTMLElement;
                    // Prevent closing when clicking on popover content
                    if (target.closest('[data-radix-popover-content]')) {
                        e.preventDefault();
                        return;
                    }
                    // Prevent closing for any other outside pointer down event
                    e.preventDefault();
                }}
                hideClose
            >
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <div className='flex items-start justify-between'>
                        <div className="flex flex-col gap-2">
                            <DialogTitle>Hire Assistant</DialogTitle>
                            <DialogDescription>
                                {isUserApproved ? "Hire an existing assistant or create your own." : "Request access to hire new assistants."}
                            </DialogDescription>
                        </div>
                         <TooltipProvider delayDuration={100}>
                            <Tooltip open={isCloseTooltipOpen} onOpenChange={setIsCloseTooltipOpen}>
                                <TooltipTrigger asChild>
                                     <Button variant="warning" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleDialogClose(false)} disabled={isOverallDialogBusy}>
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
                        <motion.div
                            key="hire-form-panel"
                            initial={false}
                            animate={{ width: !isAssistantPresetsOpen ? "100%" : layoutMode === 'left' ? "100%" : layoutMode === 'right' ? "0%" : "60%" }}
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
                            className="h-full flex-shrink-0 min-w-0 bg-background relative flex flex-col overflow-hidden"
                        >
                            <div className={cn("flex flex-col h-full w-full", layoutMode === 'right' && "invisible")}>
                                <div className="flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0">
                                    <h3 className="text-lg font-semibold">Your Assistant</h3>
                                    <div className="flex items-center gap-1">
                                        {layoutMode === "split" && 
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon" className="h-7 w-7" onClick={() => setLayoutMode('right')}
                                                            disabled={!isAssistantPresetsOpen}
                                                        >
                                                            <Minus className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Minimize panel</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        }
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
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLayoutMode(layoutMode === 'left' ? 'split' : 'left')} disabled={!isAssistantPresetsOpen}>
                                                        {layoutMode === 'left' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                                     </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>{layoutMode === 'left' ? 'Shrink panel' : 'Maximize panel'}</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    {hireForm}
                                </div>
                            </div>
                        </motion.div>

                        {/* Presets/Chat Panel Section */}
                        <AnimatePresence>
                            {isAssistantPresetsOpen && (
                                <motion.div
                                    key="hire-right-panel"
                                    initial={{ width: "0%" }}
                                    animate={{ width: layoutMode === 'left' ? "0%" : layoutMode === 'right' ? "100%" : "40%" }}
                                    exit={{ width: "0%" }}
                                    transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
                                    className="h-full flex-shrink-0 overflow-hidden bg-background"
                                >
                                    <div className={cn("h-full w-full", layoutMode === 'left' && 'invisible')}>
                                        {rightPanelView === 'presets' ? (
                                            React.cloneElement(presetsPanel as React.ReactElement<any>, {
                                                onPresetSelect: handlePresetSelect,
                                                layoutMode: layoutMode,
                                                setLayoutMode: setLayoutMode,
                                                onClose: () => setIsAssistantPresetsOpen(false),
                                                onToggleView: handleToggleView,
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
                )}

                <DialogFooter className="px-6 py-3 border-t flex-shrink-0 flex items-center">
                    <div className="text-sm mr-auto">
                        <span className="text-muted-foreground">Total Onboarding Fee: </span>
                        <span className="font-semibold">{totalOnboardingFee.toFixed(2)} Credits</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isUserApproved &&
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsAssistantPresetsOpen(true);
                                    setRightPanelView('chat');
                                }}
                                disabled={isAssistantPresetsOpen && rightPanelView === 'chat'}
                            >
                                <MessageSquare className="h-4 w-4" />
                                Chat Now
                            </Button>
                        }
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
                                    onClick={() => onHireAttempt(chatHistories[assistantConfigKey])} 
                                    className="bg-green-600 hover:bg-green-700 text-white" 
                                    disabled={isPrimaryActionDisabled}
                                >
                                    {(isLoadingUserApproval || isCheckingBalance || isHireSubmitting || isProcessingVoice || isProcessingPhoto || isLoadingSocialPlatforms) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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