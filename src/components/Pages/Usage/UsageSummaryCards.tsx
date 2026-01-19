'use client';

/**
 * UsageSummaryCards Component
 *
 * Displays three summary cards showing Total, Average, and Peak usage.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/UI/card';
import { UsageSummary } from '@/types/usage';
import { formatCostForDisplay } from '@/utils/usage/formatters';
import { formatTimestampForDisplay } from '@/utils/usage/dateUtils';
import { DollarSign, TrendingUp, Zap, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface UsageSummaryCardsProps {
  /** Summary statistics to display */
  summary: UsageSummary;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Granularity for formatting peak timestamp */
  granularity?: 'time_minute' | 'time_hour' | 'time_day' | 'time_month' | 'time_year';
}

interface SummaryCardProps {
  /** Card title */
  title: string;
  /** Main value to display */
  value: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Icon to display */
  icon: React.ReactNode;
  /** Whether loading */
  isLoading?: boolean;
  /** Test ID for the card */
  testId: string;
  /** Optional info tooltip content */
  infoTooltip?: React.ReactNode;
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  isLoading = false,
  testId,
  infoTooltip,
}: SummaryCardProps) {
  return (
    <Card className="flex-1" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {infoTooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                        aria-label="More information"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {infoTooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value}</p>
            )}
            {subtitle && !isLoading && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="bg-primary/10 shrink-0 rounded-full p-2 text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UsageSummaryCards({
  summary,
  isLoading = false,
  granularity = 'time_day',
}: UsageSummaryCardsProps) {
  // Format the peak timestamp for display
  const peakSubtitle = React.useMemo(() => {
    if (!summary.peakTimestamp) {
      return undefined;
    }
    return `Peak on ${formatTimestampForDisplay(summary.peakTimestamp, granularity)}`;
  }, [summary.peakTimestamp, granularity]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="usage-summary-cards">
      <SummaryCard
        title="Total Cost"
        value={formatCostForDisplay(summary.total)}
        icon={<DollarSign className="h-5 w-5" />}
        isLoading={isLoading}
        testId="summary-card-total"
        infoTooltip={
          <p className="text-sm">
            <strong>Billed Cost</strong> represents the total LLM credits consumed by your
            assistant(s). This includes all API calls, token usage, and any associated processing
            fees.
          </p>
        }
      />
      <SummaryCard
        title="Average per Period"
        value={formatCostForDisplay(summary.average)}
        icon={<TrendingUp className="h-5 w-5" />}
        isLoading={isLoading}
        testId="summary-card-average"
      />
      <SummaryCard
        title="Peak Usage"
        value={formatCostForDisplay(summary.peak)}
        subtitle={peakSubtitle}
        icon={<Zap className="h-5 w-5" />}
        isLoading={isLoading}
        testId="summary-card-peak"
      />
    </div>
  );
}

export default UsageSummaryCards;
