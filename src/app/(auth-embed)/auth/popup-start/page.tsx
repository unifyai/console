'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import LoadingElement from '@/components/Common/Loaders/LoadingElement';
import { isAuthPopupProvider, safeAuthPopupCallbackUrl } from '@/lib/auth/popup';

function PopupStart() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | undefined>();
  const provider = searchParams?.get('provider');

  // Guards against launching more than one sign-in. Re-renders (App Router
  // search-param identity churn, session settling, dev StrictMode) can run this
  // effect repeatedly; two concurrent signIn() calls race on the CSRF
  // token, and the loser paints the error screen for ~0.5s before the winner
  // redirects to the provider. A single in-flight call avoids that flash while
  // still completing the redirect.
  const signInStartedRef = useRef(false);

  useEffect(() => {
    if (signInStartedRef.current) return;

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

    signInStartedRef.current = true;

    async function startOAuth() {
      try {
        const result = await signIn(providerId, { callbackUrl, redirect: false });

        if (!result?.url || result.error || result.url.includes('/api/auth/error')) {
          setError(
            'Could not start this sign-in method. Check the OAuth credentials for this environment.'
          );
          return;
        }

        window.location.href = result.url;
      } catch {
        setError(
          'Could not start this sign-in method. Check the OAuth credentials for this environment.'
        );
      }
    }

    void startOAuth();
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
