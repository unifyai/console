'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Gift, X } from 'lucide-react';
import { DISMISS_KEY, PROMO_LABEL } from '@/components/Layout/TopBar/ReferralPromoButton';

/**
 * Centered "Refer a friend" promo pill in the top nav.
 *
 * Shows by default and links to the billing page (where the Refer & earn
 * panel lives). Dismissing it persists to `localStorage` so it stays hidden
 * across sessions / browser restarts. Rendered behind the billing-access gate
 * by {@link TopNav}, so the link always lands on a page the user can open.
 *
 * Visibility starts `false` and is enabled in an effect (post-hydration) to
 * avoid an SSR/client mismatch — `localStorage` isn't available on the server.
 */

export default function ReferralBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== '1') setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore: best-effort persistence.
    }
    setVisible(false);
  };

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block"
      data-testid="referral-banner"
    >
      <div className="rounded-control bg-muted/60 pointer-events-auto flex h-7 items-center gap-1 border border-border pl-2.5 pr-1">
        <Link
          href="/billing"
          target="_blank"
          rel="noopener noreferrer"
          className="text-body-muted flex items-center gap-1.5 transition-colors hover:text-foreground"
          data-testid="referral-banner-link"
        >
          <Gift className="h-3.5 w-3.5 shrink-0" />
          <span className="text-label">{PROMO_LABEL}</span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss referral banner"
          className="rounded-control flex h-5 w-5 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          data-testid="referral-banner-dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
