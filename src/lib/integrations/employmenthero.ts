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
 *
 * Org-pinning policy: the callback uses ``/api/v1/organisations`` — not
 * ``/me`` — to enumerate organisations the token can access.  ``/me``
 * is gated behind a separate identity scope that EH dev-portal apps do
 * not always have, and was the reason the previous "best-effort" hook
 * silently returned nulls for tokens minted without it.  Selection is
 * driven by ``selectActiveOrganisation`` here (a single named org wins;
 * 0 or 2+ named orgs are surfaced via a notice on the success redirect
 * so the user can override via Console -> Secrets if needed).
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

export interface EmploymentHeroOrganisation {
  id: string;
  name: string | null;
  country: string | null;
  logoUrl: string | null;
}

/** Notice surfaced on the success redirect when auto-pin can't make a
 *  clean choice.  Consumed by ``useIntegrationCallbackFlash``. */
export type EmploymentHeroSelectionNotice = 'none_named' | 'multi_named';

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
 * Enumerate organisations the token can access.  Hits
 * ``/api/v1/organisations`` (the canonical org list, also used by the
 * unity-deploy runtime) rather than ``/me`` (which requires a separate
 * identity scope and 403's for most dev-portal apps).
 *
 * Envelope is ``{ data: { items: [...], page_index, total_pages, ... } }``
 * per the live API.  Throws on transport errors so the caller can
 * surface a meaningful ``integration_error`` reason; returns ``[]`` when
 * the response is well-formed but the user belongs to no organisations.
 */
export async function listEmploymentHeroOrganisations(args: {
  accessToken: string;
  /** Optional API host override.  Defaults to the global host which
   *  routes regionally at the load balancer. */
  apiBase?: string;
}): Promise<EmploymentHeroOrganisation[]> {
  const apiBase = args.apiBase ?? DEFAULT_API_BASE;
  const response = await fetch(`${apiBase}/api/v1/organisations`, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Employment Hero organisations fetch returned ${response.status}: ${text.slice(0, 300)}`
    );
  }
  /* eslint-disable @typescript-eslint/naming-convention */
  const body = (await response.json().catch(() => ({}))) as {
    data?: {
      items?: Array<{
        id?: string | number;
        name?: string | null;
        country?: string | null;
        logo_url?: string | null;
      }>;
    };
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  const items = body?.data?.items ?? [];
  const out: EmploymentHeroOrganisation[] = [];
  for (const o of items) {
    if (o.id == null) continue;
    out.push({
      id: String(o.id),
      name: typeof o.name === 'string' && o.name.trim() !== '' ? o.name : null,
      country: typeof o.country === 'string' && o.country !== '' ? o.country : null,
      logoUrl: typeof o.logo_url === 'string' && o.logo_url !== '' ? o.logo_url : null,
    });
  }
  return out;
}

/**
 * Auto-pin policy for the Connect callback.
 *
 *   - Exactly one org has a non-null ``name`` → pin it.  Clean success.
 *   - Zero named orgs → pin nothing.  ``none_named`` notice tells the
 *     user the runtime will fall back to the first accessible org.
 *   - Two or more named orgs → pin the lexicographically-first id (a
 *     deterministic tie-break) and surface ``multi_named`` so the user
 *     knows to override via Settings -> Secrets if the auto-pick was
 *     wrong.
 *
 * The id-based tie-break is deterministic across reconnects: the same
 * input list always yields the same pinned id, so a customer who
 * accepts the first auto-pick won't be silently re-pinned to a
 * different org on a later Reconnect.
 */
export function selectActiveOrganisation(orgs: EmploymentHeroOrganisation[]): {
  pinnedId: string | null;
  notice: EmploymentHeroSelectionNotice | null;
} {
  const named = orgs.filter((o) => o.name != null);
  if (named.length === 1) {
    return { pinnedId: named[0].id, notice: null };
  }
  if (named.length === 0) {
    return { pinnedId: null, notice: 'none_named' };
  }
  const sorted = [...named].sort((a, b) => a.id.localeCompare(b.id));
  return { pinnedId: sorted[0].id, notice: 'multi_named' };
}
