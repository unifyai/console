/**
 * useTransactionHistory Hook
 *
 * Fetches paginated credit transactions from the ledger via client-side fetch.
 * Supports filtering by category, assistant, and user.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTransactions } from '@/lib/client/credits';
import { CreditTransaction, TransactionQueryParams } from '@/types/usage/transactions';

const PAGE_SIZE = 20;

export interface UseTransactionHistoryProps {
  category?: string;
  assistantId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

export interface UseTransactionHistoryReturn {
  transactions: CreditTransaction[];
  isLoading: boolean;
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
  enabled = true,
}: UseTransactionHistoryProps = {}): UseTransactionHistoryReturn {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!enabled) return;

      setIsLoading(true);
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

        const result = await fetchTransactions(query);
        if (!mountedRef.current) return;

        if ('detail' in result) {
          console.error('[useTransactionHistory] API error:', result.detail);
          setError('Unable to load transactions. Please try again later.');
          if (!append) setTransactions([]);
        } else if ('transactions' in result) {
          const items = result.transactions;
          setTransactions((prev) => (append ? [...prev, ...items] : items));
          setHasMore(items.length >= PAGE_SIZE);
          setError(null);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        console.error('[useTransactionHistory] Fetch error:', err);
        setError('Unable to load transactions. Please try again later.');
        if (!append) setTransactions([]);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [enabled, category, assistantId, userId, startDate, endDate]
  );

  const refetch = useCallback(async () => {
    setTransactions([]);
    setHasMore(true);
    await fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    await fetchPage(transactions.length, true);
  }, [fetchPage, isLoading, hasMore, transactions.length]);

  useEffect(() => {
    setTransactions([]);
    setHasMore(true);
    fetchPage(0, false);
  }, [fetchPage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { transactions, isLoading, error, hasMore, loadMore, refetch };
}

export default useTransactionHistory;
