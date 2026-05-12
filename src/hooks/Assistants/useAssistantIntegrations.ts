'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  INTEGRATION_PROVIDERS,
  customerProvidedSecretKeysFor,
  secretKeysFor,
} from '@/constants/assistants/integrations';
import type {
  IntegrationCardState,
  IntegrationProviderConfig,
  IntegrationProviderId,
} from '@/types/assistants/integration';
import type { Secret } from '@/types/assistants/secret';

/**
 * Derived per-integration card state for the IntegrationsPane.  Built
 * purely from secret-name presence — never reads any secret value.
 */
export interface IntegrationCardSummary {
  provider: IntegrationProviderConfig;
  state: IntegrationCardState;
  /** Subset of ``secrets`` whose names belong to this provider.  Used by
   *  the Edit-credentials path to find the logIds we need to update. */
  ownedSecrets: Secret[];
}

/**
 * Partition a list of assistant secrets into:
 *  - per-provider card summaries (cards rendered above the secrets table)
 *  - "other" secrets (custom secrets shown in the existing table)
 *  - "hidden" OAuth-managed secrets (never user-facing per the
 *    universal-masking + hide-managed convention)
 */
export function partitionForIntegrations(secrets: Secret[]): {
  cards: IntegrationCardSummary[];
  otherSecrets: Secret[];
  hiddenSecrets: Secret[];
} {
  const byProvider = new Map<IntegrationProviderId, Secret[]>();
  const otherSecrets: Secret[] = [];

  for (const secret of secrets) {
    const owner = INTEGRATION_PROVIDERS.find(
      (p) => p.id !== 'custom' && secretKeysFor(p).has(secret.name)
    );
    if (!owner) {
      otherSecrets.push(secret);
      continue;
    }
    const list = byProvider.get(owner.id) ?? [];
    list.push(secret);
    byProvider.set(owner.id, list);
  }

  // Build a card summary per provider that has at least one owned secret.
  const cards: IntegrationCardSummary[] = [];
  const hiddenSecrets: Secret[] = [];
  for (const [providerId, ownedSecrets] of Array.from(byProvider.entries())) {
    const provider = INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) continue;
    cards.push({
      provider,
      state: deriveCardState(provider, ownedSecrets),
      ownedSecrets,
    });
    // Anything OAuth-managed is hidden from the otherSecrets list AND
    // from the card detail (per "hidden, follow existing convention").
    if (provider.auth.kind === 'oauth_authorization_code') {
      const managedNames = new Set(provider.auth.oauth.managedSecretKeys);
      for (const s of ownedSecrets) {
        if (managedNames.has(s.name)) hiddenSecrets.push(s);
      }
    }
  }

  // Stable card order matching the registry.
  cards.sort(
    (a, b) => INTEGRATION_PROVIDERS.indexOf(a.provider) - INTEGRATION_PROVIDERS.indexOf(b.provider)
  );

  return { cards, otherSecrets, hiddenSecrets };
}

function deriveCardState(
  provider: IntegrationProviderConfig,
  ownedSecrets: Secret[]
): IntegrationCardState {
  const present = new Set(ownedSecrets.map((s) => s.name));
  const customerKeys = customerProvidedSecretKeysFor(provider);
  const missingCustomer = customerKeys.filter((k) => !present.has(k));

  switch (provider.auth.kind) {
    case 'freeform':
      // Should never reach here — custom isn't owned.
      return { kind: 'configured' };
    case 'api_key':
    case 'api_key_multi':
      // ``configured`` once every customer-provided field is present.
      // For ``api_key_multi`` the partition can build a card with only
      // some fields populated (the user closed the modal half-finished
      // or rotated one half of the pair) — surface those gaps via
      // ``needs_reconnect`` so the card prompts the user to complete.
      return missingCustomer.length === 0
        ? { kind: 'configured' }
        : { kind: 'needs_reconnect', missing: missingCustomer };
    case 'oauth_authorization_code': {
      // ``connected`` requires both customer-provided creds AND a refresh
      // token.  ``needs_reconnect`` covers the case where credentials are
      // present but the refresh token is missing (post-Disconnect, post-
      // expiry, or a rotation that nuked the local cache).
      if (missingCustomer.length > 0) {
        return { kind: 'needs_reconnect', missing: missingCustomer };
      }
      const hasRefresh = present.has(
        provider.auth.oauth.managedSecretKeys.find((k) => k.endsWith('REFRESH_TOKEN')) ?? ''
      );
      return hasRefresh ? { kind: 'connected' } : { kind: 'needs_reconnect', missing: [] };
    }
  }
}

/**
 * Async wrapper that drives the per-provider Connect flow: POST to the
 * oauth/start route, then redirect the browser to the authorize URL.
 *
 * Caller has already saved any customer-provided credentials.  The user
 * lands back at the integrations tab via the per-provider callback
 * route.
 */
export async function startOAuthConnect(args: {
  assistantId: string;
  providerId: IntegrationProviderId;
  redirectAfter?: string;
}): Promise<void> {
  const response = await fetch('/api/integrations/oauth/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      hint?: string;
    };
    toast.error(
      data.hint ?? data.error ?? `Failed to start the OAuth flow for ${args.providerId}.`
    );
    return;
  }
  const data = (await response.json()) as { authorizeUrl?: string };
  if (!data.authorizeUrl) {
    toast.error('Server did not return an authorize URL.');
    return;
  }
  window.location.href = data.authorizeUrl;
}

