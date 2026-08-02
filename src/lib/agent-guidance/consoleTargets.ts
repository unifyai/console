/**
 * Turning a navigation target id into an actual move.
 *
 * Every target resolves to a shell-router call. Nothing here synthesizes a
 * click, so an unknown id does nothing at all rather than landing on whatever
 * happens to match a stale selector.
 */

import {
  ACCOUNT_TAB_TARGET_PREFIX,
  ROUTE_TARGET_PREFIX,
  SECTION_TARGET_PREFIX,
  isKnownTarget,
} from '@/lib/agent-guidance/actionCatalogue';
import { accountTabHref, parseAccountTab } from '@/lib/navigation/settingsAccountTab';
import { LEAF_TARGET_PREFIX, resolveLeafTestId } from '@/lib/agent-guidance/leafTargets';
import { clickLeafTarget, type LeafClickOutcome } from '@/lib/agent-guidance/leafClick';

/** The slice of `useAppShellNavigation` a target needs. */
export interface TargetNavigator {
  navigateTo: (href: string) => void;
  navigateToAssistants: (options?: { sectionId?: string | null }) => void;
}

/**
 * The element a target lands on, for the brief highlight that makes the move
 * legible. Read-only: if it is absent the navigation still happens, the user
 * just does not get the flash.
 */
export function targetTestId(target: string): string | null {
  if (target.startsWith(SECTION_TARGET_PREFIX)) {
    return `rail-section-${target.slice(SECTION_TARGET_PREFIX.length)}`;
  }
  if (target.startsWith(ACCOUNT_TAB_TARGET_PREFIX)) {
    return `settings-nav-${target.slice(ACCOUNT_TAB_TARGET_PREFIX.length)}`;
  }
  if (target.startsWith(ROUTE_TARGET_PREFIX)) {
    const path = target.slice(ROUTE_TARGET_PREFIX.length);
    // `/account` is reached from the rail foot; the rest are sub-rail entries
    // that only render once the settings shell is up, which is why the press is
    // shown when the control appears rather than when the move is issued.
    if (path === '/account') return 'rail-nav-settings';
    return `settings-link-${path.replace(/^\//, '')}`;
  }
  return null;
}

/**
 * Perform a move of any kind.
 *
 * Navigation resolves from the registry and cannot miss. A leaf control has to
 * be found in the live DOM first, so it is awaited and reports what actually
 * happened — a control that has moved says so rather than passing silently.
 */
export async function executeTarget(
  target: string,
  nav: TargetNavigator,
  options: { highlight?: (testId: string) => void } = {}
): Promise<'done' | 'unknown' | LeafClickOutcome> {
  if (target.startsWith(LEAF_TARGET_PREFIX)) {
    const testId = resolveLeafTestId(target);
    if (!testId) return 'unknown';
    return clickLeafTarget(testId, { highlight: options.highlight });
  }
  return executeConsoleTarget(target, nav) ? 'done' : 'unknown';
}

/**
 * Perform the move. Returns false when the id is not one this console offers,
 * so the caller can log it rather than silently doing nothing.
 */
export function executeConsoleTarget(target: string, nav: TargetNavigator): boolean {
  if (!isKnownTarget(target)) return false;

  if (target.startsWith(SECTION_TARGET_PREFIX)) {
    nav.navigateToAssistants({ sectionId: target.slice(SECTION_TARGET_PREFIX.length) });
    return true;
  }
  if (target.startsWith(ROUTE_TARGET_PREFIX)) {
    nav.navigateTo(target.slice(ROUTE_TARGET_PREFIX.length));
    return true;
  }
  if (target.startsWith(ACCOUNT_TAB_TARGET_PREFIX)) {
    const tab = parseAccountTab(target.slice(ACCOUNT_TAB_TARGET_PREFIX.length));
    nav.navigateTo(accountTabHref(tab));
    return true;
  }
  return false;
}
