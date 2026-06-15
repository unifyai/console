'use client';

import React from 'react';
import { BrandFallback } from './BrandFallback';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        digest: error.digest ?? null,
        message: error.message,
        stack: error.stack ?? null,
        pageUrl: window.location.pathname,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <BrandFallback
      actionLabel="Try again"
      apology="Sorry about that. We're working on a fix now."
      description="The console hit a snag while loading this view. Try again, or head back to the console while the droid resets."
      eyebrow="System hiccup"
      onAction={reset}
      title="A droid tripped over a loose cable"
    />
  );
}
