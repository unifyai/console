/**
 * Credit Transaction Types
 *
 * Types for the credit transaction ledger API endpoints.
 * Maps to Orchestra's /v0/credits/transactions and /v0/credits/spending.
 */

/**
 * Known transaction categories from the credit ledger.
 */
export type TransactionCategory =
  | 'llm'
  | 'hire'
  | 'resources'
  | 'media'
  | 'recharge'
  | 'promo'
  | 'void'
  | 'refund'
  | 'dispute'
  | 'other';

/**
 * Human-readable labels for each category.
 */
export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  llm: 'LLM',
  hire: 'Hiring',
  resources: 'Resources',
  media: 'Media',
  recharge: 'Recharge',
  promo: 'Promo',
  void: 'Void',
  refund: 'Refund',
  dispute: 'Dispute',
  other: 'Other',
};

/**
 * Short descriptions for spending categories shown in the filter dropdown.
 */
export const CATEGORY_DESCRIPTIONS: Partial<Record<TransactionCategory, string>> = {
  llm: 'Assistant work',
  hire: 'Assistant creation',
  resources: 'Created and provisioned contacts',
  media: 'Generated photos and videos',
};

/**
 * Categories that represent actual usage spending (debit-side).
 * Used to scope the usage page to real costs, excluding administrative
 * transactions like recharges, promos, voids, refunds, and disputes.
 */
export const SPENDING_CATEGORIES: TransactionCategory[] = ['llm', 'hire', 'resources', 'media'];

export const SPENDING_CATEGORY_SET = new Set<string>(SPENDING_CATEGORIES);

/**
 * A single credit transaction from the ledger.
 * Matches Orchestra's TransactionItem schema.
 */
export interface CreditTransaction {
  id: number;
  at: string;
  amount: number;
  balanceAfter: number | null;
  category: string;
  assistantId: number | null;
  userId: string | null;
  organizationId: number | null;
  description: string | null;
  detail: Record<string, unknown> | null;
}

/**
 * A time-bucketed aggregation of transactions by category.
 * Returned when group_by is specified on the transactions endpoint.
 */
export interface AggregatedTransaction {
  bucket: string;
  category: string;
  total: number;
  count: number;
}

/**
 * Response from GET /v0/credits/transactions (individual rows)
 */
export interface TransactionHistoryResponse {
  transactions: CreditTransaction[];
}

/**
 * Response from GET /v0/credits/transactions?group_by=... (aggregated rows)
 */
export interface AggregatedTransactionHistoryResponse {
  transactions: AggregatedTransaction[];
}

/**
 * Query parameters for fetching transactions.
 */
export interface TransactionQueryParams {
  limit?: number;
  offset?: number;
  category?: string;
  assistantId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: string;
}
