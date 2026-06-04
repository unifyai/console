'use client';

/**
 * useBucketTransactions Hook
 *
 * Lazily loads the individual credit transactions that make up a single
 * aggregated ledger row (one time bucket + category). Used to expand an
 * aggregated row in the transaction ledger into its underlying detail rows.
 *
 * The Orchestra transactions endpoint only filters by day-resolution dates,
 * so we fetch the day span that covers the bucket and then narrow to the
 * precise bucket window client-side. This keeps finer granularities
 * (minute / hour) correct without backend changes.
 */

import { useState, useEffect, useRef } from 'react';
import { fetchTransactions } from '@/lib/client/credits';
import { CreditTransaction, TransactionQueryParams } from '@/types/usage/transactions';
import { TimeGranularity } from '@/types/usage';

// Generous page size: a single bucket should comfortably fit, and finer
// granularities still narrow client-side from the covering day span.
const DETAIL_PAGE_SIZE = 200;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toUtcDateString(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * The half-open instant window [start, end) covered by a bucket at the
 * given granularity. Arithmetic is done in UTC to match the backend's
 * ``date_trunc`` bucketing.
 */
export function getBucketRange(
  bucketIso: string,
  granularity: TimeGranularity
): { start: Date; end: Date } {
  const start = new Date(bucketIso);
  const end = new Date(start);
  switch (granularity) {
    case 'minute':
      end.setUTCMinutes(end.getUTCMinutes() + 1);
      break;
    case 'hour':
      end.setUTCHours(end.getUTCHours() + 1);
      break;
    case 'day':
      end.setUTCDate(end.getUTCDate() + 1);
      break;
    case 'month':
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
    case 'year':
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      break;
  }
  return { start, end };
}

export interface UseBucketTransactionsProps {
  bucket: string;
  category: string;
  granularity: TimeGranularity;
  assistantId?: string;
  userId?: string;
  /** Only fetch once this is true (lazy expansion). */
  enabled: boolean;
}

export interface UseBucketTransactionsReturn {
  transactions: CreditTransaction[];
  isLoading: boolean;
  error: string | null;
}

export function useBucketTransactions({
  bucket,
  category,
  granularity,
  assistantId,
  userId,
  enabled,
}: UseBucketTransactionsProps): UseBucketTransactionsReturn {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { start, end } = getBucketRange(bucket, granularity);
        const lastInstant = new Date(end.getTime() - 1);

        const query: TransactionQueryParams = {
          limit: DETAIL_PAGE_SIZE,
          offset: 0,
          category,
          startDate: toUtcDateString(start),
          endDate: toUtcDateString(lastInstant),
        };
        if (assistantId) query.assistantId = assistantId;
        if (userId) query.userId = userId;

        const result = await fetchTransactions(query);
        if (cancelled || !mountedRef.current) return;

        if ('detail' in result) {
          setError('Unable to load transaction details. Please try again later.');
          setTransactions([]);
          return;
        }

        if ('transactions' in result) {
          const items = result.transactions as CreditTransaction[];
          const startMs = start.getTime();
          const endMs = end.getTime();
          const inBucket = items
            .filter((tx) => {
              const t = new Date(tx.at).getTime();
              return t >= startMs && t < endMs;
            })
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
          setTransactions(inBucket);
        }
      } catch {
        if (cancelled || !mountedRef.current) return;
        setError('Unable to load transaction details. Please try again later.');
        setTransactions([]);
      } finally {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [enabled, bucket, category, granularity, assistantId, userId]);

  return { transactions, isLoading, error };
}

export default useBucketTransactions;
