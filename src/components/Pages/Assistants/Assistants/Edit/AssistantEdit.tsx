import * as React from 'react';
import { Assistant, AssistantFormData, AssistantActions, AvailableSocialPlatform } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/UI/dialog";
import { Button } from '@/components/UI/button';
import { Loader2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

interface AssistantEditProps {
    isOpen: boolean;
    onClose: () => void;
    assistant: Assistant;
    formMethods: UseFormReturn<AssistantFormData>;
    onSubmit: () => Promise<void>;
    isSubmitting: boolean;
    children: React.ReactNode;
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
    isProcessingVoice,
}: AssistantEditProps) {

    const isPrimaryActionDisabled = isSubmitting || !!isProcessingVoice;

    const handleDialogClose = (open: boolean) => {
        if (!isPrimaryActionDisabled) {
            if (!open) {
                onClose();
            }
        }
    };

    const handleDialogInteractOutside = (e: Event) => {
        if (isPrimaryActionDisabled) {
            e.preventDefault();
        }
    };
    
    const submitButtonLabel = () => {
        if (isSubmitting) return "Updating...";
        if (isProcessingVoice) return "Processing Voice...";
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
                    if (isPrimaryActionDisabled) e.preventDefault();
                }}
            >
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <DialogTitle>Edit {displayName}</DialogTitle>
                    <DialogDescription>
                        Modify your assistant details.
                    </DialogDescription>
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