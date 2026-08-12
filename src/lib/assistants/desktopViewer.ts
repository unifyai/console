/**
 * Naming for the viewers of an assistant's desktop.
 *
 * Several people can have the same desktop open at once — every participant in
 * a room call mounts the liveview for itself, and the Desktop tab opens the
 * same surface with no call at all. The runtime therefore tracks a set of
 * viewers rather than one boolean, and closes them by source: a call ending
 * drops the viewers that call owned and leaves a Desktop tab watching.
 *
 * The runtime splits a viewer key on the first `:`, so a source must not
 * contain one beyond the `call:<id>` form below.
 */

/** Viewer source for the standalone Desktop tab (no call involved). */
export const DESKTOP_PANE_VIEWER_SOURCE = 'desktop_pane';

/** Viewer source for someone watching from inside a call. */
export function callViewerSource(callId: string): string {
  return `call:${callId}`;
}
