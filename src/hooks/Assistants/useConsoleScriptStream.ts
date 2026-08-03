'use client';

import * as React from 'react';
import { subscribeToAssistantActionStream } from '@/lib/client/assistant-action-stream';
import {
  executeTarget,
  targetTestId,
  type TargetNavigator,
} from '@/lib/agent-guidance/consoleTargets';
import { readAgentNavigationEnabled } from '@/hooks/Assistants/useAgentNavigationPermission';
import { useConsoleScriptReporter } from '@/hooks/Assistants/useConsoleScriptReporter';
import { isActiveConsoleTab } from '@/hooks/Assistants/useActiveTabClaim';

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
  const { record, flush } = useConsoleScriptReporter(assistantId);
  const recordRef = React.useRef(record);
  React.useEffect(() => {
    navRef.current = nav;
    highlightRef.current = highlight;
    recordRef.current = record;
  }, [nav, highlight, record]);

  React.useEffect(() => {
    if (!assistantId || !enabled) return;

    let cancelled = false;
    // Serialized: a second script must not interleave its moves with the first,
    // which would leave the user watching two half-sequences at once.
    let running: Promise<void> = Promise.resolve();

    const run = async (scriptId: string, targets: string[]) => {
      /** Moves after `from` never ran; say so rather than leaving them silent. */
      const reportRemaining = (from: number) => {
        for (const target of targets.slice(from)) {
          recordRef.current(scriptId, target, 'skipped');
        }
      };

      for (const [index, target] of targets.entries()) {
        if (cancelled) return reportRemaining(index);
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, UNSYNCED_STEP_GAP_MS));
          if (cancelled) return reportRemaining(index);
        }
        // Read here rather than at the top of the iteration: the gap above is
        // most of the sequence's life, and someone unticking during it means to
        // stop the move that gap was leading to.
        if (!readAgentNavigationEnabled()) {
          for (const remaining of targets.slice(index)) {
            recordRef.current(scriptId, remaining, 'blocked');
          }
          return;
        }
        const navTestId = targetTestId(target);
        if (navTestId) highlightRef.current?.(navTestId);
        const outcome = await executeTarget(target, navRef.current, {
          highlight: (testId) => highlightRef.current?.(testId),
        });
        recordRef.current(scriptId, target, outcome);
        if (outcome !== 'done' && outcome !== 'clicked') {
          console.warn(`[consoleScript] ${target} did not resolve: ${outcome}`);
        }
      }
    };

    const unsubscribe = subscribeToAssistantActionStream(assistantId, {
      onMessage: (data) => {
        let targets: string[] = [];
        let scriptId = '';
        try {
          const parsed = JSON.parse(data) as {
            type?: string;
            data?: { scriptId?: unknown; steps?: Array<{ target?: unknown }> };
          };
          if (parsed.type !== 'ConsoleScript') return;
          scriptId = typeof parsed.data?.scriptId === 'string' ? parsed.data.scriptId : '';
          targets = (parsed.data?.steps ?? [])
            .map((step) => step.target)
            .filter((target): target is string => typeof target === 'string');
        } catch {
          return;
        }
        if (targets.length === 0) return;
        // The stream reaches every open tab, so exactly one acts on it. Decided
        // once, here, rather than per step: a sequence belongs to the tab the
        // user was in when it arrived, and half a sequence in each of two tabs
        // is worse than all of it in one. A tab that stands down is silent --
        // reporting from all of them would tell the teammate the same outcome
        // several times over.
        if (!isActiveConsoleTab()) return;
        running = running.then(() => run(scriptId, targets));
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
      // Whatever was mid-sequence stops here; report it before the listener goes.
      flush();
    };
  }, [assistantId, enabled, flush]);
}
