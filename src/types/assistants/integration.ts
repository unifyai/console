import type { ResponseProps } from '../common';

/**
 * Identifier for an integration provider in the per-assistant Integrations
 * tab.  Add new entries here AND in
 * ``src/constants/assistants/integrations.ts``.
 *
 * ``custom`` is the freeform key/value pair flow that pre-dates the
 * Integrations tab — kept as the top entry in the ``Add new`` dropdown so
 * users still have an unstructured fallback for arbitrary env vars.
 */
export type IntegrationProviderId = 'custom' | 'employmenthero' | 'hubspot' | 'webex';

/**
 * One field the customer fills in when adding/editing an integration.  The
 * label is what the user sees; ``secretKey`` is the underlying env-style
 * name we store on the assistant.  ``secretKey`` is intentionally empty
 * for the ``custom`` provider — the user types the key themselves.
 */
export interface IntegrationFieldSpec {
  /** User-facing label, e.g. "Client ID". */
  label: string;
  /** Underlying secret name, e.g. ``EMPLOYMENTHERO_OAUTH_CLIENT_ID``.
   *  Empty string for the ``custom`` provider. */
  secretKey: string;
  /** Whether the value is sensitive in the broader system (logs etc.).
   *  Inside the Integrations tab itself, **all** fields render masked
   *  regardless of this flag — see ``MaskedInput`` for details. */
  sensitive: boolean;
  placeholder?: string;
  helpText?: string;
}

export type IntegrationAuthStrategy =
  | { kind: 'freeform' }
  | { kind: 'api_key'; field: IntegrationFieldSpec }
  | {
      kind: 'oauth_authorization_code';
      fields: IntegrationFieldSpec[];
      oauth: {
        /** EH: ``https://oauth.employmenthero.com/oauth2/authorize``. */
        authorizeUrl: string;
        /** Secrets the OAuth callback writes — also the set we delete on
         *  Disconnect.  Customer-provided fields are **not** in this list
         *  (they're managed by the user, not the OAuth flow). */
        managedSecretKeys: string[];
        /** Optional space-separated scopes appended to the authorize URL
         *  by ``/api/integrations/oauth/start``.  Required for providers
         *  that demand explicit scope on the authorize URL (e.g. Webex).
         *  Omitted for providers whose scopes are bound at
         *  app-registration time (e.g. Employment Hero). */
        scope?: string;
      };
    };

export interface IntegrationProviderConfig {
  id: IntegrationProviderId;
  /** Human-readable name shown in the dropdown and on the integration card. */
  label: string;
  /** One-liner shown under the dropdown item and as the default card subtitle. */
  shortDescription: string;
  /** Optional logo URL.  Falls back to a generic icon if unset. */
  iconUrl?: string;
  /** Optional "How to set up" link surfaced in the modal. */
  docsUrl?: string;
  auth: IntegrationAuthStrategy;
}

/**
 * Card-render state derived from which secret keys are present on the
 * assistant.  The hook computes this from a presence-only read (no
 * secret values are ever loaded into the browser).
 */
export type IntegrationCardState =
  | { kind: 'connected' } //   OAuth: refresh_token + credentials all present
  | { kind: 'configured' } //  API key: token present
  | { kind: 'needs_reconnect'; missing: string[] }; //  OAuth: credentials present, refresh_token missing

/**
 * Server-side helpers for the Integrations tab.  Existing helpers from
 * ``@/lib/assistants/secret`` are reused for read/write/delete; the
 * helpers here add convenience wrappers for batch operations the OAuth
 * callback needs.
 */
export interface IntegrationActions {
  /** List the secret names present for an assistant (no values). */
  listSecretNames: (assistantId: string, ownerId: string) => Promise<string[] | ResponseProps>;
  /** Replace a secret by name (delete + create) — used when the
   *  customer edits a customer-provided OAuth credential.  Returns the
   *  new logId on success. */
  upsertByName: (
    assistantId: string,
    ownerId: string,
    name: string,
    value: string,
    description?: string
  ) => Promise<ResponseProps>;
  /** Delete every secret matching ``names`` for the assistant.  Used by
   *  the disconnect path to drop OAuth-managed values in one call. */
  deleteByNames: (assistantId: string, ownerId: string, names: string[]) => Promise<ResponseProps>;
}
