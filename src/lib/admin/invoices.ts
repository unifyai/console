/**
 * Admin Invoices Server Actions
 *
 * Wraps `GET /v0/admin/invoices` — the cross-account invoice list.
 * Distinct from the customer-scoped `/v0/billing/invoices` endpoint
 * which lives in `lib/billing/billing.ts` and is keyed off the
 * caller's API-key billing account; this surface is admin-only and
 * paginates over every billing account.
 *
 * Server-only: hits the orchestra admin surface using
 * `ORCHESTRA_ADMIN_KEY` and is never exposed to the browser bundle.
 */

'use server';

import { snakeToCamelObject } from '@/utils/casing';
import { requireUnifyAdmin } from '@/lib/admin/_guard';
import type { AdminInvoiceListFilters, AdminInvoiceListResponse } from '@/types/admin';
import type { ResponseProps } from '@/types/common';

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;
const adminKey = process.env.ORCHESTRA_ADMIN_KEY;

const adminHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${adminKey}`,
};

/** Same error contract as the other admin action files. */
const safeFetch = async (url: string, options: RequestInit, context: string): Promise<unknown> => {
  try {
    const response = await fetch(url, { ...options, cache: 'no-store' });
    if (response.status === 204) return {};

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail || data.error || `Operation failed: ${response.statusText}`;
        return { detail, status: response.status };
      }
      if (Array.isArray(data)) {
        return data.map((row) => snakeToCamelObject(row as Record<string, unknown>));
      }
      return snakeToCamelObject(data as Record<string, unknown>);
    }

    if (!response.ok) return { detail: response.statusText, status: response.status };
    return {};
  } catch (error) {
    console.error(`[admin/invoices ${context}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: message, status: 500 };
  }
};

/**
 * List invoices (historical recharges + projected upcoming) across
 * all billing accounts.
 *
 * The backend synthesises one `UPCOMING` row per active METERED
 * assignment that hasn't been invoiced for the current period yet
 * — only on the first page (`offset === 0`) and only when
 * `includeUpcoming !== false`. Subsequent pages return historical
 * rows only, since UPCOMING rows have no stable id to cursor against.
 */
export async function listAdminInvoicesAction(
  filters?: AdminInvoiceListFilters
): Promise<AdminInvoiceListResponse | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  const params = new URLSearchParams();
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
  if (filters?.status) params.set('status', filters.status);
  if (filters?.currency) params.set('currency', filters.currency);
  if (filters?.planTemplateId !== undefined) {
    params.set('plan_template_id', String(filters.planTemplateId));
  }
  if (filters?.fromDate) params.set('from_date', filters.fromDate);
  if (filters?.toDate) params.set('to_date', filters.toDate);
  if (filters?.q) params.set('q', filters.q);
  if (filters?.includeUpcoming !== undefined) {
    params.set('include_upcoming', String(filters.includeUpcoming));
  }
  const qs = params.toString();
  return safeFetch(
    `${backendUrl}/admin/invoices${qs ? `?${qs}` : ''}`,
    { method: 'GET', headers: adminHeaders },
    'listAdminInvoices'
  ) as Promise<AdminInvoiceListResponse | ResponseProps>;
}
