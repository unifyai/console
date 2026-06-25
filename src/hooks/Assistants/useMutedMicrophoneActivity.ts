'use client';

import * as React from 'react';

const SPEECH_RMS_THRESHOLD = 0.5;
const SPEECH_FRAME_THRESHOLD = 5;
const SILENCE_FRAME_THRESHOLD = 12;
const CUE_HOLD_MS = 1800;

type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

interface UseMutedMicrophoneActivityProps {
  enabled: boolean;
  deviceId?: string | null;
}

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  const audioWindow = window as WindowWithWebkitAudioContext;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

export function useMutedMicrophoneActivity({ enabled, deviceId }: UseMutedMicrophoneActivityProps) {
  const [isActive, setIsActive] = React.useState(false);
  const isActiveRef = React.useRef(false);

  React.useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  React.useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setIsActive(false);
      return;
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      setIsActive(false);
      return;
    }

    let cancelled = false;
    let animationFrameId = 0;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let speakingFrames = 0;
    let silentFrames = 0;
    let cueUntil = 0;

    const setActive = (nextActive: boolean) => {
      if (isActiveRef.current === nextActive) return;
      isActiveRef.current = nextActive;
      setIsActive(nextActive);
    };

    const stop = (updateState = true) => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      source?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      if (audioContext?.state !== 'closed') {
        void audioContext?.close();
      }
      if (updateState) setActive(false);
    };

    const start = async () => {
      const audio: boolean | MediaTrackConstraints =
        deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true;
      stream = await navigator.mediaDevices.getUserMedia({ audio });
      if (cancelled) {
        stop();
        return;
      }

      audioContext = new AudioContextConstructor();
      source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const samples = new Uint8Array(analyser.fftSize);

      const tick = () => {
        analyser.getByteTimeDomainData(samples);

        let sumSquares = 0;
        for (const sample of samples) {
          const centered = sample - 128;
          sumSquares += centered * centered;
        }

        const rms = Math.sqrt(sumSquares / samples.length) / 128;
        if (rms >= SPEECH_RMS_THRESHOLD) {
          speakingFrames += 1;
          silentFrames = 0;
        } else {
          silentFrames += 1;
          if (silentFrames >= SILENCE_FRAME_THRESHOLD) speakingFrames = 0;
        }

        const now = performance.now();
        if (speakingFrames >= SPEECH_FRAME_THRESHOLD) {
          cueUntil = now + CUE_HOLD_MS;
        }
        setActive(now < cueUntil);

        animationFrameId = requestAnimationFrame(tick);
      };

      tick();
    };

    start().catch(() => {
      stop();
    });

    return () => {
      cancelled = true;
      stop(false);
    };
  }, [deviceId, enabled]);

  return isActive;
}
