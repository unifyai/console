'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { INTEGRATION_PROVIDERS } from '@/constants/assistants/integrations';
import type { IntegrationProviderId } from '@/types/assistants/integration';

interface AddNewDropdownProps {
  /** Called when the user picks an option from the dropdown. */
  onSelect: (providerId: IntegrationProviderId) => void;
  disabled?: boolean;
  /** Provider ids hidden from the list — typically the set of
   *  integrations already showing as a card.  ``custom`` is never
   *  hidden. */
  hiddenProviderIds?: ReadonlySet<IntegrationProviderId>;
}

/* The auth-kind keys mirror the discriminator union from
   ``IntegrationAuthStrategy`` and intentionally use snake_case so the
   union literal types stay readable.  Disable the naming-convention
   rule for this map only — it's a 3-entry lookup, not part of any
   broader API surface. */
/* eslint-disable @typescript-eslint/naming-convention */
const STRATEGY_LABEL: Record<string, string> = {
  freeform: '',
  api_key: 'API key',
  oauth_authorization_code: 'OAuth',
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Trigger + dropdown for the Integrations tab's "Add new" button.
 * Lists Custom first (the freeform key/value flow), then each registered
 * integration with a small badge identifying its auth strategy.
 */
export function AddNewDropdown({ onSelect, disabled, hiddenProviderIds }: AddNewDropdownProps) {
  // Drop already-shown integrations from the list so the user can't
  // re-enter the empty-paste flow for something that already has a
  // card.  ``custom`` is always kept — it's the freeform fallback,
  // not an integration.
  const visibleProviders = INTEGRATION_PROVIDERS.filter(
    (p) => p.id === 'custom' || !hiddenProviderIds?.has(p.id)
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2"
          disabled={disabled}
          data-testid="integrations-add-new-trigger"
          aria-label="Add new"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-label">Add new</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Add new
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visibleProviders.map((provider, index) => {
          const isCustom = provider.id === 'custom';
          const strategyLabel = STRATEGY_LABEL[provider.auth.kind] ?? '';
          // The custom entry sits at the top; insert a separator after
          // it so the visual grouping stays the same when integrations
          // get filtered out (the original logic keyed off the registry
          // index, which breaks once the list is filtered).
          const showSeparatorAbove =
            !isCustom && index > 0 && visibleProviders[index - 1]?.id === 'custom';
          return (
            <React.Fragment key={provider.id}>
              {showSeparatorAbove && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onSelect={() => onSelect(provider.id)}
                data-testid={`integrations-add-new-${provider.id}`}
                className="flex flex-col items-start gap-0.5"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-title">{provider.label}</span>
                  {strategyLabel && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {strategyLabel}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {provider.shortDescription}
                </span>
              </DropdownMenuItem>
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
