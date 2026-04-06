/**
 * Client-side API functions for credit ledger endpoints.
 *
 * These call the Next.js API routes directly via fetch(), which:
 *   - Authenticate via the session cookie (no API key in the browser)
 *   - Run in parallel (unlike server actions, which serialize on the client)
 *   - Proxy to Orchestra server-side using getApiKeyFromRequest()
 *
 * Usage: import from hooks or client components. Do NOT use in server
 * components or server actions — those should use the Orchestra client
 * or server-side libs directly.
 */

import { ResponseProps } from '@/types/common';
import { TransactionHistoryResponse, TransactionQueryParams } from '@/types/usage/transactions';
import { UsageMetricsResponse } from '@/types/usage/api';

// ---------------------------------------------------------------------------
// Transaction history
// ---------------------------------------------------------------------------

export async function fetchTransactions(
  query?: TransactionQueryParams
): Promise<TransactionHistoryResponse | ResponseProps> {
  try {
    const params = new URLSearchParams();
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.offset) params.set('offset', String(query.offset));
    if (query?.category) params.set('category', query.category);
    if (query?.assistantId) params.set('assistantId', query.assistantId);
    if (query?.userId) params.set('userId', query.userId);
    if (query?.startDate) params.set('startDate', query.startDate);
    if (query?.endDate) params.set('endDate', query.endDate);

    const res = await fetch(`/api/credits/transactions?${params}`);
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch transactions' };
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch transactions' };
  }
}

// ---------------------------------------------------------------------------
// Spending timeseries (chart data from ledger)
// ---------------------------------------------------------------------------

export interface SpendingTimeseriesParams {
  startDate: string;
  endDate: string;
  groupBy?: string;
  category?: string;
  assistantId?: string;
  userId?: string;
}

export async function fetchSpendingTimeseries(
  params: SpendingTimeseriesParams
): Promise<UsageMetricsResponse | ResponseProps> {
  try {
    const qs = new URLSearchParams();
    qs.set('startDate', params.startDate);
    qs.set('endDate', params.endDate);
    if (params.groupBy) qs.set('groupBy', params.groupBy);
    if (params.category) qs.set('category', params.category);
    if (params.assistantId) qs.set('assistantId', params.assistantId);
    if (params.userId) qs.set('userId', params.userId);

    const res = await fetch(`/api/credits/spending/timeseries?${qs}`);
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch spending timeseries' };
    return data as UsageMetricsResponse;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to fetch spending timeseries',
    };
  }
}
