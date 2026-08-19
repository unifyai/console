import * as React from 'react';
import { fetchProfileSignedUrls, readProfileSignedUrls } from '@/lib/client/profileMedia';

/**
 * Profile media is stored as `gs://` URIs, which no browser can load — every
 * face needs a short-lived signed URL first. `useOrgRoster` signs the whole
 * roster in one batch when it lands, so the cache read below almost always
 * hits and a face paints on its first frame; the fetch is the cold path for an
 * image that changed since the last poll, or a face rendered outside a roster
 * surface.
 *
 * A value that needs no signing passes through untouched, and an unresolved
 * one comes back `null` so the caller renders its initials fallback rather
 * than handing a `gs://` URI to an `<img>`.
 */

/** Cached signed URL, or the URL itself when it needs no signing. */
export function readResolvedProfileImage(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith('gs://')) return imageUrl;
  return readProfileSignedUrls([imageUrl])[imageUrl] ?? null;
}

/**
 * Resolver for a set of faces rendered together — a roster list, a member
 * collage — signing whatever the batch is missing in a single request.
 * Accepts the raw image values on each render; resolution is keyed by their
 * contents, so callers need not memoise the array.
 */
export function useProfileImageResolver(
  imageUrls: ReadonlyArray<string | null | undefined>
): (imageUrl: string | null | undefined) => string | null {
  const signableKey = Array.from(
    new Set(imageUrls.filter((url): url is string => !!url && url.startsWith('gs://')))
  )
    .sort()
    .join('\n');
  const signable = React.useMemo(() => (signableKey ? signableKey.split('\n') : []), [signableKey]);

  const [resolved, setResolved] = React.useState<Record<string, string>>(() =>
    readProfileSignedUrls(signable)
  );

  React.useEffect(() => {
    const cached = readProfileSignedUrls(signable);
    setResolved(cached);

    const missing = signable.filter((uri) => !cached[uri]);
    if (missing.length === 0) return;

    let cancelled = false;
    fetchProfileSignedUrls(missing).then((signedUrls) => {
      if (!cancelled) setResolved((prev) => ({ ...prev, ...signedUrls }));
    });
    return () => {
      cancelled = true;
    };
  }, [signable]);

  return React.useCallback(
    (imageUrl: string | null | undefined) => {
      if (!imageUrl) return null;
      if (!imageUrl.startsWith('gs://')) return imageUrl;
      return resolved[imageUrl] ?? null;
    },
    [resolved]
  );
}

/** Single-face variant for a component that renders one profile image. */
export function useResolvedProfileImage(imageUrl: string | null | undefined): string | null {
  const resolve = useProfileImageResolver([imageUrl]);
  return resolve(imageUrl);
}
