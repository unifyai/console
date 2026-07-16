'use client';

import * as React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Button } from '@/components/UI/button';

export type IntegrationOAuthWaitingState = {
  canonicalSlug: string;
  displayName: string;
  accountLabel?: string;
  connectUrl?: string | null;
  mode: 'popup' | 'manual';
};

export type IntegrationConnectSuccessState = {
  canonicalSlug: string;
  displayName: string;
  accountLabel?: string;
  accountCount: number;
};

export function IntegrationOAuthWaitingBanner({
  waiting,
  onCancel,
  onCopyAuthorizeUrl,
}: {
  waiting: IntegrationOAuthWaitingState;
  onCancel: () => void;
  onCopyAuthorizeUrl?: () => void;
}) {
  const label = waiting.accountLabel?.trim() || waiting.displayName;
  return (
    <Alert
      className="border-[color:var(--status-warning)]/40 bg-[var(--status-warning-bg)]"
      data-testid="integration-oauth-waiting"
    >
      <Loader2 className="h-4 w-4 animate-spin text-[color:var(--status-warning)]" />
      <AlertTitle>Waiting for authorization…</AlertTitle>
      <AlertDescription>
        <p>
          Complete sign-in in the {waiting.mode === 'manual' ? 'private window' : 'popup'} for{' '}
          <span className="font-medium text-foreground">{label}</span>. This sheet stays open so you
          can add another account right after.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          <li>Prefer “Use another account” / account picker if shown</li>
          <li>Avoid approving if the wrong username is shown</li>
          <li>Stuck on the same user? Cancel and use a private window</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {waiting.connectUrl && onCopyAuthorizeUrl ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCopyAuthorizeUrl}
              data-testid="integration-oauth-waiting-copy-url"
            >
              Copy authorize URL
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancel}
            data-testid="integration-oauth-waiting-cancel"
          >
            Cancel waiting
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function IntegrationConnectSuccessBanner({
  success,
  onAddAnother,
  onDone,
}: {
  success: IntegrationConnectSuccessState;
  onAddAnother: () => void;
  onDone: () => void;
}) {
  const label = success.accountLabel?.trim();
  return (
    <Alert
      className="border-[color:var(--status-success)]/40 bg-[var(--status-success-bg)]"
      data-testid="integration-connect-success"
    >
      <CheckCircle2 className="h-4 w-4 text-[color:var(--status-success)]" />
      <AlertTitle>Connected{label ? ` ${label}` : ` ${success.displayName}`}</AlertTitle>
      <AlertDescription>
        <p>
          {success.displayName} now has {success.accountCount} account
          {success.accountCount === 1 ? '' : 's'} on this assistant. Each account can have its own
          tool permissions.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onAddAnother}
            data-testid="integration-connect-add-another"
          >
            Add another account
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDone}
            data-testid="integration-connect-success-done"
          >
            Done
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
