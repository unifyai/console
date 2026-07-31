'use client';

import React from 'react';

import { getAccessGate, startTrialCheckout } from '@/lib/billing/billing';
import { Button } from '@/components/UI/button';

/**
 * Full-screen blocker for accounts behind the card gate.
 *
 * Queried once per shell mount: when the workspace's billing account has
 * neither a live subscription nor real payment history (Orchestra
 * `GET /billing/access-gate` returns `reason: 'card_required'`), the
 * workspace is unusable until the trial Checkout completes. The overlay
 * carries the full negative-option disclosure: card required, free for
 * the trial period, then the monthly plan price auto-charges unless the
 * user cancels first (one click, in billing settings).
 */
export function TrialGateOverlay() {
  const [gated, setGated] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getAccessGate()
      .then((gate) => {
        if (cancelled || 'detail' in gate) return;
        setGated(!gate.allowed && gate.reason === 'card_required');
      })
      .catch(() => {
        // Gate lookup failing must never lock a paying user out of the
        // UI — enforcement lives server-side in the LLM path.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!gated) return null;

  const onAddCard = async () => {
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
    <div className="bg-background/95 fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-xl">
        <h2 className="text-h2 text-semibold">Start your free trial</h2>
        <p className="text-body-muted mt-3">
          Add a payment method to unlock your workspace. Your first week is free, with trial credits
          included.
        </p>
        <p className="text-body-muted mt-2">
          After the trial your subscription starts automatically at the monthly plan price shown at
          checkout. Cancel any time before the trial ends — one click in billing settings — and you
          won&apos;t be charged.
        </p>
        {error ? <p className="text-body text-error mt-3">{error}</p> : null}
        <Button className="mt-6 w-full" onClick={onAddCard} disabled={redirecting}>
          {redirecting ? 'Opening secure checkout…' : 'Add card & start free trial'}
        </Button>
        <p className="text-caption mt-3 text-center">Payments are processed securely by Stripe.</p>
      </div>
    </div>
  );
}
