import * as React from 'react';
import { toast } from 'sonner';
import { AssistantActions, PhotoCreationResponse } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';

const fetchBalance = async (): Promise<number> => {
    try {
        const balanceData = await fetch(`/api/billing/balance`).then((res) => res.json());
        if (balanceData && typeof balanceData.fullBalance === 'number') {
            return balanceData.fullBalance;
        }
        console.warn("Could not fetch user balance or format was incorrect.");
        return 0;
    } catch (error) {
        console.error("Error fetching balance:", error);
        toast.error("Could not verify your credit balance.");
        return 0;
    }
};

export function usePhotoCreator(
    photoActions: AssistantActions['photo'],
    onPhotoCreated: (newUrl: string) => void,
    operationCost: number,
) {
    const [prompt, setPrompt] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);

    const insufficientFundsToast = () => {
        toast.error("Insufficient funds for AI photo creation.", {
            description: "Please recharge your account to continue.",
            action: {
                label: "Go to Billing",
                onClick: () => window.open('/billing', '_blank'),
            },
        });
    }

    const performPhotoOperation = async (
        operation: 'generate' | 'edit',
        imageSource?: File | string
    ) => {
        if (!prompt.trim()) {
            toast.error(`Please enter a prompt to ${operation} a photo.`);
            return;
        }

        setIsProcessing(true);
        const toastId = toast.loading("Checking your balance...");

        const currentBalance = await fetchBalance();
        if (currentBalance < operationCost) {
            insufficientFundsToast();
            toast.dismiss(toastId);
            setIsProcessing(false);
            return;
        }

        const operationVerb = operation === 'generate' ? 'Generating' : 'Editing';
        toast.loading(`${operationVerb} photo...`, { id: toastId });

        try {
            let result: PhotoCreationResponse | ResponseProps;
            if (operation === 'generate') {
                result = await photoActions.generate({ prompt });
            } else {
                 if (!imageSource) {
                    throw new Error("An existing photo is required for editing.");
                }
                const formData = new FormData();
                formData.append('prompt', prompt);
                formData.append('aspect_ratio', 'match_input_image');
                formData.append('output_format', 'jpg');
                formData.append('safety_tolerance', '2.0');

                if (imageSource instanceof File) {
                    formData.append('input_image_file', imageSource);
                } else if (typeof imageSource === 'string') {
                    if (imageSource.startsWith('blob:')) {
                         throw new Error("Cannot edit a local photo preview. Please use a saved or generated photo.");
                    }
                    formData.append('input_image_url', imageSource);
                }
                result = await photoActions.edit(formData);
            }

            if ((result as ResponseProps).detail) {
                throw new Error((result as ResponseProps).detail);
            }

            const newUrl = (result as PhotoCreationResponse).url;
            onPhotoCreated(newUrl);
            setPrompt(''); // Clear prompt on success
            toast.success(`Photo ${operationVerb.toLowerCase().slice(0, -3)}ed successfully!`, { id: toastId });

        } catch (error: any) {
            toast.error(`Photo ${operation} failed: ${error.message}`, { id: toastId });
            console.error(`[usePhotoCreator] ${operation} error:`, error);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleGenerate = () => performPhotoOperation('generate');
    const handleEdit = (imageSource: File | string) => performPhotoOperation('edit', imageSource);

    return {
        prompt,
        setPrompt,
        isProcessing,
        handleGenerate,
        handleEdit,
    };
}