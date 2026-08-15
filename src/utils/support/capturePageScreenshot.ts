/**
 * Capture the current page as a PNG data URL for support tickets.
 *
 * html2canvas struggles with mask-image, mix-blend-mode, backdrop-filter, and
 * color-mix in light mode — the onclone hook neutralizes those before rasterization.
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
    const { default: html2canvas } = await import('html2canvas');
    const target =
      (document.querySelector('[data-testid="settings-subrail"]')
        ?.parentElement as HTMLElement | null) ??
      (document.querySelector('main') as HTMLElement | null) ??
      (document.body as HTMLElement);

    const bgColor =
      getComputedStyle(target).backgroundColor ||
      getComputedStyle(document.body).backgroundColor ||
      getComputedStyle(document.documentElement).backgroundColor;

    const render = html2canvas(target, {
      logging: false,
      useCORS: true,
      backgroundColor: bgColor,
      scale: Math.max(1, window.devicePixelRatio * 0.5),
      ignoreElements: (el) => {
        const node = el as HTMLElement;
        if (node.getAttribute?.('role') === 'dialog') return true;
        if (node.classList?.contains(SCREENSHOT_IGNORE_CLASS)) return true;
        if (node.dataset?.testid === 'mock-mode-indicator') return true;
        return false;
      },
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.textContent = `
          .brand-page-stencil-bg::before,
          .brand-page-stencil-bg::after,
          .brand-chat-stencil-bg::before,
          .brand-chat-stencil-bg::after {
            display: none !important;
            content: none !important;
          }
          .brand-page-stencil-bg,
          .brand-chat-stencil-bg {
            background-image: none !important;
          }
          * {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            mask-image: none !important;
            -webkit-mask-image: none !important;
            mix-blend-mode: normal !important;
          }
        `;
        clonedDoc.head.appendChild(style);

        clonedDoc
          .querySelectorAll('.brand-page-stencil-bg, .brand-chat-stencil-bg')
          .forEach((node) => {
            const el = node as HTMLElement;
            el.classList.remove('brand-page-stencil-bg', 'brand-chat-stencil-bg');
            const resolved = clonedDoc.defaultView?.getComputedStyle(el).backgroundColor;
            if (resolved && resolved !== 'rgba(0, 0, 0, 0)') {
              el.style.backgroundColor = resolved;
            }
          });

        // Transparent elements are given their nearest painted ancestor's
        // colour. Walking in document order means that colour is already
        // known by the time a child is reached, so each element costs a
        // single style resolution rather than one for itself and one for
        // its parent — the dominant cost of this hook on a dense view.
        const view = clonedDoc.defaultView;
        if (!view) return;
        const painted = new Map<Element, string>();

        clonedDoc.querySelectorAll('*').forEach((node) => {
          const el = node as HTMLElement;
          let background = view.getComputedStyle(el).backgroundColor;

          if (background === 'rgba(0, 0, 0, 0)') {
            const parentBg = el.parentElement ? painted.get(el.parentElement) : bgColor;
            if (parentBg && parentBg !== 'rgba(0, 0, 0, 0)') {
              el.style.backgroundColor = parentBg;
              background = parentBg;
            }
          }

          painted.set(el, background);
        });
      },
    });

    // The render is settled here rather than by the race, so a rejection
    // arriving after the timeout has already given up stays handled.
    const canvas = await Promise.race([
      render.catch((error) => {
        console.warn('[support] screenshot capture failed', error);
        return null;
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS)),
    ]);
    if (!canvas) return null;

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.length > 100 ? dataUrl : null;
  } catch (error) {
    console.warn('[support] screenshot capture failed', error);
    return null;
  }
}
