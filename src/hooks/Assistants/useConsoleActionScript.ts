'use client';

import * as React from 'react';
import { RoomEvent, type Room } from 'livekit-client';
import {
  CONSOLE_ACTIONS_TOPIC,
  STEP_LAG_MS,
  TRANSCRIPTION_TOPIC,
  dueSteps,
  parseConsoleScript,
} from '@/lib/agent-guidance/consoleActionScript';
import {
  executeTarget,
  targetTestId,
  type TargetNavigator,
} from '@/lib/agent-guidance/consoleTargets';
import type { ConsoleActionScript } from '@/types/agentActions';

interface UseConsoleActionScriptOptions {
  room: Room | null;
  nav: TargetNavigator;
  /** Called before the first move, to get the call window out of the way. */
  revealConsole?: () => void;
  /** Flash the element a move lands on, so the change is legible. */
  highlight?: (testId: string) => void;
  enabled?: boolean;
}

/**
 * Runs the console moves the assistant narrates, in time with its speech.
 *
 * The whole script arrives in one message before the line starts playing, so
 * the sequence needs no further round trip and cannot stall between steps. Each
 * move is then held until LiveKit's synchronized transcript shows playout has
 * reached the words it belongs to — the transcript is paced to the audio, so
 * alignment happens here rather than being estimated upstream and shipped.
 *
 * Interruption needs no special handling: a barge-in stops the transcript, the
 * remaining positions are never reached, and their moves never fire. Cutting in
 * on "and then your billing page" should not open billing.
 */
export function useConsoleActionScript({
  room,
  nav,
  revealConsole,
  highlight,
  enabled = true,
}: UseConsoleActionScriptOptions): void {
  const navRef = React.useRef(nav);
  const revealRef = React.useRef(revealConsole);
  const highlightRef = React.useRef(highlight);
  React.useEffect(() => {
    navRef.current = nav;
    revealRef.current = revealConsole;
    highlightRef.current = highlight;
  }, [nav, revealConsole, highlight]);

  const scriptRef = React.useRef<ConsoleActionScript | null>(null);
  const firedRef = React.useRef<Set<number>>(new Set());
  const revealedRef = React.useRef(false);
  const timersRef = React.useRef<number[]>([]);

  const clearTimers = React.useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  const runStep = React.useCallback((target: string) => {
    if (!revealedRef.current) {
      revealedRef.current = true;
      revealRef.current?.();
    }
    const navTestId = targetTestId(target);
    if (navTestId) highlightRef.current?.(navTestId);
    void executeTarget(target, navRef.current, {
      highlight: (testId) => highlightRef.current?.(testId),
    }).then((outcome) => {
      // A control that has moved is worth saying out loud rather than passing
      // as a click that never happened.
      if (outcome !== 'done' && outcome !== 'clicked') {
        console.warn(`[consoleActions] ${target} did not resolve: ${outcome}`);
      }
    });
  }, []);

  const advance = React.useCallback(
    (charsSpoken: number) => {
      const script = scriptRef.current;
      if (!script) return;
      for (const { index, step } of dueSteps(script.steps, charsSpoken, firedRef.current)) {
        firedRef.current.add(index);
        // A beat after the words, not on them.
        timersRef.current.push(window.setTimeout(() => runStep(step.target), STEP_LAG_MS));
      }
    },
    [runStep]
  );

  React.useEffect(() => {
    if (!room || !enabled) return;

    const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic !== CONSOLE_ACTIONS_TOPIC) return;
      let parsed: ConsoleActionScript | null = null;
      try {
        parsed = parseConsoleScript(JSON.parse(new TextDecoder().decode(payload)));
      } catch {
        return;
      }
      if (!parsed) return;
      // A newer line supersedes an older one upstream, so its moves must
      // supersede too rather than fire against words no longer being spoken.
      clearTimers();
      scriptRef.current = parsed;
      firedRef.current = new Set();
      revealedRef.current = false;
    };

    room.on(RoomEvent.DataReceived, onData);

    let disposed = false;
    try {
      room.registerTextStreamHandler(TRANSCRIPTION_TOPIC, (reader) => {
        void (async () => {
          let spoken = '';
          for await (const chunk of reader) {
            if (disposed) return;
            spoken += chunk;
            advance(spoken.length);
          }
        })();
      });
    } catch {
      // Another consumer already owns the topic; the script still arrives and
      // simply runs on utterance start rather than in time with the words.
    }

    return () => {
      disposed = true;
      clearTimers();
      room.off(RoomEvent.DataReceived, onData);
      try {
        room.unregisterTextStreamHandler(TRANSCRIPTION_TOPIC);
      } catch {
        // Never registered; nothing to release.
      }
    };
  }, [room, enabled, advance, clearTimers]);
}
