/**
 * Showing that the assistant pressed something.
 *
 * Without this the page simply changes, which is indistinguishable from the app
 * doing it on its own — and a teammate clicking around someone else's screen
 * needs to be visible as exactly that. Presentation only: the element is read,
 * never clicked, so a missing one costs the animation and nothing else.
 */

import { waitForTestId } from '@/lib/agent-guidance/leafClick';

const PRESS_CLASS = 'agent-press';
const PRESS_MS = 750;

/**
 * How long to wait for the control to exist.
 *
 * Some controls only render after the move that reveals them — the billing
 * sub-nav does not exist until billing is open — so the press is shown once
 * they arrive rather than skipped for being early.
 */
const APPEAR_TIMEOUT_MS = 1500;

function play(element: HTMLElement): void {
  element.classList.remove(PRESS_CLASS);
  // Reading offsetWidth restarts the animation when the same control is pressed
  // twice in one script.
  void element.offsetWidth;
  element.classList.add(PRESS_CLASS);
  element.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });

  window.setTimeout(() => element.classList.remove(PRESS_CLASS), PRESS_MS);
}

/** Animate a press on the control with this test id, once it is on screen. */
export function flashElement(testId: string): void {
  if (typeof document === 'undefined') return;

  const existing = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (existing) {
    play(existing);
    return;
  }

  void waitForTestId(testId, APPEAR_TIMEOUT_MS).then((element) => {
    if (element) play(element);
  });
}
