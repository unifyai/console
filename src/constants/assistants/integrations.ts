import { KeyRound } from 'lucide-react';
import type {
  IntegrationProviderConfig,
  IntegrationProviderId,
} from '@/types/assistants/integration';

/**
 * Registered integration providers.  The order here drives the dropdown
 * order in the ``Add new`` button — keep ``custom`` at the top so users
 * always have the freeform fallback as the first option, then list
 * integrations alphabetically.
 *
 * Managed marketplace apps (Composio / Pipedream) are **not** registered
 * here — they arrive via the provider catalog.  This registry is only for
 * static ``unity-deploy`` native connectors and the freeform custom-secret
 * fallback.
 *
 * ## Adding a new integration
 *
 *   1. Append the new id to ``IntegrationProviderId`` in
 *      ``src/types/assistants/integration.ts``.
 *   2. Add a config entry below (alphabetical, after ``custom``).  At
 *      minimum: ``id``, ``label``, ``shortDescription``, ``auth``.
 *      Optionally: ``docsUrl``, ``setupNote``, ``iconComponent``
 *      (typically from ``react-icons/si``), ``iconClassName``.
 *   3. For OAuth providers only: add a callback at
 *      ``src/app/oauth/<id>/callback/route.ts`` and a server-only
 *      helper module at ``src/lib/integrations/<id>.ts`` exporting
 *      ``exchange<Provider>Code`` (plus any identity probe / org
 *      enumeration the provider needs).  Mirror the Employment Hero
 *      callback for shape.
 *
 * ## Picking an ``auth.kind``
 *
 *   - ``freeform`` — reserved for the ``custom`` provider's freeform
 *     key/value flow.  Do not use for new integrations.
 *   - ``api_key`` — single paste field.
 *   - ``api_key_multi`` — N paste fields.  **This is a UX category, not
 *     a wire-protocol claim.**  Salto KS (OAuth 2.0 Resource Owner
 *     Password Credentials over client + service-account credentials)
 *     and Valos (OS Maps + PropertyData API keys) both use
 *     ``api_key_multi`` because the Console UX is identical: paste-
 *     and-go, no browser-redirect dance.  The actual wire protocol
 *     lives in the runtime package's ``_client.py``.
 *   - ``oauth_authorization_code`` — standard browser-redirect dance
 *     (Employment Hero).  Set ``oauth.scope`` only if the provider
 *     requires explicit scope on the authorize URL.  Employment Hero
 *     omits it — EH binds scope at app-registration time on the
 *     dev-portal app.
 *
 * ## Runtime side stays independent
 *
 * The runtime side (``unity-deploy/.../packages/<slug>/``) is fully
 * independent.  Its ``manifest.yaml`` declares the same
 * ``<SLUG>_*`` secret names the Console writes (customer-provided
 * fields plus OAuth-managed keys), and its ``_client.py`` reads them
 * at call time.  The Console and the runtime never call each other
 * directly — **secret names are the only contract** between the two
 * sides.  Drift between this registry and the matching manifest is
 * a real bug source; cross-check both when adding or changing fields.
 */
