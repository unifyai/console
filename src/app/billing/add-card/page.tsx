'use client';

import React from 'react';

import { startTrialCheckout } from '@/lib/billing/billing';
import { Button } from '@/components/UI/button';

/**
 * Re-entry point when the user abandons the signup trial Checkout
 * (Stripe's cancel_url). Restates the terms and offers to reopen the
 * checkout; the workspace stays gated until it completes.
 */
export default function AddCardPage() {
  const [redirecting, setRedirecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onRetry = async () => {
    setRedirecting(true);
    setError(null);
    const result = await startTrialCheckout();
    if ('detail' in result) {
      setError(result.detail);
      setRedirecting(false);
      return;
    }
    window.location.href = result.checkoutUrl;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-xl">
        <h1 className="text-h1 text-semibold">Add a card to continue</h1>
        <p className="text-body-muted mt-3">
          Your workspace unlocks once a payment method is on file. The first week is free with trial
          credits included; after that your subscription starts at the monthly plan price shown at
          checkout unless you cancel first.
        </p>
        {error ? <p className="text-body text-error mt-3">{error}</p> : null}
        <Button className="mt-6 w-full" onClick={onRetry} disabled={redirecting}>
          {redirecting ? 'Opening secure checkout…' : 'Open secure checkout'}
        </Button>
        <p className="text-caption mt-3 text-center">Payments are processed securely by Stripe.</p>
      </div>
    </div>
  );
}
