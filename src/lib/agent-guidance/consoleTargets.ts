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
import {
  LEAF_TARGET_PREFIX,
  leafSection,
  resolveLeafTestId,
} from '@/lib/agent-guidance/leafTargets';
import { clickLeafTarget, type LeafClickOutcome } from '@/lib/agent-guidance/leafClick';

/** The slice of `useAppShellNavigation` a target needs. */
export interface TargetNavigator {
  navigateTo: (href: string) => void;
  navigateToAssistants: (options?: { sectionId?: string | null }) => void;
}

/**
 * The rail control a section lands on. Chat has no nav button — it opens from
 * the switcher's face — so it resolves there instead of to a `rail-section-*`
 * id that no longer renders.
 */
function sectionTestId(sectionId: string): string {
  return sectionId === 'chat' ? 'rail-chat-home' : `rail-section-${sectionId}`;
}

/**
 * The element a target lands on, for the brief highlight that makes the move
 * legible. Read-only: if it is absent the navigation still happens, the user
 * just does not get the flash.
 */
export function targetTestId(target: string): string | null {
  if (target.startsWith(SECTION_TARGET_PREFIX)) {
    return sectionTestId(target.slice(SECTION_TARGET_PREFIX.length));
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

/** Whether a control is on screen right now. */
function isPresent(testId: string): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector(`[data-testid="${testId}"]`) !== null;
}

/**
 * Perform a move of any kind.
 *
 * Navigation resolves from the registry and cannot miss. A leaf control has to
 * be found in the live DOM first, so it is awaited and reports what actually
 * happened — a control that has moved says so rather than passing silently.
 *
 * A control that lives in a pane the user is not on is reached by going there
 * first. The question asked is not "which pane are we on" but "is the control
 * here", which needs no view state to answer and is right by construction: if
 * the assistant already navigated in an earlier step, the control is present
 * and nothing further happens. Naming a control is therefore enough — the model
 * does not have to remember to open its pane, and cannot get the order wrong.
 */
export async function executeTarget(
  target: string,
  nav: TargetNavigator,
  options: { highlight?: (testId: string) => void } = {}
): Promise<'done' | 'unknown' | LeafClickOutcome> {
  if (!target.startsWith(LEAF_TARGET_PREFIX)) {
    return executeConsoleTarget(target, nav) ? 'done' : 'unknown';
  }

  const testId = resolveLeafTestId(target);
  if (!testId) return 'unknown';

  const section = leafSection(target);
  if (section && !isPresent(testId)) {
    // Show the hop as its own press: the pane really did change, and hiding
    // that would leave the user with a click they did not see coming.
    options.highlight?.(sectionTestId(section));
    nav.navigateToAssistants({ sectionId: section });
  }

  return clickLeafTarget(testId, { highlight: options.highlight });
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
