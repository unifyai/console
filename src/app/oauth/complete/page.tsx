'use client';

/**
 * OAuth bounce page.
 *
 * Provider OAuth flows (workspace BYOD, app integrations) are started in a
 * *new tab* so the original page — and any live Coordinator call — stays
 * intact. We point the provider callback's ``redirect_after`` here instead
 * of straight back at the originating page. This page then:
 *
 *   1. Broadcasts to the original tab that the connection finished, so it
 *      can refetch and (e.g.) cross the onboarding step off without a
 *      manual refresh.
 *   2. Closes itself, returning focus to the original tab — no stray
 *      console tab left behind.
 *
 * If the popup was blocked and the flow fell back to a same-tab redirect,
 * ``window.close()`` is a no-op (the tab wasn't script-opened). In that
 * case we forward to the page the user came from with the provider's
 * result params so the original on-page handling still runs.
 */

import * as React from 'react';

import { BrandStatusCard } from '@/components/Brand';
import { Loader } from '@/components/Common/Loader';
import { broadcastOAuthComplete } from '@/utils/assistants/oauth';

const DEFAULT_RETURN_TO = '/assistants';

/**
 * Constrain ``?return=`` to a path on this origin.
 *
 * The value reaches ``window.location.replace``, so anything else is a
 * redirect an attacker controls: ``//evil.example`` and ``/\evil.example``
 * are protocol-relative, and a ``javascript:`` URL would execute here.
 */
function sameOriginPath(requested: string | null): string {
  return requested && /^\/[^/\\]/.test(requested) ? requested : DEFAULT_RETURN_TO;
}

export default function OAuthCompletePage() {
  const [showFallback, setShowFallback] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const params = new URLSearchParams(window.location.search);
    const returnTo = sameOriginPath(params.get('return'));
    params.delete('return');
    const resultQuery = params.toString();

    const kind: 'workspace' | 'integration' | 'unknown' = params.get('user_email')
      ? 'workspace'
      : params.get('integration_success') || params.get('integration_error')
        ? 'integration'
        : 'unknown';

    // 1. Tell the original tab so it can refetch without a reload.
    broadcastOAuthComplete({ query: resultQuery, kind });

    // 2. Try to close — focus returns to the original tab. Give the
    //    broadcast a short beat to flush before tearing the tab down.
    const closeTimer = window.setTimeout(() => {
      window.close();
      // If the browser refuses to close this tab, surface fallback UI.
      window.setTimeout(() => setShowFallback(true), 150);
    }, 50);

    // ``close()`` does nothing when this tab wasn't script-opened (the
    // popup-blocked same-tab fallback). After a short grace period, finish
    // the flow the old way by returning to the originating page with the
    // provider's result params.
    const redirectTimer = window.setTimeout(() => {
      const sep = returnTo.includes('?') ? '&' : '?';
      const dest = resultQuery ? `${returnTo}${sep}${resultQuery}` : returnTo;
      window.location.replace(dest);
    }, 900);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(redirectTimer);
    };
  }, []);

  if (!showFallback) return null;

  return (
    <div className="brand-page-stencil-bg flex min-h-screen items-center justify-center bg-background p-6">
      <BrandStatusCard
        eyebrow="OAuth"
        description="Returning to Console..."
        icon={<Loader size={24} />}
      />
    </div>
  );
}