/**
 * DELETE the integration via the per-provider disconnect route.  Returns
 * true on success.  Customer-provided credentials are preserved server-
 * side (the route only deletes managed/api-key secrets).
 */
export async function disconnectIntegration(args: {
  assistantId: string;
  providerId: IntegrationProviderId;
}): Promise<boolean> {
  const response = await fetch(
    `/api/assistant/${args.assistantId}/integrations/${args.providerId}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    toast.error(data.error ?? 'Failed to disconnect.');
    return false;
  }
  const data = (await response.json()) as {
    success?: boolean;
    note?: string;
  };
  toast.success(data.note ?? 'Disconnected.');
  return data.success === true;
}

/**
 * Map a raw ``integration_error`` reason (set by the OAuth callback) to
 * a customer-friendly message.  Unknown reasons fall through unchanged
 * so we never lose information — they just look terser.
 *
 * The redirect-URI bucket matches the strings Employment Hero sends back
 * via the ``error`` query param when the URI registered in the dev-portal
 * app doesn't match the one Console uses.  Any of these should send the
 * user back to Step 1 of the Connect modal to copy the right URL.
 */
function describeIntegrationError(reason: string): string {
  const lower = reason.toLowerCase();

  // Redirect-URI mismatch — the most common first-time-setup failure.
  if (
    lower.includes('invalid_redirect_uri') ||
    lower.includes('redirect_uri_mismatch') ||
    lower.includes('redirect uri')
  ) {
    return 'The redirect URI registered with your provider doesn’t match. Re-open Connect, copy the redirect URI from Step 1, and paste it into your developer-portal app.';
  }

  if (lower.includes('access_denied')) {
    return 'You declined the request on the provider. Click Connect again to retry.';
  }

  if (lower === 'missing_credentials' || lower === 'credentials_unreadable') {
    return 'Your saved credentials couldn’t be read. Edit them and try Connect again.';
  }

  if (lower === 'missing_params' || lower.startsWith('state')) {
    return 'The Connect link expired or was reused. Click Connect again to start a fresh flow.';
  }

  if (lower.startsWith('write_failed:')) {
    const which = reason.split(':')[1] ?? '';
    return `Connection succeeded but saving ${which} failed. Try Reconnect.`;
  }

  if (lower === 'no_organisations') {
    return 'Connect succeeded but the token has access to no organisations. Confirm with the user that the connected Employment Hero account belongs to a user enrolled in at least one organisation, then Reconnect.';
  }
  if (lower.startsWith('employment hero organisations fetch returned')) {
    return 'Connect succeeded but Employment Hero rejected the organisations request — most often a missing scope on the developer-portal app. Add the org-list scope and Reconnect.';
  }

  return `Connection failed: ${reason}`;
}

/**
 * Friendly label for the ``integration_notice`` query param the OAuth
 * callback sets when auto-pin couldn't pick a single organisation.
 * Returns ``null`` for unknown notice codes so the flash hook can fall
 * back to "no notice" silently.
 */
function describeIntegrationNotice(notice: string): string | null {
  switch (notice) {
    case 'none_named':
      return 'Connected, but no named organisation was found. The runtime will fall back to the first accessible organisation. Set EMPLOYMENTHERO_ORGANISATION_ID via Settings → Secrets to pin a specific one.';
    case 'multi_named':
      return 'Connected. Multiple named organisations were available — we pinned one for you. Override via Settings → Secrets if it’s not the right one.';
    default:
      return null;
  }
}

/**
 * Read URL search params for ``integration_success`` / ``integration_error``
 * flags set by the OAuth callback redirect.  Returns the matched flag
 * (if any) and a helper to clear it from the URL after the toast fires.
 *
 * ``error.message`` is the customer-friendly message; ``error.reason``
 * is the raw machine token from the redirect (kept around for
 * logging/debug).
 *
 * ``success.notice`` is set when auto-pin couldn't make a clean choice
 * (e.g. zero / multiple named organisations on Employment Hero).  The
 * caller renders it as a secondary informational toast alongside the
 * success toast — non-blocking, but tells the user what happened and
 * how to override.
 */
export function useIntegrationCallbackFlash(): {
  success: {
    providerId: string;
    notice: { code: string; message: string } | null;
  } | null;
  error: { reason: string; message: string } | null;
  clear: () => void;
} {
  const [state, setState] = React.useState<{
    success: {
      providerId: string;
      notice: { code: string; message: string } | null;
    } | null;
    error: { reason: string; message: string } | null;
  }>({ success: null, error: null });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get('integration_success');
    const error = params.get('integration_error');
    const noticeCode = params.get('integration_notice');
    if (success) {
      const noticeMessage = noticeCode ? describeIntegrationNotice(noticeCode) : null;
      const notice =
        noticeCode && noticeMessage ? { code: noticeCode, message: noticeMessage } : null;
      setState({ success: { providerId: success, notice }, error: null });
    } else if (error) {
      setState({
        success: null,
        error: { reason: error, message: describeIntegrationError(error) },
      });
    }
  }, []);

  const clear = React.useCallback(() => {
    setState({ success: null, error: null });
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('integration_success');
    url.searchParams.delete('integration_error');
    url.searchParams.delete('integration_notice');
    window.history.replaceState({}, '', url.toString());
  }, []);

  return { ...state, clear };
}
