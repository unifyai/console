'use client';

import type { TrackReference } from '@livekit/components-react';
import type { CreatureMood } from '@/components/Brand/TeammateCreature';
import { useUnityTrackLipsync, type UnityLipsyncFrame } from '@/utils/assistants/unity-lipsync';

type AudioTrackWithMedia = {
  mediaStreamTrack?: MediaStreamTrack;
};

/**
 * Drives a unity mouth from a LiveKit agent audio track. The realtime analysis + smoothing
 * lives in the shared @unity/brand runner; this wrapper just extracts the MediaStreamTrack.
 */
export function useUnityAudioLipsync(
  audioTrack: TrackReference | undefined,
  enabled: boolean,
  emotion?: CreatureMood
): UnityLipsyncFrame {
  const track =
    (audioTrack?.publication.track as AudioTrackWithMedia | undefined)?.mediaStreamTrack ?? null;

  return useUnityTrackLipsync(track, { enabled, emotion });
}
