/**
 * Capture the current page as a PNG data URL for support tickets.
 *
 * html2canvas struggles with mask-image, mix-blend-mode, backdrop-filter, and
 * color-mix in light mode — the onclone hook neutralizes those before rasterization.
 */
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

    const canvas = await html2canvas(target, {
      logging: false,
      useCORS: true,
      backgroundColor: bgColor,
      scale: Math.max(1, window.devicePixelRatio * 0.5),
      ignoreElements: (el) => {
        const node = el as HTMLElement;
        if (node.getAttribute?.('role') === 'dialog') return true;
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

        clonedDoc.querySelectorAll('*').forEach((node) => {
          const el = node as HTMLElement;
          const computed = clonedDoc.defaultView?.getComputedStyle(el);
          if (!computed) return;

          if (
            computed.backgroundColor.includes('color-mix') ||
            computed.backgroundColor === 'rgba(0, 0, 0, 0)'
          ) {
            const parentBg = el.parentElement
              ? clonedDoc.defaultView?.getComputedStyle(el.parentElement).backgroundColor
              : bgColor;
            if (parentBg && parentBg !== 'rgba(0, 0, 0, 0)') {
              el.style.backgroundColor = parentBg;
            }
          }
        });
      },
    });

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.length > 100 ? dataUrl : null;
  } catch (error) {
    console.warn('[support] screenshot capture failed', error);
    return null;
  }
}
