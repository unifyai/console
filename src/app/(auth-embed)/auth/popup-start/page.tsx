'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { BrandStatusCard } from '@/components/Brand';
import LoadingElement from '@/components/Common/Loaders/LoadingElement';
import { isAuthPopupProvider, safeAuthPopupCallbackUrl } from '@/lib/auth/popup';

function PopupStart() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | undefined>();
  const provider = searchParams?.get('provider');

  // Launch sign-in at most once. Effect re-runs (App Router search-param
  // identity churn, session settling, dev StrictMode) would otherwise kick off
  // redundant signIn() calls.
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
        // next-auth only "supports return" for credentials/email providers. For
        // OAuth (google/azure-ad) it ignores `redirect: false`, performs the
        // navigation to the provider itself, and resolves to `undefined`. So a
        // resolved promise is the success path here and must NOT be treated as a
        // failure -- doing so painted "Couldn't start sign in" in this same
        // window for ~0.5s while next-auth's redirect was in flight. Only a
        // thrown error means sign-in genuinely could not start. The
        // `result?.url` navigation is kept as a harmless fallback for any
        // return-supporting provider.
        const result = await signIn(providerId, { callbackUrl, redirect: false });

        if (result?.url && !result.url.includes('/api/auth/error')) {
          window.location.href = result.url;
        }
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
      <main className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background p-8 text-center text-foreground">
        <BrandStatusCard
          eyebrow="Auth"
          title="Couldn't start sign in"
          description={error}
          tone="danger"
        />
      </main>
    );
  }

  return (
    <main className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <BrandStatusCard
        eyebrow="Auth"
        description="Opening secure sign in..."
        icon={<LoadingElement />}
      />
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