export const INTEGRATION_PROVIDERS: IntegrationProviderConfig[] = [
  {
    id: 'custom',
    label: 'Custom secret',
    shortDescription: 'Paste any environment-style key/value pair.',
    iconComponent: KeyRound,
    auth: { kind: 'freeform' },
  },
  {
    id: 'employmenthero',
    label: 'Employment Hero',
    shortDescription: 'Connect via OAuth using a developer-portal app.',
    docsUrl: 'https://developer.employmenthero.com',
    // Not in react-icons/si — falls through to the generic Plug2 glyph
    // in ``ProviderIcon``, matching the right-pane Integrations tab.
    auth: {
      kind: 'oauth_authorization_code',
      fields: [
        {
          label: 'Client ID',
          secretKey: 'EMPLOYMENTHERO_OAUTH_CLIENT_ID',
          sensitive: false,
          helpText: 'From your Employment Hero developer-portal app.',
        },
        {
          label: 'Client secret',
          secretKey: 'EMPLOYMENTHERO_OAUTH_CLIENT_SECRET',
          sensitive: true,
          helpText: 'From your Employment Hero developer-portal app.',
        },
      ],
      oauth: {
        authorizeUrl: 'https://oauth.employmenthero.com/oauth2/authorize',
        managedSecretKeys: ['EMPLOYMENTHERO_REFRESH_TOKEN', 'EMPLOYMENTHERO_ORGANISATION_ID'],
      },
    },
  },
  {
    id: 'salto_ks',
    label: 'Salto KS',
    shortDescription:
      'Paste OAuth client credentials + a Salto KS service-account login (the "Backend Server" integration type uses ROPC, which requires both).',
    docsUrl: 'https://developer.saltosystems.com/ks/connect-api/integration-types/',
    // Not in react-icons/si — falls through to the generic Plug2 glyph
    // in ``ProviderIcon``, matching Employment Hero and Valos.
    setupNote:
      "Two steps: (1) email your regional Salto Business Unit to request OAuth client credentials for the \"Backend Server\" integration type (scope: user_api.full_access). (2) In your Salto KS dashboard, create a dedicated service-account user (e.g. svc-unity@yourco.com) with the KS roles the integration needs — this user's email and password are the third and fourth required fields below. Don't reuse a real person's login — passwords are held long-term in SecretManager. For non-EU regions or sandbox environments, set SALTO_KS_IDENTITY_HOST (and usually SALTO_KS_BASE_URL) via the Custom secret flow.",
    auth: {
      // Salto KS uses OAuth 2.0 Resource Owner Password Credentials
      // (ROPC) layered with OpenID Connect — Salto's documented
      // "Backend Server" integration type.  Each token-mint sends:
      //   * HTTP Basic header carrying client_id + client_secret
      //   * grant_type=password body with username (KS email) +
      //     password (KS password) + scope=user_api.full_access
      // No user-consent dance, no authorize URL, no callback, no
      // refresh token — runtime mints bearer tokens server-side at
      // call time.  Same Console UX as Valos's multi-key paste —
      // ``api_key_multi`` is the right strategy.
      // ``api_key_multi`` here is the *Console UX* category (paste-
      // and-go modal), not a claim about the wire-protocol auth
      // model.
      kind: 'api_key_multi',
      fields: [
        {
          label: 'Client ID',
          secretKey: 'SALTO_KS_CLIENT_ID',
          sensitive: false,
          helpText: 'OAuth client ID issued by your regional Salto Business Unit (EU/US/AP).',
        },
        {
          label: 'Client secret',
          secretKey: 'SALTO_KS_CLIENT_SECRET',
          sensitive: true,
          helpText:
            'OAuth client secret paired with the Client ID. Used server-side to mint short-lived bearer tokens; never sent to the browser.',
        },
        {
          label: 'Service account email',
          secretKey: 'SALTO_KS_USERNAME',
          sensitive: false,
          placeholder: 'svc-unity@yourco.com',
          helpText:
            "Email of the Salto KS user that acts as the resource owner. Use a dedicated service-account user, not a real person's login.",
        },
        {
          label: 'Service account password',
          secretKey: 'SALTO_KS_PASSWORD',
          sensitive: true,
          helpText:
            'Password of the Salto KS service-account user. Held in SecretManager between calls and re-sent each time the ~1h access token expires.',
        },
      ],
    },
  },
  {
    id: 'valos',
    label: 'Valos',
    shortDescription:
      'UK property data. Paste OS Maps + PropertyData API keys to enable UK property valuation tools (geocoding, freeholds, title polygons, demographics, OS-tiled map rendering).',
    docsUrl: 'https://osdatahub.os.uk',
    // No react-icons/si mark for OS / PropertyData / Valos — falls
    // through to the generic Plug2 glyph in ``ProviderIcon``, matching
    // Employment Hero / Salto KS.
    auth: {
      kind: 'api_key_multi',
      fields: [
        {
          label: 'OS Maps API key',
          secretKey: 'OS_MAPS_API_KEY',
          sensitive: true,
          helpText:
            'Project API key from osdatahub.os.uk → Project → API key (the Project API Secret is unused — we authenticate via the simple ?key=... query-param flow). Required scope is just OS Maps for tile rendering; OS Names and OS Places are optional Premium add-ons that give building-level geocoding with UPRN. On Standard plans, valos_geocode transparently falls back to postcodes.io (postcodes) and Nominatim (free-text addresses) — no extra wiring needed.',
        },
        {
          label: 'PropertyData API key',
          secretKey: 'PROPERTYDATA_API_KEY',
          sensitive: true,
          helpText:
            'API key from propertydata.co.uk → Settings → API. Plan must include Land Registry endpoints (/api/freeholds, /api/title-information). 14-day free trial requires a card on file at signup; auto-renews to the selected plan unless cancelled before day 14.',
        },
      ],
    },
  },
];

