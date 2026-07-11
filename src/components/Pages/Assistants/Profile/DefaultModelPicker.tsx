'use client';

import * as React from 'react';
import { Label } from '@/components/UI/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { InfoSquareButton } from '@/components/UI/info-square-button';
import {
  useDefaultModelOptions,
  encodeDefaultModelValue,
  decodeDefaultModelValue,
} from '@/hooks/Assistants/useDefaultModelOptions';
import type { ModelCatalogUsage } from '@/lib/client/defaultModels';

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

/**
 * Catalog picker for an assistant conversation or task model.
 * System Default leaves the field unset; other options pin a concrete model.
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
  const { options, isLoading } = useDefaultModelOptions(usage);
  const selectedValue = encodeDefaultModelValue(model, reasoningEffort);
  const selectedOption = options.find(
    (option) => encodeDefaultModelValue(option.model, option.reasoningEffort) === selectedValue
  );
  const creditSuffix = creditUnit === 'message' ? 'typical message' : 'typical task';

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
      <Select
        value={selectedValue}
        onValueChange={(value) => {
          const decoded = decodeDefaultModelValue(value);
          onChange(decoded.model, decoded.reasoningEffort);
        }}
        disabled={disabled || isLoading || options.length === 0}
      >
        <SelectTrigger id={id} className="bg-card">
          <SelectValue placeholder={isLoading ? 'Loading models...' : 'Select a model'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => {
            const credits =
              creditUnit === 'message'
                ? option.approxCreditsPerMessage
                : option.approxCreditsPerTask;
            return (
              <SelectItem
                key={encodeDefaultModelValue(option.model, option.reasoningEffort)}
                value={encodeDefaultModelValue(option.model, option.reasoningEffort)}
              >
                <div className="flex flex-col items-start">
                  <span>{option.label}</span>
                  <span className="text-caption text-muted-foreground">
                    ~{new Intl.NumberFormat('en-US').format(credits)} credits / {creditSuffix}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {selectedOption && (
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
