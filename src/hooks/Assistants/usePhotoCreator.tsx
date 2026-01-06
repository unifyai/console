'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { StopCircle } from 'lucide-react';
import { AssistantActions, GenerateSpeechPayload, PhotoCreationResponse, ReplicatePredictionResponse, VoiceOption } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { SupportedLanguage } from '@cartesia/cartesia-js/api';
import { getAudioDuration, getRandomSampleLine } from '@/utils/assistants/voice-utils';
import { Button } from '@/components/UI/button';

const ANIMATION_POLLING_INTERVAL = 5000;

// Helper to convert Base64 to Uint8Array
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
        return 0;
    } catch (error) {
        toast.error("Could not verify your credit balance.");
        return 0;
    }
};

const AnimationProgressToast = ({
    onCancel,
}: {
    onCancel: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
    const [dots, setDots] = React.useState('.');
    const [progress, setProgress] = React.useState(0);

    React.useEffect(() => {
        const dotsInterval = setInterval(() => {
            setDots(prev => (prev.length >= 3 ? '.' : prev + '.'));
        }, 500);

        const progressInterval = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev + (100 - prev) / 2;
                // Stop interval when we are very close to 100 to prevent it from running indefinitely
                if (newProgress > 99) {
                    clearInterval(progressInterval);
                    return 99;
                }
                return newProgress;
            });
        }, ANIMATION_POLLING_INTERVAL);

        return () => {
            clearInterval(dotsInterval);
            clearInterval(progressInterval);
        };
    }, []);

    return (
        <div className="group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border bg-background p-4 pr-6 shadow-lg text-foreground">
            <div className="flex flex-col gap-1.5 flex-grow">
                <div className="text-sm font-semibold">Animating photo{dots}</div>
                <div className="text-sm opacity-90">This can take up to a minute.</div>
                <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div
                        className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
            <Button
                onClick={onCancel}
                aria-label="Cancel animation"
                variant={"warning_outline"}
                type="button"
                className='absolute right-2 top-2 border-none'
            >
                <StopCircle className="h-5 w-5 hover:text-amber-500" />
            </Button>
        </div>
    );
};


