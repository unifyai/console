/**
 * Server-only Employment Hero OAuth helpers used by the Console callback
 * route at ``src/app/oauth/employmenthero/callback/route.ts``.
 *
 * Only runs in Node — the client never hits these endpoints directly,
 * because the customer's ``EMPLOYMENTHERO_OAUTH_CLIENT_SECRET`` would
 * have to leak into the browser to do that.  The browser kicks off the
 * flow via ``/api/integrations/oauth/start`` (which builds an authorize
 * URL with only the ``client_id``), then EH redirects back to our
 * callback with a code, and the code-exchange happens here.
 *
 * Mirrors the unity-deploy package's ``_client.py`` resolver for parity:
 * same token endpoint, same form-encoded payload, same response shape.
 */

const DEFAULT_TOKEN_URL = 'https://oauth.employmenthero.com/oauth2/token';
const DEFAULT_API_BASE = 'https://api.employmenthero.com';

/* OAuth wire-format property names are snake_case per the spec.  The
   naming-convention rule otherwise enforces camelCase, but wire-format
   types are an exception — they reflect server contracts we don't own. */
/* eslint-disable @typescript-eslint/naming-convention */
export interface EmploymentHeroTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface EmploymentHeroAccountInfo {
  /** First organisation the token can access; pinned per-assistant. */
  activeOrganisationId: string | null;
  /** Subdomain (e.g. ``acme.employmenthero.com``) for UI display. */
  hubDomain: string | null;
}

/**
 * Exchange the authorisation code returned by EH after the user grants
 * consent for an ``access_token`` + ``refresh_token`` pair.
 */
export async function exchangeEmploymentHeroCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  /** Optional override for tests or regional EH instances. */
  tokenUrl?: string;
}): Promise<EmploymentHeroTokens> {
  const url = args.tokenUrl ?? DEFAULT_TOKEN_URL;
  /* OAuth-spec wire format requires these snake_case parameter names. */
  /* eslint-disable @typescript-eslint/naming-convention */
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
  });
  /* eslint-enable @typescript-eslint/naming-convention */

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Employment Hero token exchange returned ${response.status}: ${text.slice(0, 300)}`
    );
  }

  const json = (await response.json()) as Partial<EmploymentHeroTokens>;
  if (!json.access_token || !json.refresh_token) {
    throw new Error('Employment Hero response missing access_token or refresh_token.');
  }

  /* eslint-disable @typescript-eslint/naming-convention */
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in ?? 3600,
    token_type: json.token_type,
    scope: json.scope,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
}

/**
 * Fetch ``/me`` with the freshly-minted access token to identify which
 * EH organisation the user authorised, and capture its subdomain for UI
 * display.  Best-effort: failure here doesn't block the connection — we
 * still write the refresh token so the runtime can self-resolve the org
 * later via ``list_organisations()``.
 */
export async function fetchEmploymentHeroAccountInfo(args: {
  accessToken: string;
  /** Optional API host override.  Defaults to the global host which
   *  routes regionally at the load balancer. */
  apiBase?: string;
}): Promise<EmploymentHeroAccountInfo> {
  const apiBase = args.apiBase ?? DEFAULT_API_BASE;
  const response = await fetch(`${apiBase}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    return { activeOrganisationId: null, hubDomain: null };
  }
  const body = (await response.json().catch(() => ({}))) as {
    organisations?: Array<{ id?: string | number; subdomain?: string; domain?: string }>;
    data?: {
      organisations?: Array<{ id?: string | number; subdomain?: string; domain?: string }>;
    };
  };

  const organisations = body.organisations ?? body.data?.organisations ?? [];
  const first = organisations[0];
  if (!first) {
    return { activeOrganisationId: null, hubDomain: null };
  }
  return {
    activeOrganisationId: first.id != null ? String(first.id) : null,
    hubDomain: first.subdomain ?? first.domain ?? null,
  };
}
