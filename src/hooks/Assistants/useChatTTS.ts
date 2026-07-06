import * as React from 'react';
import { toast } from 'sonner';
import {
  AssistantActions,
  GenerateSpeechPayload,
  VoiceProvider,
} from '@/types/assistants/assistant';
import { normalizeElevenLabsTwinPronunciation } from '@/utils/assistants/tts-text';

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface UseChatTTSProps {
  voiceId: string | null;
  voiceProvider: VoiceProvider | null;
  generateSpeechAction?: AssistantActions['voice']['generate'];
}

export function useChatTTS({ voiceId, voiceProvider, generateSpeechAction }: UseChatTTSProps) {
  const [playingMessageId, setPlayingMessageId] = React.useState<string | null>(null);
  const [generatingMessageId, setGeneratingMessageId] = React.useState<string | null>(null);
  const [audioElement, setAudioElement] = React.useState<HTMLAudioElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const cacheRef = React.useRef(new Map<string, string>());

  React.useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingMessageId(null);
      audioRef.current.onerror = () => {
        toast.error('Error playing audio.');
        setPlayingMessageId(null);
      };
      setAudioElement(audioRef.current);
    }
    const cache = cacheRef.current;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const stopPlayback = React.useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingMessageId(null);
  }, []);

  const playMessage = React.useCallback(
    async (messageId: string, text: string) => {
      if (!audioRef.current || !voiceId || !voiceProvider || !generateSpeechAction) return;

      if (playingMessageId === messageId) {
        stopPlayback();
        return;
      }

      if (!audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const cached = cacheRef.current.get(messageId);
      if (cached) {
        setPlayingMessageId(messageId);
        audioRef.current.src = cached;
        await audioRef.current.play();
        return;
      }

      setGeneratingMessageId(messageId);

      let ttsText = stripMarkdown(text);
      if (voiceProvider === 'elevenlabs') {
        ttsText = normalizeElevenLabsTwinPronunciation(ttsText);
      }

      const payload: GenerateSpeechPayload = {
        text: ttsText,
        provider: voiceProvider,
        voiceId,
        outputFormat: 'mp3',
      };

      if (voiceProvider === 'cartesia') {
        payload.modelId = 'sonic-2';
      } else if (voiceProvider === 'elevenlabs') {
        payload.modelId = 'eleven_multilingual_v2';
      } else if (voiceProvider === 'openai') {
        payload.modelId = 'gpt-4o-mini-tts';
      }

      try {
        const result = await generateSpeechAction(payload);

        if (result.audioBase64 && result.contentType) {
          const audioBytes = base64ToUint8Array(result.audioBase64);
          if (audioBytes.byteLength === 0) {
            toast.error('Generated audio was empty.');
            setGeneratingMessageId(null);
            return;
          }
          const blob = new Blob([audioBytes as BlobPart], { type: result.contentType });
          const blobUrl = URL.createObjectURL(blob);
          cacheRef.current.set(messageId, blobUrl);

          setGeneratingMessageId(null);
          setPlayingMessageId(messageId);
          audioRef.current.src = blobUrl;
          await audioRef.current.play();
        } else {
          toast.error('Failed to generate audio. Please try again.');
          setGeneratingMessageId(null);
        }
      } catch {
        toast.error('Failed to generate audio. Please try again.');
        setGeneratingMessageId(null);
      }
    },
    [voiceId, voiceProvider, generateSpeechAction, playingMessageId, stopPlayback]
  );

  const getAudioState = React.useCallback(
    (messageId: string): 'idle' | 'generating' | 'playing' => {
      if (playingMessageId === messageId) return 'playing';
      if (generatingMessageId === messageId) return 'generating';
      return 'idle';
    },
    [playingMessageId, generatingMessageId]
  );

  const hasVoice = Boolean(voiceId && voiceProvider && generateSpeechAction);

  return { playMessage, stopPlayback, getAudioState, hasVoice, audioElement };
}
