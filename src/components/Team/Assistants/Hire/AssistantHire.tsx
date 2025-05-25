import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AssistantFormData, AssistantPreset, AssistantActions } from '@/types/team/assistant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { LayoutList, Loader2, Shuffle, AlertTriangle } from 'lucide-react';
import { PresetsPanelProps } from '@/components/Team/Assistants/Hire/Presets/AssistantHirePresetsList';
import { HireFormProps } from '@/components/Team/Assistants/Hire/AssistantHireForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/UI/popover";

const ASSISTANT_ONBOARDING_FEE = 10;

interface AssistantHireProps extends Partial<PresetsPanelProps>, Partial<HireFormProps> {
    isHireDialogOpen: boolean;
    isHireSubmitting: boolean; // Actual form data submission state
    setIsHireDialogOpen: (value: React.SetStateAction<boolean>) => void;
    isAssistantPresetsOpen: boolean;
    setIsAssistantPresetsOpen: (value: React.SetStateAction<boolean>) => void;
    handleRandomizePreset: () => void;
    currentFilteredPresets: AssistantPreset[];
    onHireAttempt: () => Promise<void>; // The function from useAssistantHireForm that starts the whole sequence
    children: React.ReactNode;
    isProcessingVoice?: boolean;
    isCheckingBalance: boolean; // From useAssistantHireForm
    showInsufficientFundsHint: boolean; // From useAssistantHireForm
    setShowInsufficientFundsHint: React.Dispatch<React.SetStateAction<boolean>>; // From useAssistantHireForm
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
}: AssistantHireProps) {
    const [hireForm, presetsPanel] = React.Children.toArray(children);

    const isButtonDisabledForPrimaryActions = isHireSubmitting || !!isProcessingVoice;
    const isDialogOverallBusy = isButtonDisabledForPrimaryActions || isCheckingBalance;


    const handleDialogClose = (open: boolean) => {
        if (!isDialogOverallBusy) {
            setIsHireDialogOpen(open);
            if (!open) {
                setShowInsufficientFundsHint(false); 
            }
        }
    };

    const handleDialogInteractOutside = (e: Event) => {
        if (isDialogOverallBusy) {
            e.preventDefault();
        }
        // Allow interaction with Popover content without closing the Dialog
        const target = e.target as HTMLElement;
        if (target.closest('[data-radix-popover-content]')) {
             e.preventDefault();
        }
    };
    
    const hireButtonLabel = () => {
        if (isCheckingBalance) return "Checking Balance...";
        if (isHireSubmitting) return "Hiring..."; 
        if (isProcessingVoice) return "Processing Voice...";
        return "Hire Assistant";
    };

    return (
        <Dialog 
            open={isHireDialogOpen} 
            onOpenChange={handleDialogClose}
        >
            <DialogContent 
                className={cn("max-w-4xl h-[85vh] flex flex-col p-0 gap-0", isAssistantPresetsOpen && "max-w-6xl")} 
                onInteractOutside={handleDialogInteractOutside} // Handles clicks outside Dialog, but potentially on Popover
                onPointerDownOutside={(e) => { // Radix specific for pointer down outside
                    if (isDialogOverallBusy) e.preventDefault();
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-radix-popover-content]')) {
                         e.preventDefault();
                    }
                }}
            >
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <DialogTitle>Hire Assistant</DialogTitle>
                    <DialogDescription>Hire an existing assistant or create your own.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Hire Form Section */}
                    <div className={cn("flex-1 h-full min-w-0 relative transition-all duration-300 ease-in-out", "pl-6 pr-14 py-4 overflow-y-auto")}>
                        <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
                            <TooltipProvider delayDuration={100}>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setIsAssistantPresetsOpen(prev => !prev)} disabled={isDialogOverallBusy}>
                                        <LayoutList className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{isAssistantPresetsOpen ? "Hide Presets" : "Show Presets"}</p></TooltipContent></Tooltip>
                            </TooltipProvider>
                            <TooltipProvider delayDuration={100}>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="w-8 h-8" onClick={handleRandomizePreset} disabled={isDialogOverallBusy || currentFilteredPresets.length === 0}>
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

                <DialogFooter className="px-6 py-3 border-t flex-shrink-0">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isDialogOverallBusy}>Cancel</Button>
                    </DialogClose>
                    <Popover
                        modal={true} // Make the Popover modal
                        open={showInsufficientFundsHint}
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
                                disabled={isButtonDisabledForPrimaryActions} 
                            >
                                {(isCheckingBalance || isHireSubmitting || isProcessingVoice) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {hireButtonLabel()}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                            side="top" 
                            align="end" 
                            className="w-80"
                            // When Popover is modal, direct interaction prevention on itself might not be needed
                            // as Radix should handle it. Let's test without them first.
                        >
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center">
                                        <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
                                        <h3 className="font-medium leading-none text-destructive">Insufficient Funds</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Assistants have a ${ASSISTANT_ONBOARDING_FEE} onboarding fee. Please recharge your account.
                                    </p>
                                </div>
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="w-full"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Still good practice
                                        window.open('/billing', '_blank');
                                        setShowInsufficientFundsHint(false);
                                    }}
                                >
                                    Go to Billing
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}