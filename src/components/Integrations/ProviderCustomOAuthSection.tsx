'use client';

import * as React from 'react';
import { CheckCircle2, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import {
  deleteProviderCustomAuthConfig,
  listProviderCustomAuthConfigs,
  setProviderCustomAuthConfig,
  type ProviderCustomAuthConfig,
} from '@/lib/client/integrations';
import type { IntegrationGalleryItem } from '@/types/integrations';

function toolkitSlugFor(item: IntegrationGalleryItem): string {
  return String(item.sourceMetadata?.providerAppId || item.canonicalSlug || '').trim();
}

function matchesToolkitSlug(
  config: ProviderCustomAuthConfig,
  toolkitSlug: string,
  canonicalSlug: string
): boolean {
  const configSlug = config.toolkitSlug.toUpperCase();
  return configSlug === toolkitSlug.toUpperCase() || configSlug === canonicalSlug.toUpperCase();
}

/**
 * Admin surface for configuring a "bring your own OAuth" app for a provider
 * toolkit. Some toolkits (e.g. TikTok) have no Composio-managed OAuth
 * credentials, so connecting requires the operator to register their own OAuth
 * app and supply its client id/secret. The secret is forwarded to the provider
 * vault by Orchestra and is never stored in or returned by Orchestra.
 *
 * This is platform/operator-level configuration (a single dev app shared by all
 * connections of that toolkit), so it should only be rendered for users allowed
 * to manage integration backends.
 */
export function ProviderCustomOAuthSection({
  item,
  backendId = 'composio',
}: {
  item: IntegrationGalleryItem;
  backendId?: string;
}) {
  const toolkitSlug = toolkitSlugFor(item);
  const canonicalSlug = String(item.canonicalSlug || '');
  const displayName = item.displayName;
  const supportsOAuth = item.authModes?.some((mode) => String(mode).toLowerCase() === 'oauth');

  const [existing, setExisting] = React.useState<ProviderCustomAuthConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [oauthCallbackUrl, setOauthCallbackUrl] = React.useState<string | null>(null);
  const [clientId, setClientId] = React.useState('');
  const [clientSecret, setClientSecret] = React.useState('');
  const [scopes, setScopes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  // Depend only on stable primitives (not the `item` object, which the parent
  // catalog recreates on every poll) so this effect doesn't refire and reload
  // the panel on a loop.
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configs = await listProviderCustomAuthConfigs(backendId);
      setExisting(
        configs.find((config) => matchesToolkitSlug(config, toolkitSlug, canonicalSlug)) ?? null
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load custom OAuth.');
    } finally {
      setLoading(false);
    }
  }, [backendId, toolkitSlug, canonicalSlug]);

  React.useEffect(() => {
    if (!supportsOAuth || !toolkitSlug) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh, supportsOAuth, toolkitSlug]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/integrations/composio-oauth-callback-url', {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { oauthRedirectUri?: string };
        if (!cancelled && payload.oauthRedirectUri) {
          setOauthCallbackUrl(payload.oauthRedirectUri);
        }
      } catch {
        // Display falls back to the stored config value when available.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!supportsOAuth || !toolkitSlug) return null;

  const redirectUri =
    existing?.oauthRedirectUri || oauthCallbackUrl || 'Loading redirect URI…';

  const canSubmit = clientId.trim().length > 0 && clientSecret.trim().length > 0 && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await setProviderCustomAuthConfig(backendId, {
        toolkitSlug,
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        scopes: scopes
          .split(/[\s,]+/)
          .map((scope) => scope.trim())
          .filter(Boolean),
        displayName: `${displayName} (custom OAuth)`,
      });
      setExisting(saved);
      setClientId('');
      setClientSecret('');
      setScopes('');
      setSavedAt(Date.now());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save custom OAuth.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await deleteProviderCustomAuthConfig(backendId, toolkitSlug);
      setExisting(null);
      setSavedAt(null);
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : 'Failed to remove custom OAuth.'
      );
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="space-y-3" data-testid="provider-custom-oauth-section">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h3 className="text-title text-base">Bring your own OAuth (admin)</h3>
      </div>
      <p className="text-caption">
        Use your own OAuth app for {displayName} to show your branding on the consent screen,
        request custom scopes, or connect a provider without Composio-managed credentials. The
        client secret is stored in the provider vault, never by Unify.
      </p>

      <Alert className="bg-muted/20">
        <AlertTitle className="text-xs">Authorized redirect URI</AlertTitle>
        <AlertDescription>
          <p className="text-caption">
            Set this as the redirect/callback URI in your provider developer portal before saving:
          </p>
          <code className="mt-1 block break-all rounded bg-background px-2 py-1 font-mono text-[11px]">
            {redirectUri}
          </code>
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" data-testid="provider-custom-oauth-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-caption flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : existing ? (
        <div
          className="space-y-3 rounded-xl border bg-card p-4"
          data-testid="provider-custom-oauth-configured"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[color:var(--status-success)]" />
              <div>
                <p className="text-title text-sm">Custom OAuth configured</p>
                <p className="text-caption font-mono">{existing.authConfigId}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-destructive"
              disabled={removing}
              onClick={() => void handleRemove()}
              data-testid="provider-custom-oauth-remove"
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove
            </Button>
          </div>
          {existing.scopes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {existing.scopes.map((scope) => (
                <span
                  key={scope}
                  className="bg-muted/40 rounded-full border px-2 py-0.5 font-mono text-[10px] leading-4 text-muted-foreground"
                >
                  {scope}
                </span>
              ))}
            </div>
          )}
          <p className="text-caption">
            New connections for {displayName} will use this OAuth app. Remove it to fall back to
            Composio-managed auth (where available).
          </p>
        </div>
      ) : (
        <form
          className="space-y-3 rounded-xl border bg-card p-4"
          onSubmit={handleSubmit}
          data-testid="provider-custom-oauth-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="custom-oauth-client-id">Client ID</Label>
            <Input
              id="custom-oauth-client-id"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="Your OAuth app client ID"
              data-testid="provider-custom-oauth-client-id"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-oauth-client-secret">Client secret</Label>
            <Input
              id="custom-oauth-client-secret"
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              placeholder="Your OAuth app client secret"
              data-testid="provider-custom-oauth-client-secret"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-oauth-scopes">
              Scopes{' '}
              <span className="text-muted-foreground">(optional, space or comma separated)</span>
            </Label>
            <Input
              id="custom-oauth-scopes"
              value={scopes}
              onChange={(event) => setScopes(event.target.value)}
              placeholder="e.g. user.info.basic video.publish"
              data-testid="provider-custom-oauth-scopes"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            data-testid="provider-custom-oauth-submit"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save OAuth app
          </Button>
          {savedAt !== null && (
            <p className="text-caption text-[color:var(--status-success)]">Saved.</p>
          )}
        </form>
      )}
    </section>
  );
}
