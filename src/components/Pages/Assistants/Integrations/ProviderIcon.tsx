'use client';

import * as React from 'react';
import { Plug2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntegrationProviderConfig } from '@/types/assistants/integration';

interface ProviderIconProps {
  provider: IntegrationProviderConfig;
  className?: string;
}

/**
 * Renders a provider's logo, with a generic fallback when no library
 * icon is wired:
 *
 *  1. ``iconComponent`` — ``react-icons/si`` import.  Preferred when the
 *     brand exists in Simple Icons (tree-shaken with the rest of the
 *     bundle, brand colour baked in, theme-aware where the library
 *     mark already supports it).
 *  2. Fallback — lucide's ``Plug2`` glyph, the same icon the right-pane
 *     "Integrations" tab header uses (see ``RightPaneContainer``).
 *     Covers the freeform ``custom`` entry and any provider whose brand
 *     isn't in the icon library yet.
 *
 * Sizing comes from the caller via ``className`` — typically ``h-4 w-4``
 * for the ``Add new`` dropdown items, ``h-5 w-5`` for integration cards.
 */
export function ProviderIcon({ provider, className }: ProviderIconProps) {
  if (provider.iconComponent) {
    const Icon = provider.iconComponent;
    return <Icon className={cn('shrink-0', className, provider.iconClassName)} />;
  }
  return <Plug2 className={cn('shrink-0 text-muted-foreground', className)} />;
}
