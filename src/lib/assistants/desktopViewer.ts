/**
 * Naming for the viewers of an assistant's desktop.
 *
 * Two kinds of thing watch it at once — a call, where every participant mounts
 * the liveview for itself, and the Desktop tab, which opens the same surface
 * with no call at all. The runtime therefore tracks a set of viewers rather than
 * one boolean, and closes them by source: a call ending drops what that call
 * owned and leaves a Desktop tab watching.
 *
 * The two are scoped differently, which is what the source decides. A call is
 * one switch for the whole room: the runtime keys it to the call and ignores the
 * `viewerUserId` sent alongside, so any participant may put the desktop up and
 * any participant may take it down again. A Desktop tab is per person, where the
 * tally is the point — two people with the pane open are two viewers.
 */

/** Viewer source for the standalone Desktop tab (no call involved). */
export const DESKTOP_PANE_VIEWER_SOURCE = 'desktop_pane';

/** Viewer source for a call showing the desktop to everyone in it. */
export function callViewerSource(callId: string): string {
  return `call:${callId}`;
}
