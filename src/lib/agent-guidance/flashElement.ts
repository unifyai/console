/**
 * A brief ring on the control a navigation move lands on.
 *
 * This is the part that makes an assistant-driven move legible rather than the
 * page just changing under the user. It is presentation only: the element is
 * read, never clicked, so a missing one costs the flash and nothing else.
 */

const FLASH_CLASS = 'agent-move-flash';
const FLASH_MS = 900;

export function flashElement(testId: string): void {
  if (typeof document === 'undefined') return;
  const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!element) return;

  element.classList.remove(FLASH_CLASS);
  // Reading offsetWidth restarts the animation when the same control is hit
  // twice in one script.
  void element.offsetWidth;
  element.classList.add(FLASH_CLASS);
  element.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });

  window.setTimeout(() => element.classList.remove(FLASH_CLASS), FLASH_MS);
}