export function usePhotoCreator(
    photoActions: AssistantActions['photo'],
    generateSpeechAction: AssistantActions['voice']['generate'],
    onNewMediaReady: (file: File | null, mediaType: 'photo' | 'video', metadata?: { voiceId?: string }) => void,
    photoOperationCost: number,
    videoAnimationCost: number,
    selectedVoice: VoiceOption | null,
    firstName?: string | null,
    surname?: string | null,
    age?: number | null
) {
    const [prompt, setPrompt] = React.useState('A photorealistic portrait of a friendly-looking person, studio lighting...');
    
    const initialTtsPrompt = React.useMemo(() => {
        if (selectedVoice?.language) {
            return getRandomSampleLine(selectedVoice.language);
        }
        return "Hi there! How can I help you today?";
    }, [selectedVoice]);

    const [ttsPrompt, setTtsPrompt] = React.useState(initialTtsPrompt);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const toastIdRef = React.useRef<string | number | undefined>();
    const isProcessingRef = React.useRef(isProcessing);

    React.useEffect(() => {
        isProcessingRef.current = isProcessing;
    }, [isProcessing]);

    React.useEffect(() => {
        setTtsPrompt(initialTtsPrompt);
    }, [initialTtsPrompt]);

    // Cleanup polling on unmount
    React.useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearTimeout(pollIntervalRef.current);
            }
            if (toastIdRef.current) {
                toast.dismiss(toastIdRef.current);
            }
        };
    }, []);


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

        const description = prompt;
        const finalPromptParts = [];
        if (firstName && surname) {
            finalPromptParts.push(`Name: ${firstName} ${surname}`);
        }
        if (age) {
            finalPromptParts.push(`Age: ${age}`);
        }
        finalPromptParts.push(`Description: ${description}`);
        const finalPrompt = finalPromptParts.join('\n');

        try {
            const result = await photoActions.generate({ prompt: finalPrompt });
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

            onNewMediaReady(imageFile, 'photo');
            toast.success("Photo generated successfully!", { id: toastId });

        } catch (error: any) {
            toast.error(`Photo generation failed.`, { id: toastId });
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

            onNewMediaReady(imageFile, 'photo');
            toast.success("Photo edited successfully!", { id: toastId });

        } catch (error: any) {
            toast.error(`Photo editing failed.`, { id: toastId });
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
        toastIdRef.current = toast.loading("Generating video speech...");

        try {
        
            const ttsPayload: GenerateSpeechPayload = {
                text: ttsPrompt, provider: selectedVoice.provider, voice_id: selectedVoice.voice_id, output_format: "mp3",
                ...(selectedVoice.provider === 'cartesia' && { model_id: 'sonic-2', cartesia_language: selectedVoice.language as SupportedLanguage }),
                ...(selectedVoice.provider === 'elevenlabs' && { model_id: 'eleven_multilingual_v2' }),
            };
    
            const ttsResult = await generateSpeechAction(ttsPayload);
            if (ttsResult.detail || !ttsResult.audioBase64 || !ttsResult.contentType) {
                throw new Error(ttsResult.detail || "TTS generation failed for animation.");
            }
    
            const audioUint8Array = base64ToUint8Array(ttsResult.audioBase64) as any;
            const audioFile = new File([audioUint8Array], "tts_audio_for_animation.mp3", { type: ttsResult.contentType });
            let audioDuration = 0;
            try {
                audioDuration = await getAudioDuration(audioFile);
            } catch (e) {/* no-op */}

            toast.loading("Checking your balance...", { id: toastIdRef.current });

            const currentBalance = await fetchBalance();
            if (currentBalance < videoAnimationCost * (audioDuration > 0 ? audioDuration : 1)) {
                insufficientFundsToast("animation");
                setIsProcessing(false);
                toast.dismiss(toastIdRef.current);
                toastIdRef.current = undefined;
                return;
            }

            toast.loading("Starting animation job...", { id: toastIdRef.current });
            
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
            if (audioDuration > 0) {
                formData.append('duration', audioDuration.toString());
            }

            const createResult = await photoActions.animate(formData);
            if ('detail' in createResult) {
                throw new Error(createResult.detail);
            }
    
            const prediction = createResult as ReplicatePredictionResponse;

            const stopPolling = () => {
                if (pollIntervalRef.current) {
                    clearTimeout(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
            };
    
            const handleCancel = async (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                stopPolling();
                setIsProcessing(false);
                
                if (toastIdRef.current) {
                    toast.dismiss(toastIdRef.current);
                    toastIdRef.current = undefined;
                }

                const cancelToastId = toast.loading("Canceling animation...");

                try {
                    await photoActions.cancelAnimation(prediction.id);
                    toast.success("Animation canceled.", { id: cancelToastId, duration: 4000 });
                } catch (e) {
                    toast.error("Failed to cancel animation.", { id: cancelToastId, duration: 4000 });
                }
            };
    
            toast.custom((t) => {
                toastIdRef.current = t;
                return (
                    <AnimationProgressToast onCancel={handleCancel} />
                );
            }, { 
                id: toastIdRef.current, 
                duration: Infinity,
                className: "w-full p-0 bg-transparent rounded-md border shadow-lg"
            });
    
            const poll = async () => {
                if (!isProcessingRef.current) {
                    stopPolling();
                    return;
                }
                
                try {
                    const statusResult = await photoActions.getAnimation(prediction.id);

                    if ('detail' in statusResult) {
                        pollIntervalRef.current = setTimeout(poll, 20000);
                        return;
                    }
                    
                    const currentStatus = statusResult as ReplicatePredictionResponse;
    
                    if (currentStatus.status === 'succeeded') {
                        stopPolling();
                        
                        if (toastIdRef.current) toast.loading("Finalizing video...", { id: toastIdRef.current });
                        
                        const output = currentStatus.output;
                        let outputUrl: string | null = null;

                        if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
                            outputUrl = output[0];
                        } else if (typeof output === 'string' && output.trim() !== '') {
                            outputUrl = output;
                        }

                        if (!outputUrl) {
                            toast.error("Animation succeeded but the video URL was missing or invalid.", { id: toastIdRef.current });
                            toastIdRef.current = undefined;
                            setIsProcessing(false);
                            return;
                        }
                        
                        const videoFetchResponse = await fetch(outputUrl);
                        if (!videoFetchResponse.ok) {
                            toast.error("Failed to retrieve the final video.", { id: toastIdRef.current });
                            toastIdRef.current = undefined;
                            setIsProcessing(false);
                            return;
                        }
                        
                        const videoBlob = await videoFetchResponse.blob();
                        const videoFilename = outputUrl.substring(outputUrl.lastIndexOf('/') + 1) || "ai-animated-video.mp4";
                        const newVideoFile = new File([videoBlob], videoFilename, { type: videoBlob.type || 'video/mp4' });
                        
                        onNewMediaReady(newVideoFile, 'video', { voiceId: selectedVoice!.voice_id });
                        if(toastIdRef.current) toast.success("Animation complete! Your video is now available.", { id: toastIdRef.current, duration: 4000 });       
                        setIsProcessing(false);
                        toastIdRef.current = undefined;

                    } else if (currentStatus.status === 'failed' || currentStatus.status === 'canceled') {
                        stopPolling();
                        if (toastIdRef.current) {
                            if (currentStatus.status === 'failed') {
                                toast.error(`Animation failed. Please try again.`, { id: toastIdRef.current, duration: 5000 });
                            } else {
                                toast.info("Animation was canceled.", { id: toastIdRef.current, duration: 5000 });
                            }
                        }
                        toastIdRef.current = undefined;
                        setIsProcessing(false);
                    } else {
                        pollIntervalRef.current = setTimeout(poll, 20000);
                    }
                } catch (pollError) {
                    stopPolling();
                    if(toastIdRef.current) {
                        toast.error("An error occurred while checking animation status.", { id: toastIdRef.current, duration: 5000 });
                        toastIdRef.current = undefined;
                    }
                    setIsProcessing(false);
                }
            };
            
            pollIntervalRef.current = setTimeout(poll, ANIMATION_POLLING_INTERVAL);
    
        } catch (error: any) {
            if(toastIdRef.current) {
                toast.error("Failed to start animation. Please try again.", { id: toastIdRef.current });
            }
            toastIdRef.current = undefined;
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
