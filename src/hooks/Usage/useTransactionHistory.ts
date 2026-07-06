/**
 * useTransactionHistory Hook
 *
 * Fetches credit transactions from the ledger via client-side fetch.
 * Supports two modes:
 *   - Individual transactions (no groupBy) — paginated list of raw rows
 *   - Aggregated transactions (groupBy set) — time-bucketed sums by category
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTransactions } from '@/lib/client/credits';
import {
  CreditTransaction,
  AggregatedTransaction,
  TransactionQueryParams,
} from '@/types/usage/transactions';

const PAGE_SIZE = 50;

export interface UseTransactionHistoryProps {
  category?: string;
  assistantId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: string;
  enabled?: boolean;
}

export interface UseTransactionHistoryReturn {
  transactions: CreditTransaction[];
  aggregated: AggregatedTransaction[];
  isAggregated: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useTransactionHistory({
  category,
  assistantId,
  userId,
  startDate,
  endDate,
  groupBy,
  enabled = true,
}: UseTransactionHistoryProps = {}): UseTransactionHistoryReturn {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(true);
  const hasInitiallyLoadedRef = useRef(false);
  const isFetchingMoreRef = useRef(false);

  const isAggregated = !!groupBy;

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!enabled) return;

      if (append) {
        setIsLoadingMore(true);
      } else if (!hasInitiallyLoadedRef.current) {
        setIsLoading(true);
      }
      if (!append) setError(null);

      try {
        const query: TransactionQueryParams = {
          limit: PAGE_SIZE,
          offset,
        };
        if (category) query.category = category;
        if (assistantId) query.assistantId = assistantId;
        if (userId) query.userId = userId;
        if (startDate) query.startDate = startDate;
        if (endDate) query.endDate = endDate;
        if (groupBy) query.groupBy = groupBy;

        const result = await fetchTransactions(query);
        if (!mountedRef.current) return;

        if ('detail' in result) {
          console.error('[useTransactionHistory] API error:', result.detail);
          setError('Unable to load transactions. Please try again later.');
          if (!append) {
            setTransactions([]);
            setAggregated([]);
          }
        } else if ('transactions' in result) {
          const items = result.transactions;
          setHasMore(items.length >= PAGE_SIZE);
          setError(null);

          if (groupBy) {
            const aggItems = items as AggregatedTransaction[];
            setAggregated((prev) => (append ? [...prev, ...aggItems] : aggItems));
            if (!append) setTransactions([]);
          } else {
            const txItems = items as CreditTransaction[];
            setTransactions((prev) => (append ? [...prev, ...txItems] : txItems));
            if (!append) setAggregated([]);
          }
        }
      } catch (err) {
        if (!mountedRef.current) return;
        console.error('[useTransactionHistory] Fetch error:', err);
        setError('Unable to load transactions. Please try again later.');
        if (!append) {
          setTransactions([]);
          setAggregated([]);
        }
      } finally {
        if (!mountedRef.current) return;
        if (append) {
          setIsLoadingMore(false);
        } else {
          hasInitiallyLoadedRef.current = true;
          setIsLoading(false);
        }
      }
    },
    [enabled, category, assistantId, userId, startDate, endDate, groupBy]
  );

  const refetch = useCallback(async () => {
    setHasMore(true);
    await fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (isFetchingMoreRef.current || isLoading || isLoadingMore || !hasMore) return;
    isFetchingMoreRef.current = true;
    const currentCount = groupBy ? aggregated.length : transactions.length;
    try {
      await fetchPage(currentCount, true);
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, [
    fetchPage,
    isLoading,
    isLoadingMore,
    hasMore,
    transactions.length,
    aggregated.length,
    groupBy,
  ]);

  useEffect(() => {
    hasInitiallyLoadedRef.current = false;
    setHasMore(true);
    void fetchPage(0, false);
  }, [fetchPage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    transactions,
    aggregated,
    isAggregated,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
  };
}

export default useTransactionHistory;
