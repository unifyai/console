'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import LoadingElement from '@/components/Common/Loaders/LoadingElement';

const POPUP_MESSAGE_TYPE = 'unify.auth.popup.success';
const STATIC_ALLOWED_OPENER_ORIGINS = [
  'https://unify.ai',
  'https://www.unify.ai',
  'https://staging.unify.ai',
  'https://internal.example.com',
  'http://localhost:3007',
];

function allowedOpenerOrigin(rawOrigin: string | null): string | null {
  if (!rawOrigin) return null;

  try {
    const origin = new URL(rawOrigin).origin;
    const allowed = new Set(
      [...STATIC_ALLOWED_OPENER_ORIGINS, process.env.NEXT_PUBLIC_SITE_URL].filter(Boolean)
    );

    return allowed.has(origin) ? origin : null;
  } catch {
    return null;
  }
}

function PopupComplete() {
  const searchParams = useSearchParams();
  const [canClose, setCanClose] = useState(false);
  const openerOrigin = useMemo(
    () => allowedOpenerOrigin(searchParams?.get('openerOrigin') ?? null),
    [searchParams]
  );
  const redirectUrl = useMemo(() => {
    const redirectTo = searchParams?.get('redirectTo');
    if (!redirectTo) return null;

    try {
      const parsed = new URL(redirectTo);
      return parsed.origin === window.location.origin ? parsed.toString() : null;
    } catch {
      return null;
    }
  }, [searchParams]);

  useEffect(() => {
    const safeRedirectUrl = redirectUrl ?? `${window.location.origin}/assistants`;

    if (window.opener && !window.opener.closed && openerOrigin) {
      window.opener.postMessage(
        { type: POPUP_MESSAGE_TYPE, redirectUrl: safeRedirectUrl },
        openerOrigin
      );
      setCanClose(true);
      window.setTimeout(() => window.close(), 250);
      return;
    }

    window.location.href = safeRedirectUrl;
  }, [openerOrigin, redirectUrl]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8 text-center text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <LoadingElement />
        <h1 className="text-h1 text-semibold">
          {canClose ? 'Sign in complete' : 'Taking you to Unify...'}
        </h1>
        <p className="text-body-muted">
          {canClose ? 'You can close this window.' : 'Please wait a moment.'}
        </p>
      </div>
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
