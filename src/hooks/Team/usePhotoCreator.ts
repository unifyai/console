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
    onNewFileReady: (file: File) => void,
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

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter a prompt to generate a photo.");
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

        toast.loading("Generating photo...", { id: toastId });

        try {
            const result = await photoActions.generate({ prompt });
            if ((result as ResponseProps).detail) {
                throw new Error((result as ResponseProps).detail);
            }
            const newUrl = (result as PhotoCreationResponse).url;
            
            toast.loading("Processing generated image...", { id: toastId });
            const imageResponse = await fetch(newUrl);
            if (!imageResponse.ok) throw new Error("Failed to download the generated image.");
            
            const blob = await imageResponse.blob();
            const filename = newUrl.substring(newUrl.lastIndexOf('/') + 1) || "ai-generated-photo.jpg";
            const imageFile = new File([blob], filename, { type: blob.type });

            onNewFileReady(imageFile);
            setPrompt('');
            toast.success("Photo generated successfully!", { id: toastId });

        } catch (error: any) {
            toast.error(`Photo generation failed: ${error.message}`, { id: toastId });
            console.error("[usePhotoCreator] generate error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEdit = async (imageSource: File | string) => {
        if (!prompt.trim()) {
            toast.error("Please enter a prompt to edit the photo.");
            return;
        }
        if (!imageSource) {
            toast.error("An existing photo is required for editing.");
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
        
        toast.loading("Editing photo...", { id: toastId });

        try {
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

            const result = await photoActions.edit(formData);

            if ((result as ResponseProps).detail) {
                throw new Error((result as ResponseProps).detail);
            }

            const newUrl = (result as PhotoCreationResponse).url;
            
            toast.loading("Processing edited image...", { id: toastId });
            const imageResponse = await fetch(newUrl);
            if (!imageResponse.ok) throw new Error("Failed to download the edited image.");

            const blob = await imageResponse.blob();
            const filename = newUrl.substring(newUrl.lastIndexOf('/') + 1) || "ai-edited-photo.jpg";
            const imageFile = new File([blob], filename, { type: blob.type });

            onNewFileReady(imageFile);
            setPrompt('');
            toast.success("Photo edited successfully!", { id: toastId });

        } catch (error: any) {
            toast.error(`Photo editing failed: ${error.message}`, { id: toastId });
            console.error("[usePhotoCreator] edit error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        prompt,
        setPrompt,
        isProcessing,
        handleGenerate,
        handleEdit,
    };
}