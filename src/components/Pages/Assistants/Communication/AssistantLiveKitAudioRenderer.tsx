'use client';

import * as React from 'react';
import { RoomAudioRenderer } from '@livekit/components-react';

const ASSISTANT_LIVEKIT_PLAYBACK_VOLUME = 0.8;

function setAudioElementVolume(root: HTMLDivElement | null) {
  if (!root) return;
  for (const audio of root.querySelectorAll('audio')) {
    audio.volume = ASSISTANT_LIVEKIT_PLAYBACK_VOLUME;
  }
}

export function AssistantLiveKitAudioRenderer() {
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    setAudioElementVolume(root);
    const observer = new MutationObserver(() => setAudioElementVolume(root));
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef}>
      <RoomAudioRenderer />
    </div>
  );
}
