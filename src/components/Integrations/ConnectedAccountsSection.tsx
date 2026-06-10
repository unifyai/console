'use client';

import * as React from 'react';
import { Activity, Check, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { Input } from '@/components/UI/input';
import { IntegrationStatusBadge } from './IntegrationStatusBadge';
import type { IntegrationConnection } from '@/types/integrations';

export function ConnectedAccountsSection({
  connections,
  busyConnectionId,
  onReconnect,
  onDisconnect,
  onCancel,
  onTest,
  onUpdateLabel,
}: {
  connections: IntegrationConnection[];
  busyConnectionId?: string | null;
  onReconnect?: (connection: IntegrationConnection) => void;
  onDisconnect?: (connection: IntegrationConnection) => void;
  onCancel?: (connection: IntegrationConnection) => void;
  onTest?: (connection: IntegrationConnection) => void;
  onUpdateLabel?: (connection: IntegrationConnection, accountLabel: string) => Promise<void> | void;
}) {
  const visibleConnections = connections.filter(
    (connection) => connection.status !== 'disconnected'
  );
  const [editingConnectionId, setEditingConnectionId] = React.useState<string | null>(null);
  const [draftLabel, setDraftLabel] = React.useState('');
  const [savingConnectionId, setSavingConnectionId] = React.useState<string | null>(null);

  if (visibleConnections.length === 0) {
    return (
      <div
        className="bg-muted/20 rounded-lg border border-dashed p-4"
        data-testid="integration-no-accounts"
      >
        <p className="text-title text-sm">No connected accounts yet</p>
        <p className="text-caption mt-1">
          Connect this app to let your assistant use it when you ask.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="integration-connected-accounts">
      {visibleConnections.map((connection, index) => {
        const busy = busyConnectionId === connection.id;
        const isPending = connection.status === 'pending';
        const isConnected = connection.status === 'connected' || connection.status === 'configured';
        const needsReconnect = [
          'error',
          'expired',
          'revoked',
          'needs_reconnect',
          'missing_scope',
          'missing_secrets',
        ].includes(connection.status);
        const hasFailed = ['error', 'expired', 'revoked', 'needs_reconnect'].includes(
          connection.status
        );
        const accountLabel =
          connection.accountLabel ||
          (isPending ? 'Authorization in progress' : `Account ${index + 1}`);
        const isEditing = editingConnectionId === connection.id;
        const isSaving = savingConnectionId === connection.id;
        const healthLabel =
          connection.healthLabel === 'ok'
            ? 'Healthy'
            : connection.healthLabel === 'error'
              ? 'Needs attention'
              : connection.healthLabel;
        return (
          <div key={connection.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <form
                    className="flex min-w-0 flex-wrap items-center gap-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!onUpdateLabel || isSaving) return;
                      setSavingConnectionId(connection.id);
                      try {
                        await onUpdateLabel(connection, draftLabel);
                        setEditingConnectionId(null);
                      } catch {
                        // Parent owns the error toast; keep the editor open for retry.
                      } finally {
                        setSavingConnectionId(null);
                      }
                    }}
                  >
                    <Input
                      value={draftLabel}
                      onChange={(event) => setDraftLabel(event.target.value)}
                      placeholder={`Account ${index + 1}`}
                      className="h-8 min-w-[220px] flex-1 text-sm"
                      disabled={isSaving}
                      autoFocus
                      data-testid={`integration-account-label-edit-${connection.id}`}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      disabled={isSaving}
                      data-testid={`integration-account-label-save-${connection.id}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      disabled={isSaving}
                      onClick={() => setEditingConnectionId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="text-title truncate text-sm">{accountLabel}</p>
                    {onUpdateLabel && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        disabled={busy || isSaving}
                        onClick={() => {
                          setEditingConnectionId(connection.id);
                          setDraftLabel(connection.accountLabel || '');
                        }}
                        aria-label={`Rename ${accountLabel}`}
                        data-testid={`integration-account-label-rename-${connection.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                {!isEditing && connection.status === 'pending' && (
                  <p className="text-caption">Waiting for authorization to finish.</p>
                )}
              </div>
              <IntegrationStatusBadge status={connection.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {healthLabel && (
                <Badge variant="outline" className="rounded-full text-muted-foreground">
                  {healthLabel}
                </Badge>
              )}
              {connection.lastCheckedAt && (
                <Badge variant="outline" className="rounded-full text-muted-foreground">
                  Checked {connection.lastCheckedAt}
                </Badge>
              )}
            </div>
            {hasFailed && (
              <p className="text-caption mt-2 text-destructive">
                Connection failed. Please retry or contact support at support@unify.ai.
              </p>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {onTest && isConnected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={busy}
                  onClick={() => onTest(connection)}
                  data-testid={`integration-test-${connection.id}`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Test
                </Button>
              )}
              {onReconnect && (isConnected || needsReconnect) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={busy}
                  onClick={() => onReconnect(connection)}
                  data-testid={`integration-reconnect-${connection.id}`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reconnect
                </Button>
              )}
              {onCancel && isPending && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={busy}
                  onClick={() => onCancel(connection)}
                  data-testid={`integration-cancel-${connection.id}`}
                >
                  Cancel setup
                </Button>
              )}
              {onDisconnect && !isPending && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs hover:text-destructive"
                  disabled={busy}
                  onClick={() => onDisconnect(connection)}
                  data-testid={`integration-disconnect-${connection.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
