'use client';

import React from 'react';
import Link from 'next/link';

import { Button } from '@/components/UI/button';

/**
 * Stripe Checkout success redirect for the signup trial.
 *
 * The subscription link + credit grant are applied server-side by the
 * `checkout.session.completed` webhook, so this page is purely
 * informational: confirm the trial, restate the auto-charge terms, and
 * point at billing settings for cancellation.
 */
export default function TrialStartedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-xl">
        <h1 className="text-h1 text-semibold">Your trial has started 🎉</h1>
        <p className="text-body-muted mt-3">
          Your card is on file and your free trial is live, with trial credits ready to use.
        </p>
        <p className="text-body-muted mt-2">
          When the trial ends, your monthly subscription starts automatically. You can cancel any
          time before then from billing settings and you won&apos;t be charged.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/">Go to your workspace</Link>
        </Button>
      </div>
    </div>
  );
}
