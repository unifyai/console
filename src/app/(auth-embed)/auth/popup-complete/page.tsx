'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { BrandStatusCard } from '@/components/Brand';
import LoadingElement from '@/components/Common/Loaders/LoadingElement';
import {
  AUTH_POPUP_ERROR_MESSAGE,
  AUTH_POPUP_SUCCESS_MESSAGE,
  allowedAuthPopupOpenerOrigin,
  authPopupErrorMessage,
  safeAuthPopupRedirectUrl,
} from '@/lib/auth/popup';

function PopupComplete() {
  const searchParams = useSearchParams();
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    const openerOrigin = allowedAuthPopupOpenerOrigin(searchParams?.get('openerOrigin') ?? null);
    const safeRedirectUrl = safeAuthPopupRedirectUrl(
      searchParams?.get('redirectTo') ?? null,
      window.location.origin
    );
    const authError = searchParams?.get('error') ?? null;

    if (window.opener && !window.opener.closed && openerOrigin) {
      window.opener.postMessage(
        authError
          ? { type: AUTH_POPUP_ERROR_MESSAGE, message: authPopupErrorMessage(authError) }
          : { type: AUTH_POPUP_SUCCESS_MESSAGE, redirectUrl: safeRedirectUrl },
        openerOrigin
      );
      setCanClose(true);
      window.setTimeout(() => window.close(), 250);
      return;
    }

    if (authError) {
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('error', authError);
      window.location.href = loginUrl.toString();
      return;
    }

    window.location.href = safeRedirectUrl;
  }, [searchParams]);

  return (
    <main className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background p-8 text-center text-foreground">
      <BrandStatusCard
        eyebrow="Auth"
        title={canClose ? 'Sign in complete' : 'Taking you to Unify...'}
        description={canClose ? 'You can close this window.' : 'Please wait a moment.'}
        icon={<LoadingElement />}
      />
    </main>
  );
}

export default function PopupCompletePage() {
  return (
    <Suspense fallback={<LoadingElement />}>
      <PopupComplete />
    </Suspense>
  );
}
