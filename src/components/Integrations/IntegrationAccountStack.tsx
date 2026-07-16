'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import type { IntegrationConnection, IntegrationGalleryItem } from '@/types/integrations';

function liveConnections(item: IntegrationGalleryItem): IntegrationConnection[] {
  return (item.connections ?? []).filter((connection) => connection.status !== 'disconnected');
}

function accountInitial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 1).toUpperCase();
}

function accountLabel(connection: IntegrationConnection): string {
  return (
    connection.accountLabel?.trim() ||
    connection.sourceMetadata?.providerConnectionId ||
    connection.id
  );
}

/**
 * Compact account stack for gallery cards: up to three initials chips plus a
 * +N overflow, with a tooltip listing every live account label.
 */
export function IntegrationAccountStack({
  item,
  maxVisible = 3,
}: {
  item: IntegrationGalleryItem;
  maxVisible?: number;
}) {
  const accounts = liveConnections(item);
  if (accounts.length === 0) return null;

  const visible = accounts.slice(0, maxVisible);
  const overflow = accounts.length - visible.length;
  const tooltipLabels = accounts.map(accountLabel).join(', ');

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="mt-2 flex min-w-0 items-center gap-1.5"
            data-testid={`integration-card-accounts-${item.canonicalSlug}`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <div className="flex -space-x-1.5">
              {visible.map((connection) => {
                const label = accountLabel(connection);
                return (
                  <span
                    key={connection.id}
                    title={label}
                    className="text-caption flex h-6 w-6 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-foreground"
                    data-testid={`integration-card-account-chip-${connection.id}`}
                  >
                    {accountInitial(label)}
                  </span>
                );
              })}
              {overflow > 0 ? (
                <span className="text-caption flex h-6 w-6 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-muted-foreground">
                  +{overflow}
                </span>
              ) : null}
            </div>
            <span className="text-caption truncate text-muted-foreground">
              {accounts.length} account{accounts.length === 1 ? '' : 's'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs leading-5">{tooltipLabels}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
