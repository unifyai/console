'use client';

/**
 * TimeframeFilter Component
 *
 * Date range picker for filtering usage data by time period.
 * Wraps the existing DateRangeSelector component.
 */

import * as React from 'react';
import { DateRangeSelector } from '@/components/Common/Time/DateRangeSelector';

interface TimeframeFilterProps {
  /** Start date in ISO format */
  startDate: string;
  /** End date in ISO format */
  endDate: string;
  /** Callback when date range changes */
  onDateRangeChange: (startDate: string, endDate: string) => void;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function TimeframeFilter({
  startDate,
  endDate,
  onDateRangeChange,
  disabled = false,
  className,
}: TimeframeFilterProps) {
  return (
    <div className={className} data-testid="timeframe-filter">
      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={onDateRangeChange}
        className={disabled ? 'pointer-events-none opacity-50' : ''}
        buttonClassName="text-body h-8"
      />
    </div>
  );
}

export default TimeframeFilter;
