'use client';

import * as React from 'react';
import type { TrackReference } from '@livekit/components-react';
import { Lipsync } from 'wawa-lipsync';
import {
  getMartianLipsyncFrame,
  MARTIAN_IDLE_LIPSYNC_FRAME,
  type MartianLipsyncFrame,
} from '@/utils/assistants/martian-lipsync';

type LipsyncInternals = {
  audioContext: AudioContext;
  analyser: AnalyserNode;
};

type AudioTrackWithMedia = {
  mediaStreamTrack?: MediaStreamTrack;
};

export function useMartyAudioLipsync(
  audioTrack: TrackReference | undefined,
  enabled: boolean
): MartianLipsyncFrame {
  const [frame, setFrame] = React.useState<MartianLipsyncFrame>(MARTIAN_IDLE_LIPSYNC_FRAME);
  const smoothedSpeechLevelRef = React.useRef(0);

  React.useEffect(() => {
    const mediaStreamTrack = (audioTrack?.publication.track as AudioTrackWithMedia | undefined)
      ?.mediaStreamTrack;

    if (!enabled || !mediaStreamTrack || mediaStreamTrack.readyState === 'ended') {
      smoothedSpeechLevelRef.current = 0;
      setFrame(MARTIAN_IDLE_LIPSYNC_FRAME);
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
      const nextFrame = getMartianLipsyncFrame(lipsync.viseme, lipsync.features?.volume ?? 0);
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
      setFrame(MARTIAN_IDLE_LIPSYNC_FRAME);
    };
  }, [audioTrack?.publication.track, enabled]);

  return frame;
}
