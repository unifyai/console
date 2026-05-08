/**
 * Server-only Salesforce OAuth helpers used by the Console callback route
 * at ``src/app/oauth/salesforce/callback/route.ts``.
 *
 * Only runs in Node — the client never hits these endpoints directly,
 * because the customer's ``SALESFORCE_CLIENT_SECRET`` would have to leak
 * into the browser to do that.  The browser kicks off the flow via
 * ``/api/integrations/oauth/start`` (which builds an authorize URL with
 * only the ``client_id`` + ``scope``), then Salesforce redirects back to
 * our callback with a code, and the code-exchange happens here.
 *
 * Mirrors the unity-deploy package's ``_client.py`` resolver for parity:
 * same token endpoint, same form-encoded payload, same response shape.
 *
 * Production-only: the OAuth host is fixed to ``login.salesforce.com``.
 * Sandbox (``test.salesforce.com``) and customer My Domain login hosts
 * are not supported in v0 — connections from those would land on this
 * callback after the customer registers a Connected App on the
 * production org, but token exchange against the wrong host fails with
 * ``invalid_client_id``.
 *
 * Salesforce token responses do not include ``expires_in``; access
 * tokens live for whatever the Connected App's session-policy says
 * (default 2h, often 12h+).  The runtime's in-process cache and 401-retry
 * path handle this — the Console only needs the refresh token + instance
 * URL persisted, which is what this module produces.
 */

const TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';
const USERINFO_URL = 'https://login.salesforce.com/services/oauth2/userinfo';

/* OAuth wire-format property names are snake_case per the spec.  The
   naming-convention rule otherwise enforces camelCase, but wire-format
   types are an exception — they reflect server contracts we don't own. */
/* eslint-disable @typescript-eslint/naming-convention */
export interface SalesforceTokens {
  access_token: string;
  refresh_token: string;
  /** Per-org API host the runtime must use as the base URL for all REST
   *  calls other than token exchange/refresh, e.g.
   *  ``https://acme.my.salesforce.com``.  Persisted to the assistant as
   *  ``SALESFORCE_INSTANCE_URL`` so the runtime can read it back. */
  instance_url: string;
  /** Identity URL the runtime can hit with the access_token to read the
   *  connected user's profile.  Format is
   *  ``https://login.salesforce.com/id/<orgId>/<userId>``. */
  id?: string;
  token_type?: string;
  signature?: string;
  issued_at?: string;
  scope?: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface SalesforceAccountInfo {
  userId: string | null;
  organizationId: string | null;
  username: string | null;
  displayName: string | null;
  email: string | null;
}

/**
 * Exchange the authorisation code returned by Salesforce after the user
 * grants consent for an ``access_token`` + ``refresh_token`` + per-org
 * ``instance_url`` triple.
 */
export async function exchangeSalesforceCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  /** Optional override for tests. */
  tokenUrl?: string;
}): Promise<SalesforceTokens> {
  const url = args.tokenUrl ?? TOKEN_URL;
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
    throw new Error(`Salesforce token exchange returned ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as Partial<SalesforceTokens>;
  if (!json.access_token || !json.refresh_token || !json.instance_url) {
    throw new Error('Salesforce response missing access_token, refresh_token, or instance_url.');
  }

  /* eslint-disable @typescript-eslint/naming-convention */
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    instance_url: json.instance_url,
    id: json.id,
    token_type: json.token_type,
    signature: json.signature,
    issued_at: json.issued_at,
    scope: json.scope,
  };
  /* eslint-enable @typescript-eslint/naming-convention */
}

/**
 * Best-effort token-validity probe.  Hits the OAuth ``/userinfo``
 * endpoint and returns the connected user's identity for the success
 * toast.  Failures are not fatal — the runtime exercises the token
 * shortly after and will surface any real auth issue then.
 *
 * Salesforce ``/services/oauth2/userinfo`` is reachable with the basic
 * ``id`` (or ``api``) scope and does not require any sObject permission,
 * so this rarely fails when the token exchange itself succeeded.
 */
export async function fetchSalesforceAccountInfo(args: {
  accessToken: string;
}): Promise<SalesforceAccountInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Salesforce /userinfo fetch returned ${response.status}: ${text.slice(0, 300)}`
    );
  }
  /* OAuth ``userinfo`` response uses snake_case per the spec. */
  /* eslint-disable @typescript-eslint/naming-convention */
  const body = (await response.json().catch(() => ({}))) as {
    user_id?: string;
    organization_id?: string;
    username?: string;
    preferred_username?: string;
    name?: string;
    email?: string;
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return {
    userId: typeof body.user_id === 'string' && body.user_id !== '' ? body.user_id : null,
    organizationId:
      typeof body.organization_id === 'string' && body.organization_id !== ''
        ? body.organization_id
        : null,
    username:
      (typeof body.preferred_username === 'string' && body.preferred_username !== ''
        ? body.preferred_username
        : null) ??
      (typeof body.username === 'string' && body.username !== '' ? body.username : null),
    displayName: typeof body.name === 'string' && body.name.trim() !== '' ? body.name : null,
    email: typeof body.email === 'string' && body.email !== '' ? body.email : null,
  };
}
