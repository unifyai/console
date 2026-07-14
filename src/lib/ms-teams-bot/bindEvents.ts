/**
 * Client-side signal that an MS Teams bot install was just bound.
 *
 * The deep-link auto-bind (in the assistants shell) writes the bind straight
 * to Orchestra, so the surfaces that render the connected state from
 * server-prefetched data — the profile's Teams section and the shell's
 * ``userMeta`` — would otherwise stay stale until a full reload. Broadcasting
 * this event lets those surfaces re-read the current install in place.
 */

export const MS_TEAMS_BOT_BOUND_EVENT = 'unify:ms-teams-bot-bound';

export function broadcastMsTeamsBotBound(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MS_TEAMS_BOT_BOUND_EVENT));
}

export function subscribeMsTeamsBotBound(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(MS_TEAMS_BOT_BOUND_EVENT, listener);
  return () => window.removeEventListener(MS_TEAMS_BOT_BOUND_EVENT, listener);
}
