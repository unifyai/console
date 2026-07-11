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

export interface DefaultModelPickerProps {
  model: string | null;
  reasoningEffort: string | null;
  onChange: (model: string | null, reasoningEffort: string | null) => void;
  disabled?: boolean;
  id?: string;
}

/**
 * Catalog picker for an assistant's default (actor) LLM.
 * System Default leaves the field unset; other options pin a concrete model.
 */
export function DefaultModelPicker({
  model,
  reasoningEffort,
  onChange,
  disabled = false,
  id = 'defaultModel',
}: DefaultModelPickerProps) {
  const { options, isLoading } = useDefaultModelOptions();
  const selectedValue = encodeDefaultModelValue(model, reasoningEffort);
  const selectedOption = options.find(
    (option) => encodeDefaultModelValue(option.model, option.reasoningEffort) === selectedValue
  );

  return (
    <div className="space-y-1.5">
      <div className="flex flex-row items-center gap-2">
        <Label htmlFor={id}>Default model</Label>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoSquareButton />
            </TooltipTrigger>
            <TooltipContent side="right" align="end" className="text-caption max-w-xs">
              <p>
                The model this teammate thinks with by default for actor / tool-loop work. Premium
                models are substantially more capable but cost more per task. Credit figures are
                rough per-task estimates — real tasks vary widely.
              </p>
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
          {options.map((option) => (
            <SelectItem
              key={encodeDefaultModelValue(option.model, option.reasoningEffort)}
              value={encodeDefaultModelValue(option.model, option.reasoningEffort)}
            >
              <div className="flex flex-col items-start">
                <span>{option.label}</span>
                <span className="text-caption text-muted-foreground">
                  ~{new Intl.NumberFormat('en-US').format(option.approxCreditsPerTask)} credits /
                  typical task
                </span>
              </div>
            </SelectItem>
          ))}
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
