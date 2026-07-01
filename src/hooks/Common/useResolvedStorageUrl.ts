'use client';

import * as React from 'react';

const signedUrlCache = new Map<string, string>();

/** Resolves a public URL or GCS path to a fetchable image URL. */
export function useResolvedStorageUrl(source: string | null | undefined): string | null {
  const cached = source
    ? (signedUrlCache.get(source) ?? (source.startsWith('gs://') ? null : source))
    : null;
  const [url, setUrl] = React.useState<string | null>(cached);

  React.useEffect(() => {
    if (!source) {
      setUrl(null);
      return;
    }
    if (signedUrlCache.has(source)) {
      setUrl(signedUrlCache.get(source)!);
      return;
    }
    if (!source.startsWith('gs://')) {
      setUrl(source);
      return;
    }
    let cancelled = false;
    fetch('/api/storage/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      body: JSON.stringify({ gs_url: source }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.signed_url) {
          signedUrlCache.set(source, data.signed_url);
          setUrl(data.signed_url);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source]);

  return url;
}
