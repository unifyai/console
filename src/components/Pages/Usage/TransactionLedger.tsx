'use client';

/**
 * TransactionLedger Component
 *
 * Displays credit transactions from the ledger in two modes:
 *   - Aggregated (default): time-bucketed rows grouped by category, driven
 *     by the periodicity filter. Each row shows a time bucket, category,
 *     total spend, and transaction count.
 *   - Individual: raw transaction rows with timestamp, description, badge,
 *     and amount. Supports infinite scroll via "Load more" button.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/UI/card';
import { Badge } from '@/components/UI/badge';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCostForDisplay } from '@/utils/usage/formatters';
import {
  CreditTransaction,
  AggregatedTransaction,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  TransactionCategory,
  SPENDING_CATEGORY_SET,
} from '@/types/usage/transactions';
import { TimeGranularity } from '@/types/usage';

const CATEGORY_COLORS: Record<string, string> = {
  llm: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  hire: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  resources: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  media: 'bg-pink-500/15 text-pink-700 dark:text-pink-400',
  recharge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  promo: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  refund: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  void: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400',
  dispute: 'bg-red-500/15 text-red-700 dark:text-red-400',
  other: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400',
};

// ---------------------------------------------------------------------------
// Timestamp formatting
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;

  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}

function formatBucketLabel(iso: string, granularity: TimeGranularity): string {
  const d = new Date(iso);
  switch (granularity) {
    case 'minute':
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'hour':
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'day':
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    case 'month':
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    case 'year':
      return d.toLocaleDateString(undefined, { year: 'numeric' });
  }
}

// ---------------------------------------------------------------------------
// Individual transaction row
// ---------------------------------------------------------------------------

function TransactionRow({ transaction }: { transaction: CreditTransaction }) {
  const isCredit = transaction.amount > 0;
  const label =
    CATEGORY_LABELS[transaction.category as TransactionCategory] ?? transaction.category;
  const colorClass = CATEGORY_COLORS[transaction.category] ?? CATEGORY_COLORS.other;

  return (
    <div
      className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
      data-testid="transaction-row"
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isCredit ? 'bg-emerald-500/15' : 'bg-zinc-500/10'
        )}
      >
        {isCredit ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5 text-zinc-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-body truncate text-sm">{transaction.description || label}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-body-muted text-xs">{formatTimestamp(transaction.at)}</span>
          <Badge className={cn('border-0 text-[10px] leading-tight', colorClass)}>{label}</Badge>
        </div>
      </div>

      <span
        className={cn(
          'shrink-0 text-sm font-medium tabular-nums',
          isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-body'
        )}
      >
        {isCredit ? '+' : ''}
        {formatCostForDisplay(transaction.amount)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aggregated transaction row
// ---------------------------------------------------------------------------

function AggregatedRow({
  row,
  granularity,
}: {
  row: AggregatedTransaction;
  granularity: TimeGranularity;
}) {
  const label = CATEGORY_LABELS[row.category as TransactionCategory] ?? row.category;
  const description = CATEGORY_DESCRIPTIONS[row.category as TransactionCategory];
  const colorClass = CATEGORY_COLORS[row.category] ?? CATEGORY_COLORS.other;
  const bucketLabel = formatBucketLabel(row.bucket, granularity);

  return (
    <div
      className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
      data-testid="aggregated-row"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-500/10">
        <ArrowDownRight className="h-3.5 w-3.5 text-zinc-500" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-body truncate text-sm">{description || label}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-body-muted text-xs">{bucketLabel}</span>
          <Badge className={cn('border-0 text-[10px] leading-tight', colorClass)}>{label}</Badge>
          <span className="text-body-muted text-xs">({row.count})</span>
        </div>
      </div>

      <span className="text-body text-caption shrink-0 font-medium tabular-nums">
        {formatCostForDisplay(-row.total)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

const SKELETON_WIDTHS = [
  { desc: 'w-28', time: 'w-16', badge: 'w-10', amount: 'w-12' },
  { desc: 'w-36', time: 'w-20', badge: 'w-14', amount: 'w-10' },
  { desc: 'w-24', time: 'w-14', badge: 'w-8', amount: 'w-14' },
  { desc: 'w-32', time: 'w-18', badge: 'w-12', amount: 'w-11' },
  { desc: 'w-20', time: 'w-20', badge: 'w-10', amount: 'w-12' },
  { desc: 'w-40', time: 'w-14', badge: 'w-8', amount: 'w-10' },
  { desc: 'w-28', time: 'w-18', badge: 'w-12', amount: 'w-14' },
  { desc: 'w-32', time: 'w-20', badge: 'w-10', amount: 'w-11' },
];

function ShimmerPill({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-full bg-muted', className)} />;
}

function LedgerSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-0" data-testid="transaction-ledger-loading">
      {Array.from({ length: count }).map((_, i) => {
        const w = SKELETON_WIDTHS[i % SKELETON_WIDTHS.length];
        return (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <ShimmerPill className="h-7 w-7 shrink-0 !rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <ShimmerPill className={cn('h-3.5', w.desc)} />
              <div className="flex items-center gap-1.5">
                <ShimmerPill className={cn('h-3', w.time)} />
                <ShimmerPill className={cn('h-4', w.badge)} />
              </div>
            </div>
            <ShimmerPill className={cn('h-4 shrink-0', w.amount)} />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface TransactionLedgerProps {
  transactions: CreditTransaction[];
  aggregated: AggregatedTransaction[];
  isAggregated: boolean;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  granularity: TimeGranularity;
}

export function TransactionLedger({
  transactions,
  aggregated,
  isAggregated,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  granularity,
}: TransactionLedgerProps) {
  const spendingTxns = React.useMemo(
    () => transactions.filter((tx) => SPENDING_CATEGORY_SET.has(tx.category)),
    [transactions]
  );

  const rowCount = isAggregated ? aggregated.length : spendingTxns.length;
  const showSkeleton = isLoading && rowCount === 0;
  const isEmpty = !isLoading && rowCount === 0 && !error;

  return (
    <Card className="flex h-full flex-col" data-testid="transaction-ledger">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0 pt-3">
        {error && <p className="text-body text-error px-3 py-4 text-center">{error}</p>}

        {showSkeleton && <LedgerSkeleton />}

        {isEmpty && (
          <p
            className="text-body-muted px-3 py-8 text-center text-sm"
            data-testid="transaction-ledger-empty"
          >
            No usage yet
          </p>
        )}

        {rowCount > 0 && (
          <ScrollArea className="flex-1">
            <div>
              {isAggregated
                ? aggregated.map((row, i) => (
                    <AggregatedRow
                      key={`${row.bucket}-${row.category}-${i}`}
                      row={row}
                      granularity={granularity}
                    />
                  ))
                : spendingTxns.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)}

              {isLoading && <LedgerSkeleton count={3} />}

              {hasMore && !isLoading && (
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={onLoadMore}
                    data-testid="transaction-load-more"
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default TransactionLedger;
