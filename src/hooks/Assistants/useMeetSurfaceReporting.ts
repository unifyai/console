'use client';

import * as React from 'react';
import type { SystemEventType } from '@/lib/assistants/desktop';

/** The surfaces the Console speaks for, and how each transition is announced. */
const SURFACES = {
  screenShare: {
    started: 'user_screen_share_started',
    stopped: 'user_screen_share_stopped',
    startedMessage: 'User started sharing their screen',
    stoppedMessage: 'User stopped sharing their screen',
  },
  camera: {
    started: 'user_webcam_started',
    stopped: 'user_webcam_stopped',
    startedMessage: 'User enabled their webcam',
    stoppedMessage: 'User disabled their webcam',
  },
} satisfies Record<
  string,
  {
    started: SystemEventType;
    stopped: SystemEventType;
    startedMessage: string;
    stoppedMessage: string;
  }
>;

type SurfaceName = keyof typeof SURFACES;

const SURFACE_NAMES = Object.keys(SURFACES) as SurfaceName[];

export type SendSystemEvent = (
  assistantId: string,
  eventType: SystemEventType,
  message: string
) => Promise<unknown>;

/**
 * Tell a running assistant which of the user's shared surfaces are open.
 *
 * The assistant treats whatever a frontend reports as authoritative for the
 * surfaces that frontend renders, in preference to what LiveKit track state
 * implies — the two disagree, because a camera switched off in the UI can keep
 * its track subscribed until the room tears down. That authority makes silence
 * a claim of its own, which is why unmount reports too: leaving a call while
 * sharing is a transition the assistant otherwise never hears about, and it
 * goes on believing the screen is up.
 */
export function useMeetSurfaceReporting({
  agentId,
  sendSystemEvent,
  screenShare,
  camera,
}: {
  /** Assistant to report to; reporting is skipped while absent. */
  agentId: string | undefined;
  sendSystemEvent: SendSystemEvent;
  screenShare: boolean;
  camera: boolean;
}): void {
  // Read through refs so the unmount reporter can stay mount-scoped: given the
  // surface values in its dependencies it would fire a spurious "stopped" on
  // every toggle, which is the same wrong signal in the opposite direction.
  const sendRef = React.useRef(sendSystemEvent);
  sendRef.current = sendSystemEvent;
  const agentIdRef = React.useRef(agentId);
  agentIdRef.current = agentId;
  const reportedRef = React.useRef<Record<SurfaceName, boolean>>({ screenShare, camera });

  React.useEffect(() => {
    const previous = reportedRef.current;
    const current = { screenShare, camera };
    reportedRef.current = current;
    if (!agentId) return;

    for (const name of SURFACE_NAMES) {
      if (previous[name] === current[name]) continue;
      const surface = SURFACES[name];
      const on = current[name];
      sendRef
        .current(
          agentId,
          on ? surface.started : surface.stopped,
          on ? surface.startedMessage : surface.stoppedMessage
        )
        .catch(console.error);
    }
  }, [agentId, screenShare, camera]);

  React.useEffect(
    () => () => {
      const id = agentIdRef.current;
      if (!id) return;
      for (const name of SURFACE_NAMES) {
        if (!reportedRef.current[name]) continue;
        const surface = SURFACES[name];
        sendRef.current(id, surface.stopped, surface.stoppedMessage).catch(console.error);
      }
    },
    []
  );
}
