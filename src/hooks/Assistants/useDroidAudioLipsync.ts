'use client';

import type { TrackReference } from '@livekit/components-react';
import type { CreatureMood } from '@/components/Brand/TeammateCreature';
import { useDroidTrackLipsync, type DroidLipsyncFrame } from '@/utils/assistants/droid-lipsync';

type AudioTrackWithMedia = {
  mediaStreamTrack?: MediaStreamTrack;
};

/**
 * Drives a droid mouth from a LiveKit agent audio track. The realtime analysis + smoothing
 * lives in the shared @droid/brand runner; this wrapper just extracts the MediaStreamTrack.
 */
export function useDroidAudioLipsync(
  audioTrack: TrackReference | undefined,
  enabled: boolean,
  emotion?: CreatureMood
): DroidLipsyncFrame {
  const track =
    (audioTrack?.publication.track as AudioTrackWithMedia | undefined)?.mediaStreamTrack ?? null;

  return useDroidTrackLipsync(track, { enabled, emotion });
}
