import * as React from 'react';
import { Assistant, AssistantFormData, AssistantActions, AvailableSocialPlatform } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { Loader2, X } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

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
}: AssistantEditProps) {
    
    const [isCloseTooltipOpen, setIsCloseTooltipOpen] = React.useState(false);
    const isPrimaryActionDisabled = isSubmitting || !!isProcessingVoice || !!isProcessingPhoto;

    const handleDialogClose = (open: boolean) => {
        if (!isPrimaryActionDisabled) {
            if (!open) {
                onClose();
            }
        }
    };

    const handleDialogInteractOutside = (e: Event) => {
       e.preventDefault();
       if (!isPrimaryActionDisabled) {
           setIsCloseTooltipOpen(true);
           // Auto-hide tooltip after a short delay
           setTimeout(() => setIsCloseTooltipOpen(false), 2500);
       }
    }; 

    const submitButtonLabel = () => {
        if (isSubmitting) return "Updating...";
        if (isProcessingVoice) return "Processing Voice...";
        if (isProcessingPhoto) return "Processing Photo...";
        return "Update Assistant";
    };

    const displayName = `${assistant.first_name} ${assistant.surname}`;

    return (
        <Dialog 
            open={isOpen} 
            onOpenChange={handleDialogClose}
        >
            <DialogContent 
                className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0"
                onInteractOutside={handleDialogInteractOutside}
                onPointerDownOutside={(e) => { 
                    e.preventDefault();
                }}
                hideClose
            >
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="text-title">Edit {displayName}</DialogTitle>
                            <DialogDescription className="text-subtitle">
                                Modify your assistant details.
                            </DialogDescription>
                        </div>
                        <TooltipProvider delayDuration={100}>
                            <Tooltip open={isCloseTooltipOpen} onOpenChange={setIsCloseTooltipOpen}>
                                <TooltipTrigger asChild>
                                     <Button variant="warning" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onClose} disabled={isPrimaryActionDisabled}>
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

                <div className="flex-1 min-h-0 overflow-hidden">
                    {children}
                </div>

                <DialogFooter className="px-6 py-3 border-t flex-shrink-0 flex items-center justify-between">
                    <Button 
                        type="button" 
                        onClick={onSubmit} 
                        disabled={isPrimaryActionDisabled}
                    >
                        {isPrimaryActionDisabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {submitButtonLabel()}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}