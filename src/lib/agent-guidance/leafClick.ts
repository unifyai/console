/**
 * Pressing a leaf control, once it exists.
 *
 * Unlike a navigation target, a leaf lives inside a page and only exists after
 * the move before it has landed and rendered. So it is resolved against the live
 * DOM at the moment it is due rather than planned for in advance — which is also
 * what makes a removed control fail loudly here instead of quietly matching
 * something else.
 */

/** How long to wait for a control to appear after the move that reveals it. */
export const LEAF_RESOLVE_TIMEOUT_MS = 3000;

export type LeafClickOutcome = 'clicked' | 'not-found' | 'not-interactive';

function isInteractive(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;
  // checkVisibility covers display:none, visibility:hidden and content-visibility
  // on any ancestor. It is absent outside a real browser, where there is no
  // layout to ask about and the checks above are all that can be known.
  if (typeof element.checkVisibility === 'function') return element.checkVisibility();
  return true;
}

/** Wait for a test id to appear, up to `timeoutMs`. */
export function waitForTestId(
  testId: string,
  timeoutMs: number = LEAF_RESOLVE_TIMEOUT_MS
): Promise<HTMLElement | null> {
  const selector = `[data-testid="${testId}"]`;
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (element: HTMLElement | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(element);
    };

    const observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) finish(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = window.setTimeout(() => finish(null), timeoutMs);
  });
}

/**
 * Click the control, once it is there and usable.
 *
 * Returns what happened rather than a boolean, so the caller can say something
 * true about a control that has moved instead of narrating a click that never
 * landed.
 */
export async function clickLeafTarget(
  testId: string,
  options: { timeoutMs?: number; highlight?: (testId: string) => void } = {}
): Promise<LeafClickOutcome> {
  const element = await waitForTestId(testId, options.timeoutMs);
  if (!element) return 'not-found';
  if (!isInteractive(element)) return 'not-interactive';

  // Presentational, and absent outside a real browser: never let it stop the click.
  element.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  options.highlight?.(testId);
  element.click();
  return 'clicked';
}
