import * as React from 'react';
import { toast } from 'sonner';
import { AssistantActions, PhotoCreationResponse } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';

export function usePhotoCreator(
    photoActions: AssistantActions['photo'],
    onPhotoCreated: (newUrl: string) => void,
) {
    const [prompt, setPrompt] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter a prompt to generate a photo.");
            return;
        }
        setIsProcessing(true);
        const toastId = toast.loading("Generating new photo...");
        try {
            const result = await photoActions.generate({ prompt });
            if ((result as ResponseProps).detail) {
                throw new Error((result as ResponseProps).detail);
            }
            const newUrl = (result as PhotoCreationResponse).url;
            onPhotoCreated(newUrl);
            toast.success("Photo generated successfully!", { id: toastId });
        } catch (error: any) {
            toast.error(`Photo generation failed: ${error.message}`, { id: toastId });
            console.error("[usePhotoCreator] Generate error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEdit = async (imageUrl: string) => {
        if (!prompt.trim()) {
            toast.error("Please enter a prompt to edit the photo.");
            return;
        }
        if (!imageUrl || imageUrl.startsWith('blob:')) {
            toast.error("An existing, saved photo is required for editing.");
            return;
        }
        setIsProcessing(true);
        const toastId = toast.loading("Editing photo...");
        try {
            const result = await photoActions.edit({ prompt, input_image: imageUrl });
             if ((result as ResponseProps).detail) {
                throw new Error((result as ResponseProps).detail);
            }
            const newUrl = (result as PhotoCreationResponse).url;
            onPhotoCreated(newUrl);
            toast.success("Photo edited successfully!", { id: toastId });
        } catch (error: any) {
            toast.error(`Photo editing failed: ${error.message}`, { id: toastId });
            console.error("[usePhotoCreator] Edit error:", error);
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