import * as React from 'react';
import { toast } from 'sonner';
import { VoiceOption } from '@/types/team/assistant';
import { getRandomSampleLine } from '@/utils/team/voice-utils';

export function useTTSPreview() {
    const [isPlayingPreviewForVoiceId, setIsPlayingPreviewForVoiceId] = React.useState<string | null>(null);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    // Ensure audio element exists
    React.useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.onended = () => {
                setIsPlayingPreviewForVoiceId(null);
                if (audioRef.current?.src.startsWith('blob:')) {
                    URL.revokeObjectURL(audioRef.current.src); // Clean up blob URL
                }
            };
            audioRef.current.onerror = (e) => {
                console.error("Audio playback error:", e);
                toast.error("Error playing audio preview.");
                setIsPlayingPreviewForVoiceId(null);
            };
        }
        // Cleanup on unmount
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                if (audioRef.current.src.startsWith('blob:')) {
                    URL.revokeObjectURL(audioRef.current.src);
                }
                audioRef.current = null; // Help garbage collection
            }
        };
    }, []);

    const playPreview = async (voice: VoiceOption) => {
        if (!audioRef.current) return;

        if (isPlayingPreviewForVoiceId === voice.voice_id) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlayingPreviewForVoiceId(null);
            return;
        }

        // If another audio is playing, stop it first
        if (!audioRef.current.paused) {
            audioRef.current.pause();
            if (audioRef.current.src.startsWith('blob:')) {
                 URL.revokeObjectURL(audioRef.current.src);
            }
        }

        const randomLine = getRandomSampleLine(voice.language);
        setIsPlayingPreviewForVoiceId(voice.voice_id);

        try {
            const response = await fetch(`/api/voices/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cartesiaVoiceId: voice.voice_id,
                    text: randomLine,
                    language: voice.language
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "TTS generation failed" }));
                console.error(`Error playing voice: ${errorData.detail}`);
                toast.error(`Error playing voice`);
                setIsPlayingPreviewForVoiceId(null);
                return;
            }

            const blob = await response.blob();
            if (blob.size === 0) {
                setIsPlayingPreviewForVoiceId(null);
                return;
            }

            const audioURL = URL.createObjectURL(blob);
            audioRef.current.src = audioURL;
            await audioRef.current.play();

        } catch (e: any) {
            console.error("TTS Preview Error:", e);
            toast.error(`Failed to play preview`);
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
        // audioRef: audioRef // Expose if direct manipulation is needed, but usually not
    };
}