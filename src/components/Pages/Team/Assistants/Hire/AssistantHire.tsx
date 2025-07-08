import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantFormData, AssistantPreset, AssistantActions, AvailableSocialPlatform } from '@/types/team/assistant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { LayoutList, Loader2, Shuffle, AlertTriangle, Lock, Info, Timer } from 'lucide-react'; // Added Info
import { PresetsPanelProps } from '@/components/Pages/Team/Assistants/Hire/Presets/AssistantHirePresetsList';
import { HireFormProps } from '@/components/Pages/Team/Assistants/Hire/AssistantHireForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/UI/popover";
import { ApprovalStatus } from '@/types/user';
import { ASSISTANT_ONBOARDING_FEE } from '@/constants/assistants/settings';
import { useFormContext, UseFormReturn } from 'react-hook-form';

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

    const isUserApproved = userApprovalStatus === "approved";
    const isPrimaryActionDisabled = isHireSubmitting || !!isProcessingVoice || !isUserApproved || isLoadingUserApproval || isLoadingSocialPlatforms;
    const isOverallDialogBusy = isPrimaryActionDisabled || isCheckingBalance || isLoadingUserApproval || isLoadingSocialPlatforms;


    const handleDialogClose = (open: boolean) => {
        if (!isOverallDialogBusy) {
            setIsHireDialogOpen(open);
            if (!open) {
                setShowInsufficientFundsHint(false); 
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
                    isAssistantPresetsOpen && isUserApproved && "max-w-6xl"
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
                        {/* Hire Form Section */}
                        <div className={cn(
                            "flex-1 h-full min-w-0 relative transition-all duration-300 ease-in-out", 
                            "pl-6 pr-14 py-4 overflow-y-auto"
                        )}>
                            <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip><TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setIsAssistantPresetsOpen(prev => !prev)} disabled={isOverallDialogBusy}>
                                            <LayoutList className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{isAssistantPresetsOpen ? "Hide Presets" : "Show Presets"}</p></TooltipContent></Tooltip>
                                </TooltipProvider>
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip><TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="w-8 h-8" onClick={handleRandomizePreset} disabled={isOverallDialogBusy || currentFilteredPresets.length === 0}>
                                            <Shuffle className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{"Randomize from Presets"}</p></TooltipContent></Tooltip>
                                </TooltipProvider>
                            </div>
                            {hireForm}
                        </div>

                        {/* Presets Panel Section */}
                        {isAssistantPresetsOpen && (
                            <motion.div
                                key="hire-presets-panel"
                                initial={{ width: "0%", opacity: 0 }}
                                animate={{ width: "40%", opacity: 1 }}
                                exit={{ width: "0%", opacity: 0 }}
                                transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
                                className="h-full flex-shrink-0 overflow-hidden bg-background"
                            >
                                {presetsPanel}
                            </motion.div>
                        )}
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