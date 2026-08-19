'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/UI/label';
import { Button } from '@/components/UI/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { InfoSquareButton } from '@/components/UI/info-square-button';
import {
  useDefaultModelOptions,
  encodeDefaultModelValue,
  decodeDefaultModelValue,
  SYSTEM_DEFAULT_MODEL_VALUE,
} from '@/hooks/Assistants/useDefaultModelOptions';
import { searchDefaultModelOptions, type ModelCatalogUsage } from '@/lib/client/defaultModels';
import type { DefaultModelOption } from '@/types/assistants/assistant';

/** Orchestra caps the catalog page at 200; selectable models sort ahead of the rest. */
const CATALOG_PAGE_SIZE = 200;

export interface DefaultModelPickerProps {
  model: string | null;
  reasoningEffort: string | null;
  onChange: (model: string | null, reasoningEffort: string | null) => void;
  disabled?: boolean;
  id?: string;
  /** Field label above the select. */
  label?: string;
  /** Tooltip body explaining the picker. */
  tooltip?: string;
  /** Which catalog usage to load (affects system-default label). */
  usage?: ModelCatalogUsage;
  /** Which credit estimate to show under each option. */
  creditUnit?: 'task' | 'message';
}

function formatCredits(credits: number | null | undefined, suffix: string): string {
  if (credits == null) return 'Credits vary';
  return `~${new Intl.NumberFormat('en-US').format(credits)} credits / ${suffix}`;
}

/** Per-million-token rates, for catalog models with no per-task benchmark anchor. */
export function formatTokenRates(option: DefaultModelOption): string | null {
  const input = option.inputCostPerToken;
  const output = option.outputCostPerToken;
  if (input == null || output == null) return null;
  const perMillion = (rate: number) => `$${(rate * 1_000_000).toFixed(2)}`;
  return `${perMillion(input)} in / ${perMillion(output)} out per M tokens`;
}

/**
 * Cost line for an option: the credit estimate when one exists for the unit on
 * display, otherwise the model's raw token rates. Catalog models are priced per
 * token but have no task-level benchmark anchor to convert into task credits.
 */
export function formatCostLine(
  option: DefaultModelOption,
  creditUnit: 'task' | 'message',
  creditSuffix: string
): string {
  const credits =
    creditUnit === 'message' ? option.approxCreditsPerMessage : option.approxCreditsPerTask;
  if (credits != null) return formatCredits(credits, creditSuffix);
  return formatTokenRates(option) ?? 'Credits vary';
}

/**
 * Searchable catalog picker for an assistant conversation or task model.
 * Recommended curated options appear first; OpenRouter search fills the rest.
 */
