'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import LoadingElement from '@/components/Common/Loaders/LoadingElement';
import { isAuthPopupProvider, safeAuthPopupCallbackUrl } from '@/lib/auth/popup';

function PopupStart() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | undefined>();
  const provider = searchParams?.get('provider');

  useEffect(() => {
    if (!isAuthPopupProvider(provider)) {
      setError('Unsupported auth provider.');
      return;
    }
    const providerId = provider;

    const safeCallbackUrl = safeAuthPopupCallbackUrl(
      searchParams?.get('callbackUrl') ?? null,
      window.location.origin
    );

    if (!safeCallbackUrl) {
      setError('Invalid sign-in callback.');
      return;
    }
    const callbackUrl = safeCallbackUrl;

    let cancelled = false;

    async function startOAuth() {
      try {
        const result = await signIn(providerId, { callbackUrl, redirect: false });

        if (cancelled) return;

        if (!result?.url || result.error || result.url.includes('/api/auth/error')) {
          setError(
            'Could not start this sign-in method. Check the OAuth credentials for this environment.'
          );
          return;
        }

        window.location.href = result.url;
      } catch {
        if (cancelled) return;
        setError(
          'Could not start this sign-in method. Check the OAuth credentials for this environment.'
        );
      }
    }

    void startOAuth();

    return () => {
      cancelled = true;
    };
  }, [provider, searchParams]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-center text-foreground">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-h1 text-semibold mb-2">Couldn&apos;t start sign in</h1>
          <p className="text-body-muted">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <LoadingElement />
        <p className="text-body-muted">Opening secure sign in...</p>
      </div>
    </main>
  );
}

export default function PopupStartPage() {
  return (
    <Suspense fallback={<LoadingElement />}>
      <PopupStart />
    </Suspense>
  );
}
