/**
 * Deep links that open one root action on its own.
 *
 * `?action=` names the root action's calling_id and `?actionWindow=` carries
 * the originating tab's history window, so the new tab loads a range that
 * actually contains the action rather than the default lookback.
 */

export const ACTION_DEEP_LINK_PARAM = 'action';
export const ACTION_DEEP_LINK_WINDOW_PARAM = 'actionWindow';

const ASSISTANTS_PATH = '/assistants';

export interface ActionDeepLink {
  callingId: string;
  timeWindowKey: string | null;
}

export function buildActionDeepLinkUrl(
  agentId: string,
  callingId: string,
  timeWindowKey: string
): string {
  const params = new URLSearchParams({
    profile: agentId,
    [ACTION_DEEP_LINK_PARAM]: callingId,
    [ACTION_DEEP_LINK_WINDOW_PARAM]: timeWindowKey,
  });
  return `${ASSISTANTS_PATH}?${params.toString()}`;
}

/**
 * Reads the deep link off the address bar. Uses `window.location` rather than
 * the router's params so it settles on the very first render, before the
 * assistants surface has finished claiming the URL.
 */
export function readActionDeepLink(): ActionDeepLink | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const callingId = params.get(ACTION_DEEP_LINK_PARAM);
  if (!callingId) return null;
  return { callingId, timeWindowKey: params.get(ACTION_DEEP_LINK_WINDOW_PARAM) };
}
