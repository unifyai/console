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
import {
  searchDefaultModelOptions,
  type ModelCatalogUsage,
} from '@/lib/client/defaultModels';
import type { DefaultModelOption } from '@/types/assistants/assistant';

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

  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchHits([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        const result = await searchDefaultModelOptions(trimmed, usage);
        if (cancelled) return;
        if (Array.isArray(result)) {
          setSearchHits(result);
        } else {
          setSearchHits([]);
        }
        setIsSearching(false);
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, usage, open]);

  const recommendedKeys = React.useMemo(
    () =>
      new Set(
        recommended.map((option) => encodeDefaultModelValue(option.model, option.reasoningEffort))
      ),
    [recommended]
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
    if (merged.some((option) => encodeDefaultModelValue(option.model, option.reasoningEffort) === selectedKey)) {
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className="bg-card w-full justify-between px-3"
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
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
            />
            <CommandList>
              <CommandEmpty>
                {isSearching ? 'Searching…' : 'No matching models.'}
              </CommandEmpty>
              <CommandGroup heading="Recommended">
                {recommended.map((option) => {
                  const value = encodeDefaultModelValue(option.model, option.reasoningEffort);
                  const credits =
                    creditUnit === 'message'
                      ? option.approxCreditsPerMessage
                      : option.approxCreditsPerTask;
                  return (
                    <CommandItem
                      key={value}
                      value={value}
                      keywords={[option.label, option.model || '']}
                      onSelect={() => {
                        const decoded = decodeDefaultModelValue(value);
                        onChange(decoded.model, decoded.reasoningEffort);
                        setOpen(false);
                      }}
                    >
                      <div className="flex min-w-0 flex-1 flex-col items-start">
                        <span className="truncate">{option.label}</span>
                        <span className="text-caption text-muted-foreground">
                          {formatCredits(credits, creditSuffix)}
                        </span>
                      </div>
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4',
                          value === selectedValue ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {filteredSearchHits.length > 0 && (
                <CommandGroup heading="OpenRouter">
                  {filteredSearchHits.map((option) => {
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
                              ? formatCredits(null, creditSuffix)
                              : option.disabledReason || 'Unavailable'}
                          </span>
                        </div>
                        <Check
                          className={cn(
                            'ml-auto h-4 w-4',
                            value === selectedValue ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </CommandItem>
                    );
                  })}
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
