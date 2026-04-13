/**
 * Client-side tile/dashboard export utilities.
 *
 * HTML capture: postMessage-based — the inner iframe serialises its own DOM
 * (with bridge scripts stripped and canvases converted to images) and sends
 * the result back via unify-export-response.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TileCapture {
  html: string;
  title: string;
}

// ---------------------------------------------------------------------------
// PostMessage-based HTML export (for live tiles with data bindings)
// ---------------------------------------------------------------------------

/**
 * Request a live tile's rendered HTML via the postMessage export channel.
 * The inner iframe handles serialisation — guaranteed access to its own DOM.
 */
export function requestTileExport(
  iframe: HTMLIFrameElement,
  timeoutMs = 10_000
): Promise<TileCapture> {
  const exportId = Math.random().toString(36).slice(2, 14);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Export request timed out'));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      if (event.data?.type !== 'unify-export-response') return;
      if (event.data.exportId !== exportId) return;
      cleanup();
      resolve({ html: event.data.html, title: event.data.title || '' });
    }

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('message', handler);
    }

    window.addEventListener('message', handler);
    iframe.contentWindow?.postMessage({ type: 'unify-export-request', exportId }, '*');
  });
}

// ---------------------------------------------------------------------------
// Blob download helper
// ---------------------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Filename helper
// ---------------------------------------------------------------------------

/**
 * Build a download filename: title lowercased, words joined with underscores,
 * suffixed with the token (or a compact id).
 *
 *   buildFilename("Revenue Overview", "aBc12", "html")
 *     -> "revenue_overview_aBc12.html"
 */
export function buildFilename(title: string, token: string, ext: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const base = slug ? `${slug}_${token}` : token || 'download';
  return `${base}.${ext}`;
}
