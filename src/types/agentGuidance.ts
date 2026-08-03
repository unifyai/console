/** Console-authored orientation text handed to the assistant runtime. */
export interface ConsoleGuidance {
  /**
   * Content hash of `brief` + `full`. Changes whenever the console's surfaces
   * or guidance policy change, so the runtime can cache against it.
   */
  version: string;
  /** Surface names and purposes. Used for regular assistants. */
  brief: string;
  /** `brief` plus per-surface usage hints. Used for the coordinator. */
  full: string;
}
