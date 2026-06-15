'use client';

import { AlertCircle, CheckCircle2, Clock3, PlugZap, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/UI/badge';
import { cn } from '@/lib/utils';
import type { IntegrationConnectionStatus } from '@/types/integrations';

const STATUS_LABEL: Record<IntegrationConnectionStatus, string> = {
  connected: 'Connected',
  configured: 'Configured',
  pending: 'Connecting',
  ['missing_scope']: 'Needs attention',
  ['missing_secrets']: 'Needs setup',
  ['needs_reconnect']: 'Reconnect',
  expired: 'Needs attention',
  revoked: 'Needs attention',
  disconnected: 'Disconnected',
  error: 'Needs attention',
  ['not_connected']: 'Not connected',
};

function StatusIcon({ status }: { status: IntegrationConnectionStatus }) {
  if (status === 'connected' || status === 'configured')
    return <CheckCircle2 className="h-3 w-3" />;
  if (status === 'pending') return <Clock3 className="h-3 w-3" />;
  if (status === 'error' || status === 'revoked') return <ShieldAlert className="h-3 w-3" />;
  if (status === 'expired' || status === 'needs_reconnect')
    return <RefreshCw className="h-3 w-3" />;
  if (status === 'missing_scope' || status === 'missing_secrets') {
    return <AlertCircle className="h-3 w-3" />;
  }
  return <PlugZap className="h-3 w-3" />;
}

export function statusLabel(status: IntegrationConnectionStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function IntegrationStatusBadge({
  status,
  className,
}: {
  status: IntegrationConnectionStatus;
  className?: string;
}) {
  const tone =
    status === 'connected' || status === 'configured'
      ? 'text-success'
      : status === 'pending' || status === 'missing_scope' || status === 'needs_reconnect'
        ? 'text-warning'
        : status === 'error' || status === 'expired' || status === 'revoked'
          ? 'text-error'
          : 'text-muted-foreground';
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 rounded-full bg-background text-[10px] uppercase tracking-wide',
        tone,
        className
      )}
      data-testid={`integration-status-${status}`}
    >
      <StatusIcon status={status} />
      {statusLabel(status)}
    </Badge>
  );
}
