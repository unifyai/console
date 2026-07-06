'use client';

import { Layers3, PlugZap } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { Card, CardContent } from '@/components/UI/card';
import { IntegrationStatusBadge } from './IntegrationStatusBadge';
import { integrationAuthLabels, integrationTypeLabel } from './integrationType';
import type { IntegrationGalleryItem } from '@/types/integrations';

function primaryCta(item: IntegrationGalleryItem): string {
  if (item.sourceMetadata?.sourceType === 'native') return 'View';
  if (item.status === 'connected' || item.status === 'configured') return 'Manage';
  if (item.status === 'pending') return 'Resume setup';
  if (item.status === 'expired' || item.status === 'revoked' || item.status === 'needs_reconnect') {
    return 'Reconnect';
  }
  if (
    item.status === 'error' ||
    item.status === 'missing_scope' ||
    item.status === 'missing_secrets'
  ) {
    return 'Reconnect';
  }
  return 'Connect';
}

export function ProviderIntegrationCard({
  item,
  busy,
  onOpen,
  onPrimaryAction,
}: {
  item: IntegrationGalleryItem;
  busy?: boolean;
  onOpen: (item: IntegrationGalleryItem) => void;
  onPrimaryAction: (item: IntegrationGalleryItem) => void;
}) {
  const toolCount = item.toolCount ?? item.tools.length;
  const authLabels = integrationAuthLabels(item);
  const isConnected = item.status === 'connected' || item.status === 'configured';
  return (
    <Card
      role="button"
      tabIndex={0}
      className="group relative min-h-[214px] cursor-pointer overflow-hidden shadow-sm transition hover:-translate-y-0.5 hover:border-primary-tint-40 hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(item);
      }}
      data-testid={`provider-integration-card-${item.canonicalSlug}`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-primary-tint-60 opacity-70" />
      <CardContent className="flex h-full flex-col p-4 pt-5">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-muted/40 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
              {item.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.iconUrl} alt="" loading="lazy" className="h-8 w-8 object-contain" />
              ) : item.source === 'static_package' ? (
                <Layers3 className="h-5 w-5 text-primary" />
              ) : (
                <PlugZap className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-title truncate text-sm">{item.displayName}</h3>
              <p className="text-caption truncate">{integrationTypeLabel(item)}</p>
            </div>
          </div>
          <IntegrationStatusBadge status={item.status} className="shrink-0 self-start" />
        </div>

        <p className="text-body-muted mt-3 line-clamp-2 min-h-[2.5rem]">
          {item.description || 'Connect this app so your assistant can use it when you ask.'}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {authLabels.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="rounded-full border-primary-tint-20 bg-primary-tint-5 text-foreground"
            >
              {label}
            </Badge>
          ))}
          {toolCount > 0 && (
            <Badge variant="outline" className="rounded-full bg-background text-muted-foreground">
              {toolCount} tools
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
          <button
            type="button"
            className="text-caption truncate text-left hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item);
            }}
            data-testid={`integration-card-details-${item.canonicalSlug}`}
          >
            View details
          </button>
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs"
            variant={isConnected ? 'outline' : 'default'}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onPrimaryAction(item);
            }}
            data-testid={`integration-card-primary-${item.canonicalSlug}`}
          >
            {primaryCta(item)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
