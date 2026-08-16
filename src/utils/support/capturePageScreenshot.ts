/**
 * Capture the current page as a PNG data URL for support tickets.
 *
 * Rasterization goes through html-to-image, which serializes the subtree into
 * an SVG `foreignObject` and lets the browser paint it. Handing the painting
 * back to the engine is the point: a rasterizer that reimplements CSS parsing
 * has to keep pace with the colour syntax the theme is written in, and Chrome
 * resolves `color-mix()` to `color(srgb …)` and leaves `oklch()` as it is —
 * neither of which a parser limited to `rgb()`/`hsl()` can read. The same goes
 * for `mask-image`, `mix-blend-mode` and `backdrop-filter`, which need no
 * neutralizing here because nothing reinterprets them.
 */

/** Marks chrome that must stay out of the shot, e.g. the report dialog's own backdrop. */
export const SCREENSHOT_IGNORE_CLASS = 'support-screenshot-ignore';

/**
 * Rasterizing a dense view takes seconds, and an image that never resolves
 * would otherwise leave the capture pending forever. Past this, the ticket is
 * worth more than the attachment.
 */
const CAPTURE_TIMEOUT_MS = 15_000;

export async function capturePageScreenshot(): Promise<string | null> {
  try {
    const { toPng } = await import('html-to-image');
    // The shell's `main` is the whole view — rail, header and content — and
    // every pane the app can route to lives inside it.
    const target =
      (document.querySelector('main') as HTMLElement | null) ?? (document.body as HTMLElement);

    const bgColor =
      getComputedStyle(target).backgroundColor ||
      getComputedStyle(document.body).backgroundColor ||
      getComputedStyle(document.documentElement).backgroundColor;

    const render = toPng(target, {
      backgroundColor: bgColor,
      pixelRatio: Math.max(1, window.devicePixelRatio * 0.5),
      // Keeps a node when true, and dropping one drops its subtree with it.
      // Every child node is offered, text nodes included, so each test has to
      // tolerate a node with no element API.
      filter: (node) => {
        const el = node as HTMLElement;
        if (el.getAttribute?.('role') === 'dialog') return false;
        if (el.classList?.contains(SCREENSHOT_IGNORE_CLASS)) return false;
        if (el.dataset?.testid === 'mock-mode-indicator') return false;
        return true;
      },
    });

    // The render is settled here rather than by the race, so a rejection
    // arriving after the timeout has already given up stays handled.
    const dataUrl = await Promise.race([
      render.catch((error) => {
        console.warn('[support] screenshot capture failed', error);
        return null;
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS)),
    ]);

    return dataUrl && dataUrl.length > 100 ? dataUrl : null;
  } catch (error) {
    console.warn('[support] screenshot capture failed', error);
    return null;
  }
}
