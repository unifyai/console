import * as React from 'react';
import { toast } from 'sonner';
import { AssistantActions, GenerateSpeechPayload, PhotoCreationResponse, VideoAnimationResponse, VoiceOption } from '@/types/team/assistant'; // Added GenerateSpeechPayload
import { ResponseProps } from '@/types/common';
import { SupportedLanguage } from '@cartesia/cartesia-js/api';

// Helper to convert Base64 to Uint8Array (if not already globally available)
function base64ToUint8Array(base64: string): Uint8Array {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

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
    generateSpeechAction: AssistantActions['voice']['generate'],
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
            toast.error(`Photo editing failed.`, { id: toastId });
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
        if (!selectedVoice || !selectedVoice.provider || !selectedVoice.language) {
            toast.error("A complete voice (with provider and language) must be selected to generate audio for animation.");
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
            const ttsPayload: GenerateSpeechPayload = {
                text: ttsPrompt,
                provider: selectedVoice.provider,
                voice_id: selectedVoice.voice_id,
                output_format: "mp3", // Replicate likely prefers mp3 or wav
                // Add provider specific fields
                ...(selectedVoice.provider === 'cartesia' && { 
                    model_id: 'sonic-2', 
                    cartesia_language: selectedVoice.language as SupportedLanguage 
                }),
                ...(selectedVoice.provider === 'elevenlabs' && { 
                    model_id: 'eleven_multilingual_v2' 
                }),
            };

            const ttsResult = await generateSpeechAction(ttsPayload);

            if (ttsResult.detail || !ttsResult.audioBase64 || !ttsResult.contentType) {
                throw new Error(ttsResult.detail || "TTS generation failed for animation.");
            }
            
            const audioUint8Array = base64ToUint8Array(ttsResult.audioBase64);
            const audioFile = new File([audioUint8Array], "tts_audio_for_animation.mp3", { type: ttsResult.contentType }); // Use mp3 extension as default

            toast.loading("Animating photo...", { id: toastId });
            const formData = new FormData();
            formData.append('audio_file', audioFile);

            if (imageSource instanceof File) {
                formData.append('image_file', imageSource);
            } else if (typeof imageSource === 'string') {
                 if (imageSource.startsWith('blob:')) {
                     throw new Error("Cannot animate a local photo preview. Please use a saved or generated photo.");
                }
                formData.append('image_url', imageSource);
            }
            
            const result = await photoActions.animate(formData);
            if ((result as ResponseProps).detail) {
                // Check for status code if available in ResponseProps from animate action
                const responsePropsResult = result as ResponseProps & { status?: number };
                if (responsePropsResult.status === 503) {
                    toast.warning("The animation service is currently overloaded. Please try again in a few minutes.", { id: toastId });
                    setIsProcessing(false);
                    return;
                }
                throw new Error((result as ResponseProps).detail);
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
            toast.success("Photo animated successfully!", { id: toastId });

        } catch (error: any) {
            if (error && typeof error === 'object' && 'detail' in error && 'status' in error && error.status === 503) {
                toast.warning("The animation service is currently overloaded, please try again in a few minutes.", { id: toastId });
            } else {
                toast.error(`Photo animation failed: ${error.message || "Unknown error"}.`, { id: toastId });
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