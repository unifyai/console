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
  onSpeechLevelChange?: (level: number) => void;
}

export function useTTSPreview({ generateSpeechAction, onSpeechLevelChange }: UseTTSPreviewProps) {
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
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const audioSourceRef = React.useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const analyserDataRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null);
  const speechFrameRef = React.useRef<number | null>(null);
  const smoothedSpeechLevelRef = React.useRef(0);
  const previewRequestIdRef = React.useRef(0);
  const onSpeechLevelChangeRef = React.useRef(onSpeechLevelChange);

  React.useEffect(() => {
    onSpeechLevelChangeRef.current = onSpeechLevelChange;
  }, [onSpeechLevelChange]);

  const stopSpeechLevelMonitoring = React.useCallback(() => {
    if (speechFrameRef.current !== null) {
      window.cancelAnimationFrame(speechFrameRef.current);
      speechFrameRef.current = null;
    }
    smoothedSpeechLevelRef.current = 0;
    onSpeechLevelChangeRef.current?.(0);
  }, []);

  const disposeAudioGraph = React.useCallback(() => {
    audioSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioSourceRef.current = null;
    analyserRef.current = null;
    analyserDataRef.current = null;
  }, []);

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

    disposeAudioGraph();
  }, [disposeAudioGraph]);

  const ensureSpeechAnalyser = React.useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return null;

    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.35;
    }

    if (!audioSourceRef.current) {
      audioSourceRef.current = audioContextRef.current.createMediaElementSource(audio);
      audioSourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    return analyserRef.current;
  }, []);

  const startSpeechLevelMonitoring = React.useCallback(async () => {
    const analyser = await ensureSpeechAnalyser();
    const audio = audioRef.current;
    if (!analyser || !audio) {
      onSpeechLevelChangeRef.current?.(0);
      return;
    }

    if (!analyserDataRef.current || analyserDataRef.current.length !== analyser.fftSize) {
      analyserDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    }

    const sampleSpeechLevel = () => {
      const currentAudio = audioRef.current;
      const data = analyserDataRef.current;
      if (!currentAudio || !data || currentAudio.paused || currentAudio.ended) {
        stopSpeechLevelMonitoring();
        return;
      }

      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let index = 0; index < data.length; index++) {
        const sample = data[index];
        const centeredSample = (sample - 128) / 128;
        sumSquares += centeredSample * centeredSample;
      }

      const rms = Math.sqrt(sumSquares / data.length);
      const speechLevel = Math.max(0, Math.min(1, (rms - 0.018) * 8));
      smoothedSpeechLevelRef.current = smoothedSpeechLevelRef.current * 0.45 + speechLevel * 0.55;
      onSpeechLevelChangeRef.current?.(smoothedSpeechLevelRef.current);
      speechFrameRef.current = window.requestAnimationFrame(sampleSpeechLevel);
    };

    stopSpeechLevelMonitoring();
    sampleSpeechLevel();
  }, [ensureSpeechAnalyser, stopSpeechLevelMonitoring]);

  React.useEffect(() => {
    return () => {
      stopSpeechLevelMonitoring();
      clearAudioPreview();
      audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [clearAudioPreview, stopSpeechLevelMonitoring]);

  const playPreview = async (voice: VoiceOption) => {
    if (isPlayingPreviewForVoiceId === voice.voiceId) {
      previewRequestIdRef.current += 1;
      clearAudioPreview();
      setIsPlayingPreviewForVoiceId(null);
      setIsLoadingPreviewForVoiceId(null);
      stopSpeechLevelMonitoring();
      return;
    }

    if (isLoadingPreviewForVoiceId === voice.voiceId) return;

    if (!voiceSynthesis) {
      toast.warning("Voice preview isn't available — no speech provider configured.");
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    clearAudioPreview();
    setIsPlayingPreviewForVoiceId(null);
    setIsLoadingPreviewForVoiceId(null);
    stopSpeechLevelMonitoring();

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
        audio.onended = () => {
          if (previewRequestIdRef.current !== requestId) return;
          setIsPlayingPreviewForVoiceId(null);
          setIsLoadingPreviewForVoiceId(null);
          stopSpeechLevelMonitoring();
          clearAudioPreview();
        };
        audio.onerror = () => {
          if (previewRequestIdRef.current !== requestId) return;
          toast.error('Error playing audio preview.');
          setIsPlayingPreviewForVoiceId(null);
          setIsLoadingPreviewForVoiceId(null);
          stopSpeechLevelMonitoring();
          clearAudioPreview();
        };

        await ensureSpeechAnalyser();
        if (previewRequestIdRef.current !== requestId) return;
        await audio.play();
        if (previewRequestIdRef.current !== requestId) {
          clearAudioPreview();
          return;
        }
        setIsLoadingPreviewForVoiceId(null);
        setIsPlayingPreviewForVoiceId(voice.voiceId);
        startSpeechLevelMonitoring();
      } else {
        const errorDetail = result.detail || 'TTS generation failed';
        toast.error(`Error playing voice. Please try again or contact us if the issue persists.`);
        setIsLoadingPreviewForVoiceId(null);
        setIsPlayingPreviewForVoiceId(null);
        stopSpeechLevelMonitoring();
      }
    } catch (e: any) {
      if (previewRequestIdRef.current !== requestId) return;
      toast.error(`Failed to play preview. Please try again or contact us if the issue persists.`);
      setIsLoadingPreviewForVoiceId(null);
      setIsPlayingPreviewForVoiceId(null);
      stopSpeechLevelMonitoring();
    }
  };

  const stopPreview = () => {
    previewRequestIdRef.current += 1;
    clearAudioPreview();
    setIsLoadingPreviewForVoiceId(null);
    setIsPlayingPreviewForVoiceId(null);
    stopSpeechLevelMonitoring();
  };

  return {
    playPreview,
    stopPreview,
    isLoadingPreviewForVoiceId,
    isPlayingPreviewForVoiceId,
  };
}
