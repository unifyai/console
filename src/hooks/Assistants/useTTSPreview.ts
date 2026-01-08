import * as React from 'react';
import { toast } from 'sonner';
import { VoiceOption, AssistantActions, GenerateSpeechPayload } from '@/types/assistants/assistant'; 
import { getRandomSampleLine } from '@/utils/assistants/voice-utils';
import { SupportedLanguage } from '@cartesia/cartesia-js/api';

// Helper to convert Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

interface UseTTSPreviewProps {
    generateSpeechAction: AssistantActions['voice']['generate'];
}

export function useTTSPreview({ generateSpeechAction }: UseTTSPreviewProps) {
    const [isPlayingPreviewForVoiceId, setIsPlayingPreviewForVoiceId] = React.useState<string | null>(null);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    React.useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.onended = () => {
                setIsPlayingPreviewForVoiceId(null);
                if (audioRef.current?.src.startsWith('blob:')) {
                    URL.revokeObjectURL(audioRef.current.src); 
                }
            };
            audioRef.current.onerror = (e) => {
                toast.error("Error playing audio preview.");
                setIsPlayingPreviewForVoiceId(null);
            };
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                if (audioRef.current.src.startsWith('blob:')) {
                    URL.revokeObjectURL(audioRef.current.src);
                }
                audioRef.current = null; 
            }
        };
    }, []);

    const playPreview = async (voice: VoiceOption) => {
        if (!audioRef.current) return;

        if (isPlayingPreviewForVoiceId === voice.voiceId) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlayingPreviewForVoiceId(null);
            if (audioRef.current.src.startsWith('blob:')) {
                URL.revokeObjectURL(audioRef.current.src);
            }
            return;
        }

        if (!audioRef.current.paused) {
            audioRef.current.pause();
            if (audioRef.current.src.startsWith('blob:')) {
                 URL.revokeObjectURL(audioRef.current.src);
            }
        }

        if (!voice.voiceId || !voice.provider || !voice.language) {
            toast.error("Voice information is incomplete for preview.");
            setIsPlayingPreviewForVoiceId(null);
            return;
        }
        
        const randomLine = getRandomSampleLine(voice.language);
        setIsPlayingPreviewForVoiceId(voice.voiceId);

        const payload: GenerateSpeechPayload = {
            text: randomLine,
            provider: voice.provider, 
            voiceId: voice.voiceId,
            outputFormat: "mp3", 
        };
        
        if (voice.provider === 'cartesia') {
            payload.modelId = 'sonic-2'; 
            payload.cartesiaLanguage = voice.language as SupportedLanguage;
        } else if (voice.provider === 'elevenlabs') {
            payload.modelId = 'eleven_multilingual_v2'; 
        } else if (voice.provider === 'openai') {
            payload.modelId = 'gpt-4o-mini-tts'
        } else {
            toast.error(`Unsupported voice provider: ${voice.provider}`);
            setIsPlayingPreviewForVoiceId(null);
            return;
        }

        try {
            const result = await generateSpeechAction(payload);

            if (result.audioBase64 && result.contentType) {
                const audioUint8Array = base64ToUint8Array(result.audioBase64);
                if (audioUint8Array.byteLength === 0) {
                    toast.error("Generated audio was empty.");
                    setIsPlayingPreviewForVoiceId(null);
                    return;
                }
                const audioBlob = new Blob([audioUint8Array as BlobPart], { type: result.contentType });
                const audioURL = URL.createObjectURL(audioBlob);
                audioRef.current.src = audioURL;
                await audioRef.current.play();
            } else { 
                const errorDetail = result.detail || "TTS generation failed";
                toast.error(`Error playing voice. Please try again or contact us if the issue persists.`);
                setIsPlayingPreviewForVoiceId(null);
            }
        } catch (e: any) {
            toast.error(`Failed to play preview. Please try again or contact us if the issue persists.`);
            setIsPlayingPreviewForVoiceId(null);
        }
    };

    const stopPreview = () => {
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            if (audioRef.current.src.startsWith('blob:')) {
                URL.revokeObjectURL(audioRef.current.src);
            }
        }
        setIsPlayingPreviewForVoiceId(null);
    };

    return {
        playPreview,
        stopPreview,
        isPlayingPreviewForVoiceId,
    };
}