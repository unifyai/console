import * as React from 'react';
import { showLoadingToast, showErrorToast, showSuccessToast } from '@/components/notifications';
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
        showErrorToast("Could not verify your credit balance.");
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
        showErrorToast(`Insufficient funds for AI photo ${operationName}. Please recharge your account to continue.`);
    }

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            showErrorToast("Please enter a prompt to generate a photo.");
            return;
        }

        setIsProcessing(true);
        const toastId = showLoadingToast("Checking your balance...");

        const currentBalance = await fetchBalance();
        if (currentBalance < photoOperationCost) {
            insufficientFundsToast("generation");
            showErrorToast("Insufficient funds for AI photo generation. Please recharge your account to continue.", undefined, toastId);
            setIsProcessing(false);
            return;
        }

        // Continue with the same loading toast for generating photo

        try {
            const result = await photoActions.generate({ prompt });
            if ((result as ResponseProps).detail) {
                throw new Error((result as ResponseProps).detail);
            }
            const newUrl = (result as PhotoCreationResponse).url;
            
            // Continue processing the generated image
            const imageResponse = await fetch(newUrl);
            if (!imageResponse.ok) throw new Error("Failed to download the generated image.");
            
            const blob = await imageResponse.blob();
            const filename = newUrl.substring(newUrl.lastIndexOf('/') + 1) || "ai-generated-photo.jpg";
            const imageFile = new File([blob], filename, { type: blob.type });

            onNewFileReady(imageFile);
            setPrompt('');
            showSuccessToast("Photo generated successfully!", undefined, toastId);

        } catch (error: any) {
            showErrorToast(`Photo generation failed.`, `Photo generation failed.`, toastId);
            console.error("[usePhotoCreator] generate error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEdit = async (imageSource: File | string) => {
        if (!prompt.trim()) {
            showErrorToast("Please enter a prompt to edit the photo.");
            return;
        }
        if (!imageSource) {
            showErrorToast("An existing photo is required for editing.");
            return;
        }

        setIsProcessing(true);
        const toastId = showLoadingToast("Checking your balance...");

        const currentBalance = await fetchBalance();
        if (currentBalance < photoOperationCost) {
            insufficientFundsToast("editing");
            setIsProcessing(false);
            return;
        }
        
        // Continue with same loading toast for editing photo

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
            
            // Continue processing the edited image
            const imageResponse = await fetch(newUrl);
            if (!imageResponse.ok) throw new Error("Failed to download the edited image.");

            const blob = await imageResponse.blob();
            const filename = newUrl.substring(newUrl.lastIndexOf('/') + 1) || "ai-edited-photo.jpg";
            const imageFile = new File([blob], filename, { type: blob.type });

            onNewFileReady(imageFile);
            setPrompt('');
            showSuccessToast("Photo edited successfully!", undefined, toastId);

        } catch (error: any) {
            showErrorToast(`Photo editing failed.`, `Photo editing failed.`, toastId);
            console.error("[usePhotoCreator] edit error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAnimate = async (imageSource: File | string) => {
        if (!ttsPrompt.trim()) {
            showErrorToast("Please enter text for the animation's audio.");
            return;
        }
        if (!imageSource) {
            showErrorToast("An existing photo is required for animation.");
            return;
        }
        if (!selectedVoice) {
            showErrorToast("A voice must be selected to generate audio for animation.");
            return;
        }

        setIsProcessing(true);
        const toastId = showLoadingToast("Checking your balance...");

        const currentBalance = await fetchBalance();
        if (currentBalance < videoAnimationCost) {
            insufficientFundsToast("animation");
            setIsProcessing(false);
            return;
        }
        
        // Continue with same loading toast for generating audio

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
            // Continue with same loading toast for animating photo
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
                throw result;
            }
            const remoteVideoUrl = (result as VideoAnimationResponse).video_url; 

            // 4. Download the animated video and pass it as a File object
            // Continue with same loading toast for processing video
            const videoFetchResponse = await fetch(remoteVideoUrl);
            if (!videoFetchResponse.ok) throw new Error(`Failed to download the animated video from ${remoteVideoUrl}. Status: ${videoFetchResponse.status}`);
            
            const videoBlob = await videoFetchResponse.blob();
            const videoFilename = remoteVideoUrl.substring(remoteVideoUrl.lastIndexOf('/') + 1) || "ai-animated-video.mp4";
            const newVideoFile = new File([videoBlob], videoFilename, { type: videoBlob.type || 'video/mp4' });

            onNewFileReady(newVideoFile); // This updates imageFile and imagePreview (to a blob URL for the video)

            setTtsPrompt(''); // Clear TTS prompt
            showSuccessToast("Photo animated successfully!", undefined, toastId);

        } catch (error: any) {
            if (error && typeof error === 'object' && 'detail' in error && 'status' in error && error.status === 503) {
                showErrorToast("Photo animation failed. The service is currently overloaded, please try again in a few minutes.", "Photo animation failed. The service is currently overloaded, please try again in a few minutes.", toastId);
            } else {
                showErrorToast("Photo animation failed.", "Photo animation failed.", toastId);
            }
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