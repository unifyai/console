/**
 * Reading a console script off the wire, and deciding when each move is due.
 *
 * Kept apart from the React hook so the scheduling rule — the part with the
 * off-by-one risk — can be exercised without a room, a call, or a browser.
 */

import type { ConsoleActionScript, ConsoleActionStep } from '@/types/agentActions';

/** Data-channel topic the runtime publishes scripts on. */
export const CONSOLE_ACTIONS_TOPIC = 'console_actions';

/** LiveKit's topic for agent transcription, paced to audio playout. */
export const TRANSCRIPTION_TOPIC = 'lk.transcription';

/**
 * A beat of deliberate lag, so a move lands just after the words rather than on
 * them. Simultaneous reads as uncanny; a person says "it's under Integrations"
 * and clicks a moment later.
 */
export const STEP_LAG_MS = 200;

/** Parse a data-channel payload, or null if it is not a script for us. */
export function parseConsoleScript(payload: unknown): ConsoleActionScript | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = payload as Record<string, unknown>;
  if (data.type !== 'console_script') return null;
  if (typeof data.scriptId !== 'string' || !Array.isArray(data.steps)) return null;

  const steps: ConsoleActionStep[] = [];
  for (const raw of data.steps) {
    if (typeof raw !== 'object' || raw === null) continue;
    const step = raw as Record<string, unknown>;
    if (typeof step.target !== 'string' || typeof step.afterChars !== 'number') continue;
    steps.push({ target: step.target, afterChars: step.afterChars });
  }
  if (steps.length === 0) return null;

  return {
    scriptId: data.scriptId,
    spokenText: typeof data.spokenText === 'string' ? data.spokenText : '',
    steps,
  };
}

/**
 * Which steps have come due now that `charsSpoken` of the line have played.
 *
 * Steps already fired are named in `fired`. A step is due once playout reaches
 * its position; steps whose position is never reached — because the user cut in
 * — simply never come due, which is the behaviour we want rather than something
 * to detect separately.
 */
export function dueSteps(
  steps: ConsoleActionStep[],
  charsSpoken: number,
  fired: ReadonlySet<number>
): Array<{ index: number; step: ConsoleActionStep }> {
  const due: Array<{ index: number; step: ConsoleActionStep }> = [];
  steps.forEach((step, index) => {
    if (fired.has(index)) return;
    if (charsSpoken >= step.afterChars) due.push({ index, step });
  });
  return due;
}
