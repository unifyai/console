/**
 * Places in the console the assistant may take the user to, and the script it
 * sends to do so.
 *
 * Navigation only. Every target resolves to a call on the shell router, never a
 * synthesized DOM click, so a target either exists in the registry or does not
 * exist at all — there is no half-state where a stale selector clicks the wrong
 * thing. Controls that only exist as buttons stay out until they carry an
 * explicit opt-in.
 */

/** A place the assistant can take the user. */
export interface ConsoleActionTarget {
  /** Stable id the runtime names in a script, e.g. `section:integrations`. */
  id: string;
  /** What the user sees when they arrive, for the runtime to speak about. */
  label: string;
  /** One line on what lives there, so the runtime picks the right one. */
  description: string;
}

/** One step of a script: go somewhere, at a point in the spoken line. */
export interface ConsoleActionStep {
  /** Target id, which must appear in the catalogue the runtime was given. */
  target: string;
  /**
   * Characters into the spoken line, with markers removed, at which this step
   * should fire. Console counts synchronized transcript characters against it,
   * so the move lands on the words rather than on a timer.
   */
  afterChars: number;
}

/** A whole choreography, published once before the line begins playing. */
export interface ConsoleActionScript {
  /** Identifies the utterance, so a superseded script can be dropped. */
  scriptId: string;
  /** The spoken line with markers stripped — what `afterChars` indexes into. */
  spokenText: string;
  steps: ConsoleActionStep[];
}
