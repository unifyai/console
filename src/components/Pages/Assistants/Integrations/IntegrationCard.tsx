'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import type {
  IntegrationCardState,
  IntegrationProviderConfig,
} from '@/types/assistants/integration';
import { ProviderIcon } from './ProviderIcon';

interface IntegrationCardProps {
  provider: IntegrationProviderConfig;
  state: IntegrationCardState;
  onEdit: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  /** Caller manages global busy state (e.g. while Connect/Disconnect is in flight). */
  busy?: boolean;
}

/**
 * Status-aware row for one integration.  Renders the provider's label,
 * a status badge, a one-line description, and the appropriate action
 * buttons depending on whether the integration is OAuth or API-key.
 *
 * Per the universal-masking decision, the card never displays any
 * actual secret values — even non-sensitive metadata lives only as
 * boolean presence.
 */
export function IntegrationCard({
  provider,
  state,
  onEdit,
  onReconnect,
  onDisconnect,
  busy,
}: IntegrationCardProps) {
  const isOAuth = provider.auth.kind === 'oauth_authorization_code';

  const statusBadge = (() => {
    switch (state.kind) {
      case 'connected':
        return (
          <span className="border-[color:var(--role-green-deep)]/20 bg-[color:var(--role-green)]/12 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--role-green-deep)] dark:text-[color:var(--role-green)]">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </span>
        );
      case 'configured':
        return (
          <span className="border-[color:var(--role-blue)]/20 bg-[color:var(--role-blue)]/10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--role-blue)]">
            <CheckCircle2 className="h-3 w-3" />
            Configured
          </span>
        );
      case 'needs_reconnect':
        return (
          <span className="border-[color:var(--role-orange)]/25 bg-[color:var(--role-orange)]/10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--role-orange)]">
            <AlertCircle className="h-3 w-3" />
            {isOAuth ? 'Reconnect' : 'Action needed'}
          </span>
        );
    }
  })();

  const subtitle = (() => {
    switch (state.kind) {
      case 'connected':
        return 'OAuth credentials configured.';
      case 'configured':
        return `${provider.label} credentials configured.`;
      case 'needs_reconnect':
        if (state.missing.length > 0) {
          return `Missing: ${state.missing.join(', ')}.`;
        }
        return 'The refresh token expired or was revoked.';
    }
  })();

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-card-foreground shadow-sm"
      data-testid={`integration-card-${provider.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ProviderIcon provider={provider} className="h-5 w-5" />
          <span className="text-title truncate">{provider.label}</span>
          {statusBadge}
        </div>
        <p className="text-caption ml-7 truncate">{subtitle}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isOAuth && state.kind === 'needs_reconnect' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onReconnect}
            disabled={busy}
            data-testid={`integration-reconnect-${provider.id}`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reconnect
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onEdit}
          disabled={busy}
          data-testid={`integration-edit-${provider.id}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-caption h-7 gap-1 px-2 hover:text-destructive"
          onClick={onDisconnect}
          disabled={busy}
          data-testid={`integration-disconnect-${provider.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
