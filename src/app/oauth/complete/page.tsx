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

import { broadcastOAuthComplete } from '@/utils/assistants/oauth';

export default function OAuthCompletePage() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return') || '/assistants';
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
    //    broadcast a beat to flush before tearing the tab down (closing
    //    synchronously can drop the BroadcastChannel message mid-send).
    const closeTimer = window.setTimeout(() => window.close(), 150);

    // ``close()`` does nothing when this tab wasn't script-opened (the
    // popup-blocked same-tab fallback). After a short grace period, finish
    // the flow the old way by returning to the originating page with the
    // provider's result params.
    const redirectTimer = window.setTimeout(() => {
      const sep = returnTo.includes('?') ? '&' : '?';
      const dest = resultQuery ? `${returnTo}${sep}${resultQuery}` : returnTo;
      window.location.replace(dest);
    }, 600);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(redirectTimer);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <p className="text-sm">Finishing sign-in… you can close this tab.</p>
      </div>
    </div>
  );
}
