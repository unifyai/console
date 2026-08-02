'use client';

import * as React from 'react';
import { subscribeToAssistantActionStream } from '@/lib/client/assistant-action-stream';
import {
  executeTarget,
  targetTestId,
  type TargetNavigator,
} from '@/lib/agent-guidance/consoleTargets';

/**
 * Gap between moves when there is no speech to sit inside.
 *
 * On a Meet each move waits for the words it belongs to. Off a Meet there are no
 * words being spoken, so the moves are paced instead — fast enough to feel like
 * one gesture, slow enough that the user sees each step happen rather than
 * arriving at the last one wondering how.
 */
export const UNSYNCED_STEP_GAP_MS = 900;

interface UseConsoleScriptStreamOptions {
  assistantId: string | null;
  nav: TargetNavigator;
  highlight?: (testId: string) => void;
  enabled?: boolean;
}

/**
 * Runs console moves that arrive outside a Unify Meet.
 *
 * Presence is what gates this, not the medium: the assistant offers to show
 * something whenever the console is open, so a reply over SMS or a plain phone
 * call can move the page just as a Meet can. What changes is only the timing —
 * there is no synchronized transcript to align against, so the steps are walked
 * at a readable pace.
 */
export function useConsoleScriptStream({
  assistantId,
  nav,
  highlight,
  enabled = true,
}: UseConsoleScriptStreamOptions): void {
  const navRef = React.useRef(nav);
  const highlightRef = React.useRef(highlight);
  React.useEffect(() => {
    navRef.current = nav;
    highlightRef.current = highlight;
  }, [nav, highlight]);

  React.useEffect(() => {
    if (!assistantId || !enabled) return;

    let cancelled = false;
    // Serialized: a second script must not interleave its moves with the first,
    // which would leave the user watching two half-sequences at once.
    let running: Promise<void> = Promise.resolve();

    const run = async (targets: string[]) => {
      for (const [index, target] of targets.entries()) {
        if (cancelled) return;
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, UNSYNCED_STEP_GAP_MS));
          if (cancelled) return;
        }
        const navTestId = targetTestId(target);
        if (navTestId) highlightRef.current?.(navTestId);
        const outcome = await executeTarget(target, navRef.current, {
          highlight: (testId) => highlightRef.current?.(testId),
        });
        if (outcome !== 'done' && outcome !== 'clicked') {
          console.warn(`[consoleScript] ${target} did not resolve: ${outcome}`);
        }
      }
    };

    const unsubscribe = subscribeToAssistantActionStream(assistantId, {
      onMessage: (data) => {
        let targets: string[] = [];
        try {
          const parsed = JSON.parse(data) as {
            type?: string;
            data?: { steps?: Array<{ target?: unknown }> };
          };
          if (parsed.type !== 'ConsoleScript') return;
          targets = (parsed.data?.steps ?? [])
            .map((step) => step.target)
            .filter((target): target is string => typeof target === 'string');
        } catch {
          return;
        }
        if (targets.length === 0) return;
        running = running.then(() => run(targets));
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [assistantId, enabled]);
}
