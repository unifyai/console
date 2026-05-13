'use client';

import React from 'react';
import Image from 'next/image';
import ErrorImage from '@/public/images/404.png';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Forward the boundary capture to Cloud Run stdout via the
  // `/api/client-errors` sink so support can reach the digest /
  // message / stack via `gcloud logging read` after the fact,
  // without the user having to copy-paste anything into a ticket.
  //
  // We deliberately do NOT bolt this onto outgoing support tickets:
  // a user filing a ticket about (e.g.) a billing question after an
  // earlier unrelated boundary capture would otherwise have the
  // stale digest attached as if it were the cause.  Cloud Logging
  // is the right surface — responders can correlate by user email
  // and timestamp when, and only when, a ticket actually looks
  // crash-shaped.
  //
  // `keepalive: true` so the fetch survives an immediate tab close
  // — the boundary is, by definition, the last thing the user saw
  // on this route.
  React.useEffect(() => {
    const pageUrl = typeof window !== 'undefined' ? window.location.pathname : null;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    try {
      fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: error.digest ?? null,
          message: error.message,
          stack: error.stack ?? null,
          pageUrl,
          userAgent,
        }),
        keepalive: true,
      }).catch(() => {
        /* best-effort; never let logging crash the error UI */
      });
    } catch {
      /* fetch unavailable in some edge cases (e.g. older test runners) */
    }
  }, [error]);

  return (
    <div className="mt-32 flex justify-center">
      <div className="flex max-w-xl flex-col items-center gap-2 text-center">
        <Image src={ErrorImage} className="max-w-xl" alt="Unify Logo" />
        <h1 className="text-h1 text-strong">Something went wrong</h1>
        <p className="text-body">{"It's not your fault"}</p>
        <p className="text-body-dense text-muted-foreground">{error.message}</p>
        <p className="text-body-dense text-muted-foreground">
          {'Feel free to contact us and provide the following error digest: '}
          {error.digest}
        </p>
        <button
          onClick={reset}
          className="text-label mt-4 rounded-md bg-accent p-2 uppercase text-accent-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
