import * as React from 'react';

import callRingingSrc from '@/public/sounds/call-ringing.mp3';
import callEndSrc from '@/public/sounds/call-end.mp3';

export function useCallSounds() {
  const ringingRef = React.useRef<HTMLAudioElement | null>(null);
  const hangupRef = React.useRef<HTMLAudioElement | null>(null);

  const getRingingAudio = React.useCallback(() => {
    if (!ringingRef.current) {
      const audio = new Audio(callRingingSrc);
      audio.loop = true;
      audio.volume = 0.5;
      ringingRef.current = audio;
    }
    return ringingRef.current;
  }, []);

  const getHangupAudio = React.useCallback(() => {
    if (!hangupRef.current) {
      const audio = new Audio(callEndSrc);
      audio.volume = 0.5;
      hangupRef.current = audio;
    }
    return hangupRef.current;
  }, []);

  const startRinging = React.useCallback(() => {
    const audio = getRingingAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [getRingingAudio]);

  const stopRinging = React.useCallback(() => {
    const audio = ringingRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const playHangup = React.useCallback(() => {
    const audio = getHangupAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [getHangupAudio]);

  React.useEffect(() => {
    return () => {
      if (ringingRef.current) {
        ringingRef.current.pause();
        ringingRef.current = null;
      }
      if (hangupRef.current) {
        hangupRef.current.pause();
        hangupRef.current = null;
      }
    };
  }, []);

  return { startRinging, stopRinging, playHangup };
}
