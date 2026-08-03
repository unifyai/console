/**
 * Telling the assistant what actually happened to the moves it asked for.
 *
 * Without this the runtime is steering blind: it says "and there it is" whether
 * or not the control was there, which is the one failure mode worse than not
 * offering to navigate at all. A report is only useful if it distinguishes the
 * three ways a move can not happen — the control was missing, the user had
 * switched the feature off, or the speech never reached it — because the
 * assistant should say something different about each.
 */

/** What became of one requested move. */
export type ConsoleStepOutcome =
  /** Navigation performed. */
  | 'done'
  /** A control was found and pressed. */
  | 'clicked'
  /** Named a target this console does not offer. */
  | 'unknown'
  /** The control never appeared — moved, renamed, or the list was empty. */
  | 'not-found'
  /** Present but disabled, so pressing it would have done nothing. */
  | 'not-interactive'
  /** The user has navigation turned off. */
  | 'blocked'
  /** Never reached: the user cut in, or a newer line superseded this one. */
  | 'skipped';

export interface ConsoleStepReport {
  target: string;
  outcome: ConsoleStepOutcome;
}

/** Outcomes that mean the move did not land and the assistant should know. */
const FAILURES: ReadonlySet<ConsoleStepOutcome> = new Set([
  'unknown',
  'not-found',
  'not-interactive',
]);

export function isFailure(outcome: ConsoleStepOutcome): boolean {
  return FAILURES.has(outcome);
}

/** Whether any move in a script needs the assistant's attention. */
export function scriptFailed(reports: readonly ConsoleStepReport[]): boolean {
  return reports.some((report) => isFailure(report.outcome));
}

/**
 * How long to wait after the last move before reporting.
 *
 * A script's moves land seconds apart when they are timed to speech, so
 * reporting each one separately would be a stream of near-identical events. One
 * report per script, once it has settled, gives the assistant the whole picture
 * in the shape it would want to talk about anyway.
 */
export const OUTCOME_FLUSH_MS = 1200;
