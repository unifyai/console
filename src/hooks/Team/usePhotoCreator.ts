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
            setPrompt(''); // Clear prompt on success
            toast.success("Photo generated successfully!", { id: toastId });
        } catch (error: any) {
            toast.error(`Photo generation failed: ${error.message}`, { id: toastId });
            console.error("[usePhotoCreator] Generate error:", error);
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
        const toastId = toast.loading("Editing photo...");

        try {
            const formData = new FormData();
            formData.append('prompt', prompt);
            // Default values required by the backend endpoint
            formData.append('aspect_ratio', 'match_input_image');
            formData.append('output_format', 'jpg');
            formData.append('safety_tolerance', '2.0');

            if (imageSource instanceof File) {
                formData.append('input_image_file', imageSource);
            } else if (typeof imageSource === 'string') {
                if (imageSource.startsWith('blob:')) {
                    toast.error("Cannot edit a local photo preview. Please use a saved or generated photo.", { id: toastId });
                    setIsProcessing(false);
                    return;
                }
                formData.append('input_image_url', imageSource);
            }

            const result = await photoActions.edit(formData);
            if ((result as ResponseProps).detail) {
                throw new Error((result as ResponseProps).detail);
            }
            const newUrl = (result as PhotoCreationResponse).url;
            onPhotoCreated(newUrl);
            setPrompt(''); // Clear prompt on success
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