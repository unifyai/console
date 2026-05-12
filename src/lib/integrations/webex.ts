/**
 * Server-only Webex OAuth helpers used by the Console callback route at
 * ``src/app/oauth/webex/callback/route.ts``.
 *
 * Only runs in Node — the client never hits these endpoints directly,
 * because the customer's ``WEBEX_OAUTH_CLIENT_SECRET`` would have to
 * leak into the browser to do that.  The browser kicks off the flow
 * via ``/api/integrations/oauth/start`` (which builds an authorize URL
 * with only the ``client_id`` + ``scope``), then Webex redirects back
 * to our callback with a code, and the code-exchange happens here.
 *
 * Mirrors the unity-deploy package's ``_client.py`` resolver for parity:
 * same token endpoint, same form-encoded payload, same response shape.
 *
 * Webex doesn't require an explicit "active organisation" pin — the
 * connected user's token is already org-scoped — so unlike the Employment
 * Hero callback there is no organisations-enumeration step here.  The
 * runtime exercises the token directly and surfaces any tier-gating
 * issues via the standard 403 envelope pattern.
 */

const DEFAULT_TOKEN_URL = 'https://webexapis.com/v1/access_token';
const DEFAULT_API_BASE = 'https://webexapis.com';

/* OAuth wire-format property names are snake_case per the spec.  The
   naming-convention rule otherwise enforces camelCase, but wire-format
   types are an exception — they reflect server contracts we don't own. */
/* eslint-disable @typescript-eslint/naming-convention */
export interface WebexTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  token_type?: string;
  scope?: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface WebexAccountInfo {
  id: string;
  primaryEmail: string | null;
  displayName: string | null;
  orgId: string | null;
  type: string | null;
}

/**
 * Exchange the authorisation code returned by Webex after the user grants
 * consent for an ``access_token`` + ``refresh_token`` pair.
 */
export async function exchangeWebexCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  /** Optional override for tests. */
  tokenUrl?: string;
}): Promise<WebexTokens> {
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
    throw new Error(`Webex token exchange returned ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as Partial<WebexTokens>;
  if (!json.access_token || !json.refresh_token) {
    throw new Error('Webex response missing access_token or refresh_token.');
  }

  /* eslint-disable @typescript-eslint/naming-convention */
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in ?? 1_209_600,
    refresh_token_expires_in: json.refresh_token_expires_in,
    token_type: json.token_type,
    scope: json.scope,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
}

/**
 * Best-effort token-validity probe.  Hits ``/v1/people/me`` and returns
 * the connected user's identity for the success toast.  Failures are not
 * fatal — the runtime exercises the token shortly after and will surface
 * any real auth issue then.  The caller swallows errors and continues
 * without account info if ``spark:people_read`` isn't granted.
 */
export async function fetchWebexAccountInfo(args: {
  accessToken: string;
  /** Optional API host override. */
  apiBase?: string;
}): Promise<WebexAccountInfo> {
  const apiBase = args.apiBase ?? DEFAULT_API_BASE;
  const response = await fetch(`${apiBase}/v1/people/me`, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Webex /people/me fetch returned ${response.status}: ${text.slice(0, 300)}`);
  }
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    emails?: string[];
    displayName?: string | null;
    orgId?: string | null;
    type?: string | null;
  };
  const emails = Array.isArray(body.emails) ? body.emails.filter(Boolean) : [];
  return {
    id: String(body.id ?? ''),
    primaryEmail: emails[0] ?? null,
    displayName:
      typeof body.displayName === 'string' && body.displayName.trim() !== ''
        ? body.displayName
        : null,
    orgId: typeof body.orgId === 'string' && body.orgId !== '' ? body.orgId : null,
    type: typeof body.type === 'string' && body.type !== '' ? body.type : null,
  };
}
