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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
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
import { useBucketTransactions } from '@/hooks/Usage/useBucketTransactions';

const CATEGORY_COLORS: Record<string, string> = {
  llm: 'bg-[color:var(--status-info-bg)] text-[color:var(--status-info)]',
  hire: 'bg-[color:var(--role-purple)]/15 text-[color:var(--role-purple)]',
  resources: 'bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]',
  media: 'bg-[color:var(--role-teal)]/15 text-[color:var(--role-teal)]',
  recharge: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- backend credit-ledger category value
  subscription_recharge: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]',
  promo: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]',
  grant: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]',
  refund: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]',
  void: 'bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral)]',
  dispute: 'bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger)]',
  other: 'bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral)]',
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
          isCredit ? 'bg-[color:var(--status-success-bg)]' : 'bg-[color:var(--status-neutral-bg)]'
        )}
      >
        {isCredit ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--status-success)]" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5 text-[color:var(--status-neutral)]" />
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
          isCredit ? 'text-[color:var(--status-success)]' : 'text-body'
        )}
      >
        {isCredit ? '+' : ''}
        {formatCostForDisplay(transaction.amount)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-transaction detail metadata (from the free-form `detail` JSON)
// ---------------------------------------------------------------------------

/**
 * The richest available human-readable description of what a transaction
 * was for. Prefers the free-form `detail.label` (e.g. "Action: research
 * leads…"), falling back to the transaction description.
 */
function getDetailLabel(transaction: CreditTransaction): string {
  const detail = transaction.detail;
  const label = detail?.['label'];
  if (typeof label === 'string' && label) return label;
  if (transaction.description) return transaction.description;
  return CATEGORY_LABELS[transaction.category as TransactionCategory] ?? transaction.category;
}

// ---------------------------------------------------------------------------
// Grouping: collapse the many LLM calls behind a single action/turn into one
// row keyed by label, so one action == one detail row (not N noisy rows).
// ---------------------------------------------------------------------------

interface DetailGroup {
  key: string;
  label: string;
  /** Summed amount (debits, negative). */
  total: number;
  /** Number of underlying LLM calls. */
  count: number;
  models: Set<string>;
  source: string | null;
  /** Most recent timestamp in the group. */
  lastAt: string;
}

function groupBucketTransactions(transactions: CreditTransaction[]): DetailGroup[] {
  const groups = new Map<string, DetailGroup>();

  for (const tx of transactions) {
    const label = getDetailLabel(tx);
    const detail = tx.detail ?? {};
    const model = typeof detail['model'] === 'string' ? (detail['model'] as string) : null;
    const source = typeof detail['source'] === 'string' ? (detail['source'] as string) : null;

    let group = groups.get(label);
    if (!group) {
      group = {
        key: label,
        label,
        total: 0,
        count: 0,
        models: new Set<string>(),
        source,
        lastAt: tx.at,
      };
      groups.set(label, group);
    }
    group.total += tx.amount;
    group.count += 1;
    if (model) group.models.add(model);
    if (!group.source && source) group.source = source;
    if (tx.at > group.lastAt) group.lastAt = tx.at;
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );
}

// ---------------------------------------------------------------------------
// Detail sub-row (one action/turn — its LLM calls aggregated)
// ---------------------------------------------------------------------------

function GroupedDetailRow({ group }: { group: DetailGroup }) {
  const meta: string[] = [];
  // Calls (when more than one) or the single timestamp.
  if (group.count > 1) {
    meta.push(`${group.count} calls`);
  } else {
    meta.push(formatTimestamp(group.lastAt));
  }
  if (group.models.size === 1) {
    const onlyModel = group.models.values().next().value;
    if (onlyModel) meta.push(onlyModel);
  } else if (group.models.size > 1) {
    meta.push(`${group.models.size} models`);
  }
  if (group.source) meta.push(group.source);

  return (
    <div
      className="border-border/40 flex items-start gap-2 border-b py-2 pl-12 pr-3 last:border-b-0"
      data-testid="transaction-detail-row"
    >
      <div className="min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-body cursor-default truncate text-xs">{group.label}</p>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-xs">
            <p className="text-body whitespace-normal break-words text-xs">{group.label}</p>
          </TooltipContent>
        </Tooltip>
        <p className="text-body-muted truncate text-[11px]">{meta.join(' \u00b7 ')}</p>
      </div>

      <span className="text-body-muted shrink-0 text-xs tabular-nums">
        {formatCostForDisplay(group.total)}
      </span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div data-testid="transaction-detail-loading">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="border-border/40 flex items-center gap-2 border-b py-2 pl-12 pr-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <ShimmerPill className="h-3 w-32" />
            <ShimmerPill className="h-2.5 w-44" />
          </div>
          <ShimmerPill className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aggregated transaction row (expandable into individual transactions)
// ---------------------------------------------------------------------------

function AggregatedRow({
  row,
  granularity,
  assistantId,
  userId,
}: {
  row: AggregatedTransaction;
  granularity: TimeGranularity;
  assistantId?: string;
  userId?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const label = CATEGORY_LABELS[row.category as TransactionCategory] ?? row.category;
  const description = CATEGORY_DESCRIPTIONS[row.category as TransactionCategory];
  const bucketLabel = formatBucketLabel(row.bucket, granularity);

  const { transactions, isLoading, error } = useBucketTransactions({
    bucket: row.bucket,
    category: row.category,
    granularity,
    assistantId,
    userId,
    enabled: expanded,
  });

  const groups = React.useMemo(() => groupBucketTransactions(transactions), [transactions]);

  return (
    <div className="border-b border-border last:border-b-0" data-testid="aggregated-row">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
        data-testid="aggregated-row-toggle"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--status-neutral-bg)]">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[color:var(--status-neutral)]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[color:var(--status-neutral)]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body truncate text-sm">{description || label}</p>
            <span className="text-body text-caption shrink-0 font-medium tabular-nums">
              {formatCostForDisplay(-row.total)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-body-muted text-xs">{bucketLabel}</span>
            <span className="text-body-muted text-xs">({row.count})</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="bg-muted/30" data-testid="aggregated-row-details">
          {isLoading && <DetailSkeleton />}

          {error && <p className="text-error py-2 pl-12 pr-3 text-xs">{error}</p>}

          {!isLoading && !error && transactions.length === 0 && (
            <p
              className="text-body-muted py-2 pl-12 pr-3 text-xs"
              data-testid="transaction-detail-empty"
            >
              No individual transactions found for this period.
            </p>
          )}

          {!isLoading && groups.map((g) => <GroupedDetailRow key={g.key} group={g} />)}
        </div>
      )}
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
  /** Assistant scope for expanded detail fetches (matches the ledger filter). */
  assistantId?: string;
  /** User scope for expanded detail fetches (matches the ledger filter). */
  userId?: string;
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
  assistantId,
  userId,
}: TransactionLedgerProps) {
  const spendingTxns = React.useMemo(
    () => transactions.filter((tx) => SPENDING_CATEGORY_SET.has(tx.category)),
    [transactions]
  );

  const rowCount = isAggregated ? aggregated.length : spendingTxns.length;
  const showSkeleton = isLoading && rowCount === 0;
  const isEmpty = !isLoading && rowCount === 0 && !error;

  return (
    <TooltipProvider delayDuration={300}>
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
            <ScrollArea className="flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
              <div>
                {isAggregated
                  ? aggregated.map((row, i) => (
                      <AggregatedRow
                        key={`${row.bucket}-${row.category}-${i}`}
                        row={row}
                        granularity={granularity}
                        assistantId={assistantId}
                        userId={userId}
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
    </TooltipProvider>
  );
}

export default TransactionLedger;
