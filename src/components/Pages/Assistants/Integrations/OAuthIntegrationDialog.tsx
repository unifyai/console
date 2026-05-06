'use client';

import * as React from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import type { IntegrationProviderConfig } from '@/types/assistants/integration';

export interface OAuthSubmitPayload {
  /** Map of secretKey -> new value.  Only fields the user actually
   *  changed are present.  Empty when nothing changed (caller should
   *  noop). */
  changedFields: Record<string, string>;
  /** True if any customer-provided credential changed and the caller
   *  should trigger a Connect/reconnect.  False for Add mode (always
   *  needs connect) is a misnomer — see ``mode`` below. */
  anyChanged: boolean;
}

interface OAuthIntegrationDialogProps {
  open: boolean;
  /** ``add`` opens with empty fields and forces Connect after save.
   *  ``edit`` shows masked placeholders; if any field changes, the
   *  caller deletes managed secrets and triggers Connect. */
  mode: 'add' | 'edit';
  provider: IntegrationProviderConfig;
  isSubmitting: boolean;
  /** Called when the user clicks Save and Connect.  Caller persists
   *  the changedFields, deletes managed secrets if needed, then
   *  navigates to the OAuth authorize URL. */
  onSubmit: (payload: OAuthSubmitPayload) => Promise<void>;
  onClose: () => void;
}

/**
 * Dialog for the ``oauth_authorization_code`` auth strategy.
 *
 * In ``edit`` mode, every field renders as a masked password input with
 * an empty value — typing replaces the stored value, leaving empty
 * keeps it.  This is the universal-masking rule for the Integrations
 * tab applied uniformly to non-sensitive client_id and sensitive
 * client_secret alike.
 */
export function OAuthIntegrationDialog({
  open,
  mode,
  provider,
  isSubmitting,
  onSubmit,
  onClose,
}: OAuthIntegrationDialogProps) {
  // Per-field input state.  Empty string means "keep existing" in edit
  // mode and "missing" in add mode.
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues({});
      setCopied(false);
    }
  }, [open]);

  // The exact URL the customer must register as a Redirect URI inside
  // their provider's developer-portal app.  Computed client-side so it
  // matches whatever origin the user is on (works for localhost dev,
  // staging, prod without env wiring).  Mirrors the
  // ``oauth/<providerId>/callback`` route the callback handler lives at.
  const redirectUri = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/oauth/${provider.id}/callback`;
  }, [provider.id]);

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      toast.success('Redirect URI copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  if (provider.auth.kind !== 'oauth_authorization_code') {
    return null;
  }
  const fields = provider.auth.fields;

  const isEditing = mode === 'edit';
  const titlePrefix = isEditing ? 'Edit' : 'Connect';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.secretKey] ?? '').trim();
      if (v) trimmed[f.secretKey] = v;
    }

    if (!isEditing) {
      // Add mode: every field must be supplied.
      const missing = fields.filter((f) => !trimmed[f.secretKey]);
      if (missing.length > 0) {
        // The submit button is disabled in this state, but guard anyway.
        return;
      }
    }

    await onSubmit({
      changedFields: trimmed,
      anyChanged: Object.keys(trimmed).length > 0,
    });
  };

  const allFilled = fields.every((f) => (values[f.secretKey] ?? '').trim().length > 0);
  const submitDisabled = isSubmitting || (!isEditing && !allFilled);

  const submitLabel = (() => {
    if (isSubmitting) return 'Saving…';
    if (isEditing) {
      const anyChanged = fields.some((f) => (values[f.secretKey] ?? '').trim().length > 0);
      return anyChanged ? 'Save and Connect' : 'Save';
    }
    return 'Save and Connect';
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-w-lg" data-testid={`integration-oauth-dialog-${provider.id}`}>
        <DialogHeader>
          <DialogTitle>
            {titlePrefix} {provider.label}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-w-0 flex-col gap-4 overflow-hidden pt-1"
          data-testid="integration-oauth-form"
        >
          <p className="text-caption">
            {provider.shortDescription}
            {provider.docsUrl && (
              <>
                {' '}
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  How to set up &rarr;
                </a>
              </>
            )}
          </p>

          {!isEditing && (
            <div
              className="bg-muted/30 flex flex-col gap-2 rounded-md border p-3"
              data-testid={`integration-oauth-redirect-uri-${provider.id}`}
            >
              <p className="text-label">Step 1 — Add this redirect URI</p>
              <p className="text-caption">
                Open your {provider.label} developer-portal app and paste the URL below into its
                &quot;Redirect URIs&quot; field. Save the app, then continue to Step 2.
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <code className="text-code-sm min-w-0 flex-1 truncate rounded border bg-background px-2 py-1.5">
                  {redirectUri}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1 px-2"
                  onClick={handleCopyRedirectUri}
                  disabled={isSubmitting || !redirectUri}
                  data-testid={`integration-oauth-copy-redirect-uri-${provider.id}`}
                  aria-label="Copy redirect URI"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {(() => {
            const inputs = fields.map((field) => (
              <div key={field.secretKey} className="flex flex-col gap-1.5">
                <Label htmlFor={`oauth-${field.secretKey}`} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`oauth-${field.secretKey}`}
                  type="password"
                  autoComplete="new-password"
                  value={values[field.secretKey] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.secretKey]: e.target.value }))
                  }
                  placeholder={isEditing ? '••••••••' : (field.placeholder ?? '')}
                  disabled={isSubmitting}
                  data-testid={`integration-oauth-input-${field.secretKey}`}
                />
                {field.helpText && (
                  <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ));

            if (isEditing) return inputs;

            return (
              <div
                className="bg-muted/30 flex flex-col gap-3 rounded-md border p-3"
                data-testid={`integration-oauth-credentials-${provider.id}`}
              >
                <p className="text-label">Step 2 — Paste your app credentials</p>
                {inputs}
              </div>
            );
          })()}

          {isEditing ? (
            <p className="text-[11px] text-muted-foreground">
              Empty input means &quot;keep existing&quot;. Changing either value will reconnect to{' '}
              {provider.label}.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              After saving, you&apos;ll be redirected to {provider.label} to grant access.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitDisabled}
              data-testid="integration-oauth-submit"
            >
              {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
