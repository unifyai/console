'use client';

import { useEffect } from 'react';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import callRingingSrc from '@/public/sounds/call-ringing-warm-mobile.wav';
import callEndSrc from '@/public/sounds/call-end.mp3';
import recordStartSrc from '@/public/sounds/record-start.mp3';
import recordStopSrc from '@/public/sounds/record-stop.mp3';

const PRELOAD_FLAG_KEY = '__unify_call_sounds_preloaded__';
const retainedAudioElements: HTMLAudioElement[] = [];

function preloadAudio(src: string) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.load();
  retainedAudioElements.push(audio);
}

function shouldPreloadCallSounds() {
  const preloadWindow = window as Window & { [PRELOAD_FLAG_KEY]?: boolean };
  if (preloadWindow[PRELOAD_FLAG_KEY]) {
    return false;
  }
  preloadWindow[PRELOAD_FLAG_KEY] = true;
  return true;
}

export default function CallSoundPreloader() {
  const { voiceCalls, transcription } = useFeatures();

  useEffect(() => {
    // Each sound pair belongs to a feature: ringing/hangup to voice calls,
    // record start/stop to transcription. Skip preloading anything no enabled
    // feature would ever play (the sounds still load on-demand if needed).
    if ((!voiceCalls && !transcription) || !shouldPreloadCallSounds()) {
      return;
    }

    if (voiceCalls) {
      preloadAudio(callRingingSrc);
      preloadAudio(callEndSrc);
    }
    if (transcription) {
      preloadAudio(recordStartSrc);
      preloadAudio(recordStopSrc);
    }
  }, [voiceCalls, transcription]);

  return null;
}
