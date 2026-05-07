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
 * Adding a new integration:
 *   1. Append a ``IntegrationProviderId`` to the type union in
 *      ``src/types/assistants/integration.ts``.
 *   2. Add a config entry below.
 *   3. For OAuth providers, add a callback route at
 *      ``src/app/oauth/<provider>/callback/route.ts`` mirroring
 *      ``employmenthero/callback``.
 *
 * The runtime side (unity-deploy) is independent — its package's
 * manifest declares the same ``managedSecretKeys`` and reads them at
 * call time.
 */
export const INTEGRATION_PROVIDERS: IntegrationProviderConfig[] = [
  {
    id: 'custom',
    label: 'Custom secret',
    shortDescription: 'Paste any environment-style key/value pair.',
    auth: { kind: 'freeform' },
  },
  {
    id: 'employmenthero',
    label: 'Employment Hero',
    shortDescription: 'Connect via OAuth using a developer-portal app.',
    docsUrl: 'https://developer.employmenthero.com',
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
    id: 'hubspot',
    label: 'HubSpot',
    shortDescription: 'Paste your HubSpot Private App access token.',
    docsUrl: 'https://developers.hubspot.com/docs/api/private-apps',
    auth: {
      kind: 'api_key',
      field: {
        label: 'Private app token',
        secretKey: 'HUBSPOT_PRIVATE_APP_TOKEN',
        sensitive: true,
        placeholder: 'pat-...',
        helpText: 'Generate at HubSpot → Settings → Integrations → Private Apps.',
      },
    },
  },
  {
    id: 'matterport',
    label: 'Matterport',
    shortDescription: 'Paste your Matterport API token pair (Token ID + secret).',
    docsUrl: 'https://matterport.github.io/showcase-sdk/api_home.html',
    auth: {
      kind: 'api_key_multi',
      fields: [
        {
          label: 'Token ID',
          secretKey: 'MATTERPORT_TOKEN_ID',
          sensitive: true,
          helpText:
            'Generate at Matterport → Settings → Account → API Access → Add API Token. Copy the Token ID shown.',
        },
        {
          label: 'Token secret',
          secretKey: 'MATTERPORT_TOKEN_SECRET',
          sensitive: true,
          helpText: 'Shown once at token creation — copy it before closing the Matterport dialog.',
        },
      ],
    },
  },
  {
    id: 'webex',
    label: 'Webex',
    shortDescription: 'Connect via OAuth using a Webex Integration app.',
    docsUrl: 'https://developer.webex.com/docs/integrations',
    auth: {
      kind: 'oauth_authorization_code',
      fields: [
        {
          label: 'Client ID',
          secretKey: 'WEBEX_OAUTH_CLIENT_ID',
          sensitive: false,
          helpText: 'From your Webex Integration app at developer.webex.com → My Webex Apps.',
        },
        {
          label: 'Client secret',
          secretKey: 'WEBEX_OAUTH_CLIENT_SECRET',
          sensitive: true,
          helpText: 'From your Webex Integration app at developer.webex.com → My Webex Apps.',
        },
      ],
      oauth: {
        authorizeUrl: 'https://webexapis.com/v1/authorize',
        managedSecretKeys: ['WEBEX_REFRESH_TOKEN'],
        // Webex requires explicit scope on the authorize URL.  Three
        // families:
        //
        //   - ``spark:all`` — meta-scope covering messaging, rooms,
        //     people, memberships, attachments, teams, devices.
        //   - ``meeting:*`` — scheduled-meeting CRUD, participants,
        //     recordings, transcripts, in-meeting controls.  NOT covered
        //     by ``spark:all``.
        //   - ``spark-admin:*`` / ``meeting:admin_*`` — org-wide reads.
        //     Excluded by default because they require the connecting
        //     user to have an admin role; mixing admin scopes with
        //     non-admin scopes can fail consent for regular users.  Add
        //     to a customer's Integration app + their connect attempt
        //     only when they explicitly need org-wide visibility.
        //
        // The Webex Integration app the customer registers must declare
        // every scope we request here — narrowing here without narrowing
        // on the dev-portal app is fine; the reverse yields
        // ``invalid_scope`` at consent time.
        scope: [
          'spark:all',
          'meeting:schedules_read',
          'meeting:schedules_write',
          'meeting:participants_read',
          'meeting:participants_write',
          'meeting:recordings_read',
          'meeting:recordings_write',
          'meeting:transcripts_read',
          'meeting:controls_read',
          'meeting:controls_write',
          'meeting:preferences_read',
          'meeting:preferences_write',
        ].join(' '),
      },
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
 *  into the modal).  Excludes OAuth-managed keys. */
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
