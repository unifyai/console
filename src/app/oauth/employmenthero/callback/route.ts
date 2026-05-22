/**
 * GET /oauth/employmenthero/callback
 *
 * Handles the redirect Employment Hero sends after the user grants
 * consent.  All of the state-verification, secret-read, secret-write,
 * and redirect plumbing lives in ``handleOAuthCallback``; this file
 * only contributes the EH-specific token-exchange call and the
 * organisation-enumeration step that picks an active org to pin.
 *
 * EH specifics:
 *   - Token response is just ``access_token`` + ``refresh_token``;
 *     ``EMPLOYMENTHERO_REFRESH_TOKEN`` is the only managed secret the
 *     token endpoint itself produces.
 *   - Hits ``/api/v1/organisations`` to enumerate orgs the token can
 *     access — failure here is fatal (the actor needs an org id to
 *     route subsequent calls).  ``/me`` would require an identity scope
 *     EH dev-portal apps don't always have, so we use the canonical
 *     org list instead.
 *   - Auto-pin policy: single named org wins, 0 / 2+ named orgs fall
 *     through with a ``notice`` so the user can override in Secrets.
 *     When no org is pinned the helper still clears any prior
 *     ``EMPLOYMENTHERO_ORGANISATION_ID`` — the managed-set delete sweep
 *     covers it.
 *
 * Adding a future OAuth provider:
 *   - Mirror this file at ``src/app/oauth/<provider>/callback/route.ts``
 *     with the provider-specific token-exchange + (optionally) post-
 *     exchange hooks from ``src/lib/integrations/<provider>.ts``.
 *   - The state-cookie verification, secret writes, and redirect logic
 *     stay in ``handleOAuthCallback``.
 */

import { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/integrations/oauth-callback';
import {
  exchangeEmploymentHeroCode,
  listEmploymentHeroOrganisations,
  selectActiveOrganisation,
} from '@/lib/integrations/employmenthero';

const PROVIDER_ID = 'employmenthero' as const;

export async function GET(request: NextRequest) {
  return handleOAuthCallback({
    providerId: PROVIDER_ID,
    request,
    hooks: {
      exchange: async (args) => {
        const tokens = await exchangeEmploymentHeroCode(args);
        return {
          accessToken: tokens.access_token,
          secretWrites: { EMPLOYMENTHERO_REFRESH_TOKEN: tokens.refresh_token },
        };
      },
      postExchange: async (ctx) => {
        let orgs;
        try {
          orgs = await listEmploymentHeroOrganisations({ accessToken: ctx.accessToken });
        } catch (e) {
          const reason =
            e instanceof Error ? e.message.slice(0, 200) : 'organisations_fetch_failed';
          return { abortReason: reason };
        }
        if (orgs.length === 0) {
          return { abortReason: 'no_organisations' };
        }
        const { pinnedId, notice } = selectActiveOrganisation(orgs);
        return {
          extraWrites: pinnedId ? { EMPLOYMENTHERO_ORGANISATION_ID: pinnedId } : undefined,
          notice: notice ?? undefined,
        };
      },
    },
  });
}
