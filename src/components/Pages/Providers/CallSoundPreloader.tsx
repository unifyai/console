'use client';

import { useEffect } from 'react';
import callRingingSrc from '@/public/sounds/call-ringing.mp3';
import callEndSrc from '@/public/sounds/call-end.mp3';

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
  useEffect(() => {
    if (!shouldPreloadCallSounds()) {
      return;
    }

    preloadAudio(callRingingSrc);
    preloadAudio(callEndSrc);
  }, []);

  return null;
}
