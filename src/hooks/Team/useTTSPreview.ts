import * as React from 'react';
import { toast } from 'sonner';
import { VoiceOption, AssistantActions, GenerateSpeechPayload } from '@/types/team/assistant'; 
import { ResponseProps } from '@/types/common';
import { getRandomSampleLine } from '@/utils/team/voice-utils';
import { SupportedLanguage } from '@cartesia/cartesia-js/api';

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
                console.error("Audio playback error:", e);
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

        if (isPlayingPreviewForVoiceId === voice.voice_id) {
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

        if (!voice.voice_id || !voice.provider || !voice.language) {
            toast.error("Voice information is incomplete for preview.");
            console.error("Incomplete voice data for TTS preview:", voice);
            setIsPlayingPreviewForVoiceId(null);
            return;
        }
        
        const randomLine = getRandomSampleLine(voice.language);
        setIsPlayingPreviewForVoiceId(voice.voice_id);

        const payload: GenerateSpeechPayload = {
            text: randomLine,
            provider: voice.provider, 
            voice_id: voice.voice_id,
            output_format: "mp3", 
        };
        
        if (voice.provider === 'cartesia') {
            payload.model_id = 'sonic-2'; 
            payload.cartesia_language = voice.language as SupportedLanguage;
        } else if (voice.provider === 'elevenlabs') {
            payload.model_id = 'eleven_multilingual_v2'; 
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
                const audioBlob = new Blob([audioUint8Array], { type: result.contentType });
                const audioURL = URL.createObjectURL(audioBlob);
                audioRef.current.src = audioURL;
                await audioRef.current.play();
            } else { 
                const errorDetail = result.detail || "TTS generation failed";
                console.error(`Error playing voice (hook): ${errorDetail}, Status: ${result.status}`);
                toast.error(`Error playing voice: ${String(errorDetail).substring(0, 200)}`);
                setIsPlayingPreviewForVoiceId(null);
            }
        } catch (e: any) {
            console.error("TTS Preview Error (hook catch block):", e);
            toast.error(`Failed to play preview: ${String(e.message || e).substring(0,200)}`);
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