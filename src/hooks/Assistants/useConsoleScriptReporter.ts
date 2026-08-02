'use client';

import * as React from 'react';
import {
  OUTCOME_FLUSH_MS,
  type ConsoleStepOutcome,
  type ConsoleStepReport,
} from '@/lib/agent-guidance/consoleScriptOutcome';
import { reportConsoleScriptResult } from '@/lib/client/console-script-result';

type Send = typeof reportConsoleScriptResult;

/**
 * Collects a script's outcomes and reports them once it settles.
 *
 * Both executors report through here so the runtime sees the same shape whether
 * the moves were timed to speech or walked at a fixed pace. Reporting is
 * deferred rather than immediate because a script's moves land seconds apart:
 * one report describing the whole thing is what the assistant would want to
 * talk about, where a stream of single-step events is not.
 *
 * A new script flushes the previous one first. Its moves are over either way,
 * and holding them back would attribute them to the line now being spoken.
 */
export function useConsoleScriptReporter(
  assistantId: string | null | undefined,
  options: { send?: Send; flushMs?: number } = {}
): {
  record: (scriptId: string, target: string, outcome: ConsoleStepOutcome) => void;
  flush: () => void;
} {
  const { send = reportConsoleScriptResult, flushMs = OUTCOME_FLUSH_MS } = options;

  const assistantIdRef = React.useRef(assistantId);
  const sendRef = React.useRef(send);
  React.useEffect(() => {
    assistantIdRef.current = assistantId;
    sendRef.current = send;
  }, [assistantId, send]);

  const pendingRef = React.useRef<{ scriptId: string; reports: ConsoleStepReport[] } | null>(null);
  const timerRef = React.useRef<number | null>(null);

  const flush = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    const currentAssistantId = assistantIdRef.current;
    if (!pending || !currentAssistantId) return;
    void sendRef.current({
      assistantId: currentAssistantId,
      scriptId: pending.scriptId,
      reports: pending.reports,
    });
  }, []);

  const record = React.useCallback(
    (scriptId: string, target: string, outcome: ConsoleStepOutcome) => {
      if (pendingRef.current && pendingRef.current.scriptId !== scriptId) flush();
      if (!pendingRef.current) pendingRef.current = { scriptId, reports: [] };
      pendingRef.current.reports.push({ target, outcome });

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, flushMs);
    },
    [flush, flushMs]
  );

  // A script settling as the user navigates away still happened; report it
  // rather than losing it with the component.
  React.useEffect(() => () => flush(), [flush]);

  return { record, flush };
}
