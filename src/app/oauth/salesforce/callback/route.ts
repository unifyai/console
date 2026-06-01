/**
 * GET /oauth/salesforce/callback
 *
 * Handles the redirect Salesforce sends after the user grants consent.
 * All of the state-verification, secret-read, secret-write, and redirect
 * plumbing lives in ``handleOAuthCallback``; this file only contributes
 * the Salesforce-specific token-exchange call, the best-effort identity
 * probe, and the per-org ``instance_url`` write.
 *
 * Salesforce specifics:
 *   - The token response includes a per-org ``instance_url`` (the REST
 *     API host post-auth — not ``login.salesforce.com``).  Persisted
 *     alongside the refresh token via ``SALESFORCE_INSTANCE_URL``.
 *   - Whitespace-trim every stored value (the shared helper does this
 *     for all providers; documented here because Salesforce is the one
 *     that most needs it in practice).
 *   - Production-only: the OAuth host is ``login.salesforce.com``.
 *     Sandbox connections fail at the authorize step before reaching
 *     this callback.
 */

import { NextRequest } from 'next/server';
import { handleOAuthCallback } from '@/lib/integrations/oauth-callback';
import { exchangeSalesforceCode, fetchSalesforceAccountInfo } from '@/lib/integrations/salesforce';

const PROVIDER_ID = 'salesforce' as const;

export async function GET(request: NextRequest) {
  return handleOAuthCallback({
    providerId: PROVIDER_ID,
    request,
    hooks: {
      exchange: async (args) => {
        const tokens = await exchangeSalesforceCode(args);
        return {
          accessToken: tokens.access_token,
          secretWrites: {
            SALESFORCE_REFRESH_TOKEN: tokens.refresh_token,
            SALESFORCE_INSTANCE_URL: tokens.instance_url,
          },
        };
      },
      postExchange: async (ctx) => {
        // Best-effort identity probe.  Failures here are non-fatal — we
        // still write the refresh token because the runtime will surface
        // any real auth issue on first use.  Salesforce's userinfo
        // endpoint is reachable with the basic ``id`` / ``api`` scope,
        // so this rarely fails when the token exchange itself succeeded.
        await fetchSalesforceAccountInfo({ accessToken: ctx.accessToken }).catch(() => undefined);
        return {};
      },
    },
  });
}
