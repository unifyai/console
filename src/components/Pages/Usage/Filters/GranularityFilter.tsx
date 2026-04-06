'use client';

/**
 * GranularityFilter Component
 *
 * Dropdown to select time granularity for usage data aggregation.
 */

import * as React from 'react';
import { Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { TimeGranularity, GRANULARITY_LABELS } from '@/types/usage';

interface GranularityFilterProps {
  /** Current granularity value */
  value: TimeGranularity;
  /** Callback when granularity changes */
  onChange: (value: TimeGranularity) => void;
  /** Whether the filter is disabled */
  disabled?: boolean;
}

const GRANULARITY_OPTIONS: TimeGranularity[] = [
  'time_minute',
  'time_hour',
  'time_day',
  'time_month',
  'time_year',
];

export function GranularityFilter({ value, onChange, disabled = false }: GranularityFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimeGranularity)} disabled={disabled}>
      <SelectTrigger className="h-8 w-full sm:w-[140px]" data-testid="granularity-filter">
        <Clock className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          <SelectValue placeholder="Granularity" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {GRANULARITY_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {GRANULARITY_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default GranularityFilter;
