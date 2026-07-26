'use client';

/**
 * OpenReplay session replay for Console.
 *
 * Talks to the self-hosted OpenReplay ingest
 * (`NEXT_PUBLIC_OPENREPLAY_INGEST_POINT`, e.g.
 * https://openreplay.example.com/ingest). No-ops when the project
 * key is unset so local/dev builds stay quiet until secrets are wired.
 *
 * Privacy: inputs are recorded in plain text (`defaultInputMode: 0`,
 * obscure* flags false). Console already renders secrets as "." in the
 * DOM; replays should match what the user saw. Network payloads are
 * not captured.
 */

import { useEffect, useRef } from 'react';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';

type OpenReplayHandle = {
  setUserID: (id: string) => void;
  setMetadata: (key: string, value: string) => void;
};

declare global {
  interface Window {
    __openreplay?: OpenReplayHandle;
  }
}

const PROJECT_KEY = process.env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY?.trim() || '';
const INGEST_POINT =
  process.env.NEXT_PUBLIC_OPENREPLAY_INGEST_POINT?.trim() ||
  'https://openreplay.example.com/ingest';

export default function OpenReplayTracker() {
  const { currentUserId, user } = useWorkspace();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!PROJECT_KEY || startedRef.current) {
      return;
    }
    let cancelled = false;

    void (async () => {
      const OpenReplay = (await import('@openreplay/tracker')).default;
      if (cancelled) {
        return;
      }
      const tracker = new OpenReplay({
        projectKey: PROJECT_KEY,
        ingestPoint: INGEST_POINT,
        // Record visible field values as typed — product UI already masks
        // secrets with "." in the DOM.
        defaultInputMode: 0,
        obscureTextEmails: false,
        obscureTextNumbers: false,
        obscureInputEmails: false,
        obscureInputNumbers: false,
        obscureInputDates: false,
        network: {
          capturePayload: false,
          failuresOnly: false,
          sessionTokenHeader: false,
          ignoreHeaders: ['Cookie', 'Set-Cookie', 'Authorization'],
          captureInIframes: false,
        },
      });
      await tracker.start();
      if (cancelled) {
        return;
      }
      startedRef.current = true;
      window.__openreplay = tracker;
      if (currentUserId) {
        tracker.setUserID(currentUserId);
      }
      if (user?.email) {
        tracker.setMetadata('email', user.email);
      }
      if (user?.name) {
        tracker.setMetadata('name', user.name);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally start once; identity is refreshed in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once tracker boot
  }, []);

  useEffect(() => {
    const tracker = window.__openreplay;
    if (!tracker) {
      return;
    }
    if (currentUserId) {
      tracker.setUserID(currentUserId);
    }
    if (user?.email) {
      tracker.setMetadata('email', user.email);
    }
    if (user?.name) {
      tracker.setMetadata('name', user.name);
    }
  }, [currentUserId, user?.email, user?.name]);

  return null;
}
