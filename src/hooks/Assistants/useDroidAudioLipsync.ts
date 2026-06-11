'use client';

import * as React from 'react';
import type { TrackReference } from '@livekit/components-react';
import { Lipsync } from 'wawa-lipsync';
import {
  DROID_IDLE_LIPSYNC_FRAME,
  getDroidLipsyncFrame,
  type DroidLipsyncFrame,
} from '@/utils/assistants/droid-lipsync';

type LipsyncInternals = {
  audioContext: AudioContext;
  analyser: AnalyserNode;
};

type AudioTrackWithMedia = {
  mediaStreamTrack?: MediaStreamTrack;
};

export function useDroidAudioLipsync(
  audioTrack: TrackReference | undefined,
  enabled: boolean
): DroidLipsyncFrame {
  const [frame, setFrame] = React.useState<DroidLipsyncFrame>(DROID_IDLE_LIPSYNC_FRAME);
  const smoothedSpeechLevelRef = React.useRef(0);

  React.useEffect(() => {
    const mediaStreamTrack = (audioTrack?.publication.track as AudioTrackWithMedia | undefined)
      ?.mediaStreamTrack;

    if (!enabled || !mediaStreamTrack || mediaStreamTrack.readyState === 'ended') {
      smoothedSpeechLevelRef.current = 0;
      setFrame(DROID_IDLE_LIPSYNC_FRAME);
      return;
    }

    let animationFrame = 0;
    const stream = new MediaStream([mediaStreamTrack]);
    const lipsync = new Lipsync({ fftSize: 2048, historySize: 12 });
    const internals = lipsync as unknown as LipsyncInternals;
    const source = internals.audioContext.createMediaStreamSource(stream);
    source.connect(internals.analyser);
    internals.audioContext.resume().catch(() => {});

    const tick = () => {
      lipsync.processAudio();
      const nextFrame = getDroidLipsyncFrame(lipsync.viseme, lipsync.features?.volume ?? 0);
      smoothedSpeechLevelRef.current =
        smoothedSpeechLevelRef.current * 0.72 + nextFrame.speechLevel * 0.28;
      setFrame({
        ...nextFrame,
        speechLevel: smoothedSpeechLevelRef.current,
        mouthShape: nextFrame.isActive
          ? nextFrame.mouthShape
          : smoothedSpeechLevelRef.current > 0.08
            ? 'narrow'
            : 'closed',
        isActive: nextFrame.isActive || smoothedSpeechLevelRef.current > 0.08,
      });
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      source.disconnect();
      internals.audioContext.close().catch(() => {});
      smoothedSpeechLevelRef.current = 0;
      setFrame(DROID_IDLE_LIPSYNC_FRAME);
    };
  }, [audioTrack?.publication.track, enabled]);

  return frame;
}