/** Lookup helper.  Returns ``undefined`` for unknown ids — callers should
 *  treat that as a misconfigured provider. */
export function getIntegrationProvider(
  id: IntegrationProviderId
): IntegrationProviderConfig | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id);
}

/** Reverse lookup: which provider owns this secret key, if any?  Returns
 *  ``undefined`` if the key isn't claimed by any integration (i.e. it's
 *  a custom secret). */
export function findProviderForSecretKey(secretKey: string): IntegrationProviderConfig | undefined {
  return INTEGRATION_PROVIDERS.find((p) => secretKeysFor(p).has(secretKey));
}

/** Set of every secret key claimed by a provider — both the customer-
 *  provided fields AND the OAuth-managed keys.  Used by the partition
 *  logic in the hook to separate integration secrets from custom ones. */
export function secretKeysFor(provider: IntegrationProviderConfig): Set<string> {
  const out = new Set<string>();
  switch (provider.auth.kind) {
    case 'freeform':
      return out;
    case 'api_key':
      out.add(provider.auth.field.secretKey);
      return out;
    case 'api_key_multi':
      for (const f of provider.auth.fields) out.add(f.secretKey);
      return out;
    case 'oauth_authorization_code':
      for (const f of provider.auth.fields) out.add(f.secretKey);
      for (const k of provider.auth.oauth.managedSecretKeys) out.add(k);
      return out;
  }
}

/** Customer-provided secret keys for a provider (the ones the user pastes
 *  into the modal).  Excludes OAuth-managed keys.  Includes optional
 *  fields — used by OAuth callbacks and the disconnect route, both of
 *  which want every customer-provided key the provider declares. */
export function customerProvidedSecretKeysFor(provider: IntegrationProviderConfig): string[] {
  switch (provider.auth.kind) {
    case 'freeform':
      return [];
    case 'api_key':
      return [provider.auth.field.secretKey];
    case 'api_key_multi':
      return provider.auth.fields.map((f) => f.secretKey);
    case 'oauth_authorization_code':
      return provider.auth.fields.map((f) => f.secretKey);
  }
}

/** Customer-provided secret keys that MUST be present for a card to flip
 *  to ``configured``.  Excludes optional fields — used by card-state
 *  derivation so that an absent optional secret doesn't make the card
 *  display "needs configuration" forever. */
export function requiredCustomerProvidedSecretKeysFor(
  provider: IntegrationProviderConfig
): string[] {
  switch (provider.auth.kind) {
    case 'freeform':
      return [];
    case 'api_key':
      return provider.auth.field.optional ? [] : [provider.auth.field.secretKey];
    case 'api_key_multi':
      return provider.auth.fields.filter((f) => !f.optional).map((f) => f.secretKey);
    case 'oauth_authorization_code':
      return provider.auth.fields.filter((f) => !f.optional).map((f) => f.secretKey);
  }
}
