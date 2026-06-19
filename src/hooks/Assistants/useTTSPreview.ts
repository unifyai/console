import * as React from 'react';
import { toast } from 'sonner';
import { VoiceOption, AssistantActions, GenerateSpeechPayload } from '@/types/assistants/assistant';
import { getRandomSampleLine } from '@/utils/assistants/voice-utils';
import { SupportedLanguage } from '@cartesia/cartesia-js/api';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';

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

interface PlayPreviewOptions {
  restart?: boolean;
}

export function useTTSPreview({ generateSpeechAction }: UseTTSPreviewProps) {
  // Speech synthesis requires a TTS provider (Cartesia/ElevenLabs). When none is
  // configured, generation fails with an opaque backend error — short-circuit
  // with a clear message instead.
  const { voiceSynthesis } = useFeatures();
  const [isLoadingPreviewForVoiceId, setIsLoadingPreviewForVoiceId] = React.useState<string | null>(
    null
  );
  const [isPlayingPreviewForVoiceId, setIsPlayingPreviewForVoiceId] = React.useState<string | null>(
    null
  );
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [previewAudioElement, setPreviewAudioElement] = React.useState<HTMLAudioElement | null>(
    null
  );
  const previewRequestIdRef = React.useRef(0);

  const clearAudioPreview = React.useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    }
    setPreviewAudioElement(null);
  }, []);

  React.useEffect(() => {
    return () => {
      clearAudioPreview();
    };
  }, [clearAudioPreview]);

  const playPreview = async (voice: VoiceOption, options: PlayPreviewOptions = {}) => {
    if (isPlayingPreviewForVoiceId === voice.voiceId) {
      if (options.restart && audioRef.current) {
        try {
          audioRef.current.currentTime = 0;
          await audioRef.current.play();
        } catch {
          toast.error(
            `Failed to play preview. Please try again or contact us if the issue persists.`
          );
        }
        return;
      }

      previewRequestIdRef.current += 1;
      clearAudioPreview();
      setIsPlayingPreviewForVoiceId(null);
      setIsLoadingPreviewForVoiceId(null);
      return;
    }

    if (isLoadingPreviewForVoiceId === voice.voiceId && !options.restart) return;

    if (!voiceSynthesis) {
      toast.warning("Voice preview isn't available — no speech provider configured.");
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    clearAudioPreview();
    setIsPlayingPreviewForVoiceId(null);
    setIsLoadingPreviewForVoiceId(null);

    if (!voice.voiceId || !voice.provider || !voice.language) {
      toast.error('Voice information is incomplete for preview.');
      setIsPlayingPreviewForVoiceId(null);
      setIsLoadingPreviewForVoiceId(null);
      return;
    }

    const randomLine = getRandomSampleLine(voice.language);
    setIsLoadingPreviewForVoiceId(voice.voiceId);
    setIsPlayingPreviewForVoiceId(null);

    const payload: GenerateSpeechPayload = {
      text: randomLine,
      provider: voice.provider,
      voiceId: voice.voiceId,
      outputFormat: 'mp3',
    };

    if (voice.provider === 'cartesia') {
      payload.modelId = 'sonic-2';
      payload.cartesiaLanguage = voice.language as SupportedLanguage;
    } else if (voice.provider === 'elevenlabs') {
      payload.modelId = 'eleven_multilingual_v2';
    } else if (voice.provider === 'openai') {
      payload.modelId = 'gpt-4o-mini-tts';
    } else {
      toast.error(`Unsupported voice provider: ${voice.provider}`);
      setIsPlayingPreviewForVoiceId(null);
      return;
    }

    try {
      const result = await generateSpeechAction(payload);
      if (previewRequestIdRef.current !== requestId) return;

      if (result.audioBase64 && result.contentType) {
        const audioUint8Array = base64ToUint8Array(result.audioBase64);
        if (audioUint8Array.byteLength === 0) {
          if (previewRequestIdRef.current !== requestId) return;
          toast.error('Generated audio was empty.');
          setIsLoadingPreviewForVoiceId(null);
          setIsPlayingPreviewForVoiceId(null);
          return;
        }
        const audioBlob = new Blob([audioUint8Array as BlobPart], { type: result.contentType });
        const audioURL = URL.createObjectURL(audioBlob);
        if (previewRequestIdRef.current !== requestId) {
          URL.revokeObjectURL(audioURL);
          return;
        }

        const audio = new Audio(audioURL);
        audioRef.current = audio;
        setPreviewAudioElement(audio);
        audio.onended = () => {
          if (previewRequestIdRef.current !== requestId) return;
          setIsPlayingPreviewForVoiceId(null);
          setIsLoadingPreviewForVoiceId(null);
          clearAudioPreview();
        };
        audio.onerror = () => {
          if (previewRequestIdRef.current !== requestId) return;
          toast.error('Error playing audio preview.');
          setIsPlayingPreviewForVoiceId(null);
          setIsLoadingPreviewForVoiceId(null);
          clearAudioPreview();
        };

        await audio.play();
        if (previewRequestIdRef.current !== requestId) {
          clearAudioPreview();
          return;
        }
        setIsLoadingPreviewForVoiceId(null);
        setIsPlayingPreviewForVoiceId(voice.voiceId);
      } else {
        toast.error(`Error playing voice. Please try again or contact us if the issue persists.`);
        setIsLoadingPreviewForVoiceId(null);
        setIsPlayingPreviewForVoiceId(null);
      }
    } catch {
      if (previewRequestIdRef.current !== requestId) return;
      toast.error(`Failed to play preview. Please try again or contact us if the issue persists.`);
      setIsLoadingPreviewForVoiceId(null);
      setIsPlayingPreviewForVoiceId(null);
      clearAudioPreview();
    }
  };

  const stopPreview = () => {
    previewRequestIdRef.current += 1;
    clearAudioPreview();
    setIsLoadingPreviewForVoiceId(null);
    setIsPlayingPreviewForVoiceId(null);
  };

  return {
    playPreview,
    stopPreview,
    isLoadingPreviewForVoiceId,
    isPlayingPreviewForVoiceId,
    previewAudioElement,
  };
}