export function DefaultModelPicker({
  model,
  reasoningEffort,
  onChange,
  disabled = false,
  id = 'defaultModel',
  label = 'Task model',
  tooltip = 'Used when working on tasks. Stronger models handle harder work better, but cost more per task. Credit figures are rough estimates — real tasks vary widely.',
  usage = 'actor',
  creditUnit = 'task',
}: DefaultModelPickerProps) {
  const { options: recommended, isLoading } = useDefaultModelOptions(usage);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [searchHits, setSearchHits] = React.useState<DefaultModelOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const selectedValue = encodeDefaultModelValue(model, reasoningEffort);
  const creditSuffix = creditUnit === 'message' ? 'typical message' : 'typical task';

  // An empty query lists the whole catalog newest-first, so opening the picker
  // browses every available model without having to guess a name first. Typing
  // is debounced; the initial listing is not.
  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    let cancelled = false;
    setIsSearching(true);
    const handle = window.setTimeout(
      () => {
        void (async () => {
          const result = await searchDefaultModelOptions(trimmed, usage, CATALOG_PAGE_SIZE);
          if (cancelled) return;
          setSearchHits(Array.isArray(result) ? result : []);
          setIsSearching(false);
        })();
      },
      trimmed ? 250 : 0
    );
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, usage, open]);

  // cmdk's own filtering is off (results are a server query), so the curated
  // group has to answer the query itself. Without this it renders in full
  // whatever is typed, burying the search results under a list that never
  // changes. Matched against id and label, like the catalog search.
  const matchingRecommended = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recommended;
    return recommended.filter((option) =>
      `${option.model || ''} ${option.label}`.toLowerCase().includes(needle)
    );
  }, [recommended, query]);

  // Keyed off the visible group: a curated entry the query hid should still be
  // reachable as a search hit rather than deduplicated out of both groups.
  const recommendedKeys = React.useMemo(
    () =>
      new Set(
        matchingRecommended.map((option) =>
          encodeDefaultModelValue(option.model, option.reasoningEffort)
        )
      ),
    [matchingRecommended]
  );

  const filteredSearchHits = React.useMemo(
    () =>
      searchHits.filter((hit) => {
        const key = encodeDefaultModelValue(hit.model, hit.reasoningEffort);
        return !recommendedKeys.has(key);
      }),
    [searchHits, recommendedKeys]
  );

  const allVisible = React.useMemo(() => {
    const merged = [...recommended, ...filteredSearchHits];
    if (!model) return merged;
    const selectedKey = encodeDefaultModelValue(model, reasoningEffort);
    if (
      merged.some(
        (option) => encodeDefaultModelValue(option.model, option.reasoningEffort) === selectedKey
      )
    ) {
      return merged;
    }
    return [
      {
        model,
        reasoningEffort,
        label: model,
        approxCreditsPerTask: null,
        approxCreditsPerMessage: null,
        artificialAnalysisUrl: null,
        recommended: false,
        eligible: true,
      } satisfies DefaultModelOption,
      ...merged,
    ];
  }, [recommended, filteredSearchHits, model, reasoningEffort]);

  const selectedOption = allVisible.find(
    (option) => encodeDefaultModelValue(option.model, option.reasoningEffort) === selectedValue
  );

  const triggerLabel =
    selectedOption?.label ||
    (selectedValue === SYSTEM_DEFAULT_MODEL_VALUE ? 'System Default' : model) ||
    'Select a model';

  // One renderer for every group. The recommended and search lists drifted
  // apart once before -- only the search branch honoured `eligible`, so a
  // model the account could not spend on stayed selectable in the list most
  // people pick from, and the refusal only arrived on first use.
  const renderOption = (option: DefaultModelOption) => {
    const value = encodeDefaultModelValue(option.model, option.reasoningEffort);
    const eligible = option.eligible !== false;
    return (
      <CommandItem
        key={value}
        value={value}
        disabled={!eligible}
        keywords={[option.label, option.model || '']}
        onSelect={() => {
          if (!eligible) return;
          const decoded = decodeDefaultModelValue(value);
          onChange(decoded.model, decoded.reasoningEffort);
          setOpen(false);
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <span className="truncate">{option.label}</span>
          <span className="text-caption text-muted-foreground">
            {eligible
              ? formatCostLine(option, creditUnit, creditSuffix)
              : option.disabledReason || 'Unavailable'}
          </span>
        </div>
        <Check
          className={cn('ml-auto h-4 w-4', value === selectedValue ? 'opacity-100' : 'opacity-0')}
        />
      </CommandItem>
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-row items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoSquareButton />
            </TooltipTrigger>
            <TooltipContent side="right" align="end" className="text-caption max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {/* Modal so the popover carries its own scroll lock. Portalled out of the
          enclosing dialog, it is neither that dialog's lock node nor one of its
          shards, so the dialog's lock cancels every wheel event over the list
          and the catalog cannot be scrolled. */}
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className="w-full justify-between bg-card px-3"
          >
            <span className="truncate">{isLoading ? 'Loading models...' : triggerLabel}</span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search OpenRouter models…"
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                // List navigation is handled by cmdk on the Command root, so it
                // has to reach it; everything else stays contained to the input
                // rather than reaching the dialog or page shortcuts behind it.
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') return;
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
            />
            <CommandList className="command-list-scrolls">
              <CommandEmpty>{isSearching ? 'Searching…' : 'No matching models.'}</CommandEmpty>
              {matchingRecommended.length > 0 && (
                <CommandGroup heading="Recommended">
                  {matchingRecommended.map(renderOption)}
                </CommandGroup>
              )}
              {filteredSearchHits.length > 0 && (
                <CommandGroup
                  heading={query.trim() ? 'Search results' : 'All models (newest first)'}
                >
                  {filteredSearchHits.map(renderOption)}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOption?.artificialAnalysisUrl && (
        <a
          href={selectedOption.artificialAnalysisUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          View benchmarks on Artificial Analysis ↗
        </a>
      )}
    </div>
  );
}
