import * as React from 'react';
import { toast } from 'sonner';
import { AssistantActions, PhotoCreationResponse, VideoAnimationResponse, VoiceOption } from '@/types/team/assistant';
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
    photoOperationCost: number,
    videoAnimationCost: number,
    selectedVoice: VoiceOption | null,
) {
    const [prompt, setPrompt] = React.useState('');
    const [ttsPrompt, setTtsPrompt] = React.useState('');
    const [isProcessing, setIsProcessing] = React.useState(false);

    const insufficientFundsToast = (operationName: string) => {
        toast.error(`Insufficient funds for AI photo ${operationName}.`, {
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
        if (currentBalance < photoOperationCost) {
            insufficientFundsToast("generation");
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
            toast.error(`Photo generation failed.`, { id: toastId });
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
        if (currentBalance < photoOperationCost) {
            insufficientFundsToast("editing");
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
                     // While technically possible to fetch blob and resend, it's complex.
                     // Backend edit endpoint expects a public URL or a direct file for Replicate.
                     // Simplest for now is to prevent editing local blob previews.
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
            toast.error(`Photo editing failed. ${error.message}`, { id: toastId });
            console.error("[usePhotoCreator] edit error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAnimate = async (imageSource: File | string) => {
        if (!ttsPrompt.trim()) {
            toast.error("Please enter text for the animation's audio.");
            return;
        }
        if (!imageSource) {
            toast.error("An existing photo is required for animation.");
            return;
        }
        if (!selectedVoice) {
            toast.error("A voice must be selected to generate audio for animation.");
            return;
        }

        setIsProcessing(true);
        const toastId = toast.loading("Checking your balance...");

        const currentBalance = await fetchBalance();
        if (currentBalance < videoAnimationCost) {
            insufficientFundsToast("animation");
            toast.dismiss(toastId);
            setIsProcessing(false);
            return;
        }
        
        toast.loading("Generating audio for animation...", { id: toastId });

        try {
            // 1. Generate TTS audio
            const ttsResponse = await fetch(`/api/voices/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cartesiaVoiceId: selectedVoice.voice_id,
                    text: ttsPrompt,
                    language: selectedVoice.language
                })
            });

            if (!ttsResponse.ok) {
                const errorData = await ttsResponse.json().catch(() => ({ detail: "TTS generation failed for animation." }));
                throw new Error(errorData.detail);
            }
            const audioBlob = await ttsResponse.blob();
            if (audioBlob.size === 0) throw new Error("Generated audio was empty.");
            const audioFile = new File([audioBlob], "tts_audio_for_animation.wav", { type: "audio/wav" });

            // 2. Prepare FormData for animation backend
            toast.loading("Animating photo...", { id: toastId });
            const formData = new FormData();
            formData.append('audio_file', audioFile);
            // Add other animation params if needed by backend/Replicate, e.g., dynamic_scale
            // formData.append('dynamic_scale', '1.0'); 

            if (imageSource instanceof File) {
                formData.append('image_file', imageSource);
            } else if (typeof imageSource === 'string') {
                 if (imageSource.startsWith('blob:')) {
                     throw new Error("Cannot animate a local photo preview. Please use a saved or generated photo.");
                }
                formData.append('image_url', imageSource);
            }
            
            // 3. Call animate action
            const result = await photoActions.animate(formData);
            if ((result as ResponseProps).detail) {
                throw new Error((result as ResponseProps).detail);
            }
            const remoteVideoUrl = (result as VideoAnimationResponse).video_url; 

            // 4. Download the animated video and pass it as a File object
            toast.loading("Processing animated video...", { id: toastId });
            const videoFetchResponse = await fetch(remoteVideoUrl);
            if (!videoFetchResponse.ok) throw new Error(`Failed to download the animated video from ${remoteVideoUrl}. Status: ${videoFetchResponse.status}`);
            
            const videoBlob = await videoFetchResponse.blob();
            const videoFilename = remoteVideoUrl.substring(remoteVideoUrl.lastIndexOf('/') + 1) || "ai-animated-video.mp4";
            const newVideoFile = new File([videoBlob], videoFilename, { type: videoBlob.type || 'video/mp4' });

            onNewFileReady(newVideoFile); // This updates imageFile and imagePreview (to a blob URL for the video)

            setTtsPrompt(''); // Clear TTS prompt
            toast.success("Photo animated successfully!", { id: toastId });

        } catch (error: any) {
            toast.error(`Photo animation failed`, { id: toastId });
            console.error("[usePhotoCreator] animate error:", error);
        } finally {
            setIsProcessing(false);
        }
    };


    return {
        prompt, setPrompt,
        ttsPrompt, setTtsPrompt,
        isProcessing,
        handleGenerate,
        handleEdit,
        handleAnimate,
    };
}