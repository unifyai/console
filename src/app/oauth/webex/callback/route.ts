/**
 * GET /oauth/webex/callback
 *
 * Handles the redirect Webex sends after the user grants consent.  All
 * of the state-verification, secret-read, secret-write, and redirect
 * plumbing lives in ``handleOAuthCallback``; this file only contributes
 * the Webex-specific token-exchange call and the best-effort identity
 * probe.
 *
 * Webex specifics:
 *   - No active-org pinning — tokens are already org-scoped at the
 *     authorize step.
 *   - The ``/people/me`` probe needs ``spark:people_read`` scope, which
 *     not every token has, so the failure is swallowed.
 */

import { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/integrations/oauth-callback';
import { exchangeWebexCode, fetchWebexAccountInfo } from '@/lib/integrations/webex';

const PROVIDER_ID = 'webex' as const;

export async function GET(request: NextRequest) {
  return handleOAuthCallback({
    providerId: PROVIDER_ID,
    request,
    hooks: {
      exchange: async (args) => {
        const tokens = await exchangeWebexCode(args);
        return {
          accessToken: tokens.access_token,
          secretWrites: { WEBEX_REFRESH_TOKEN: tokens.refresh_token },
        };
      },
      postExchange: async (ctx) => {
        // Best-effort identity probe.  Failures here are non-fatal — we
        // still write the refresh token because the runtime will surface
        // any real auth issue on first use.
        await fetchWebexAccountInfo({ accessToken: ctx.accessToken }).catch(() => undefined);
        return {};
      },
    },
  });
}
