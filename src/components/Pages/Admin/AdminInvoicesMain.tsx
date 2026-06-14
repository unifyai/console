'use client';

/**
 * Admin Invoices Main
 *
 * Operator-facing cross-account invoice table. Renders historical
 * recharges + synthesised `UPCOMING` projections from
 * `GET /v0/admin/invoices`.
 *
 * Currency convention: each row carries its literal contract
 * currency (3-letter ISO). The table renders amounts via
 * `Intl.NumberFormat(locale, { style: 'currency', currency })` —
 * NOT the `formatCurrency` helper from `utils/usage/formatters`,
 * which formats credits (the internal accounting unit) and would
 * incorrectly relabel real-money amounts. There is no inline total
 * — mixing currencies into a single number would hide FX exposure
 * and the operator UX is per-row anyway.
 */

import * as React from 'react';
import {
  AlertCircle,
  Building2,
  Clock,
  ExternalLink,
  Receipt,
  RefreshCw,
  Search,
  User as UserIcon,
} from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Badge } from '@/components/UI/badge';
import type {
  AdminBillingPlanTemplate,
  AdminInvoiceActions,
  AdminInvoiceListFilters,
  AdminInvoiceListItem,
  AdminInvoiceListResponse,
} from '@/types/admin';
import type { ResponseProps } from '@/types/common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Per-row currency formatting. We deliberately bypass the
 * credits-based `formatCurrency` helper from `utils/usage/formatters`
 * — that one renders the internal accounting unit, not real money,
 * and would mis-label real Stripe invoice amounts in their plan
 * currency.
 */
const formatPlanMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // `Intl.NumberFormat` throws on invalid currency codes — fall
    // back to a bare numeric so the row still renders rather than
    // taking down the whole table on one bad currency string.
    return `${amount.toFixed(2)} ${currency || ''}`.trim();
  }
};

const formatDateTime = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'UPCOMING', label: 'Upcoming only' },
  { value: 'PAID', label: 'Paid' },
  { value: 'INVOICE_CREATED', label: 'Invoice created' },
  { value: 'PENDING_INVOICE', label: 'Pending invoice' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'DISPUTED', label: 'Disputed' },
];

const PAGE_SIZE = 50;

// Status → colour token. `outline` is the neutral fallback so any
// future RechargeStatus value the FE doesn't know about still
// renders rather than crashing the row.
const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const s = status.toUpperCase();
  if (s === 'PAID') return 'default';
  if (s === 'UPCOMING' || s === 'PENDING_INVOICE' || s === 'INVOICE_CREATED') {
    return 'secondary';
  }
  if (s === 'FAILED' || s === 'DISPUTED') return 'destructive';
  return 'outline';
};

function isErrorResponse(v: unknown): v is { detail: string } {
  return typeof v === 'object' && v !== null && 'detail' in v;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AdminInvoicesMainProps {
  actions: AdminInvoiceActions;
  /**
   * Pre-resolved server action that returns the full template
   * catalog. Resolved at the page layer so the filter dropdown
   * can populate without an extra round-trip on first paint.
   */
  listTemplates: (options?: {
    includeCustom?: boolean;
    includeInactive?: boolean;
  }) => Promise<AdminBillingPlanTemplate[] | ResponseProps>;
}

export default function AdminInvoicesMain({ actions, listTemplates }: AdminInvoicesMainProps) {
  // --- Filter state -------------------------------------------------------
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [currencyFilter, setCurrencyFilter] = React.useState<string>('ALL');
  const [planTemplateId, setPlanTemplateId] = React.useState<string>('ALL');
  const [fromDate, setFromDate] = React.useState<string>('');
  const [toDate, setToDate] = React.useState<string>('');
  const [searchInput, setSearchInput] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');
  const [page, setPage] = React.useState<number>(0);

  // --- Data state ---------------------------------------------------------
  const [data, setData] = React.useState<AdminInvoiceListResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<AdminBillingPlanTemplate[]>([]);

  // Load template catalog once for the plan filter dropdown.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await listTemplates({
        includeCustom: true,
        includeInactive: true,
      });
      if (cancelled) return;
      if (Array.isArray(result)) {
        setTemplates(result);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listTemplates]);

  // Debounce free-text search so we don't hammer the DB on each
  // keystroke. 300ms matches the UX feel on the Organizations page.
  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(0); // any text change resets pagination
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // Reset to page 0 whenever a non-text filter changes — the
  // existing offset is meaningless against the new filter set.
  React.useEffect(() => {
    setPage(0);
  }, [statusFilter, currencyFilter, planTemplateId, fromDate, toDate]);

  // --- Fetch --------------------------------------------------------------
  const filters = React.useMemo<AdminInvoiceListFilters>(() => {
    const f: AdminInvoiceListFilters = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (statusFilter !== 'ALL') f.status = statusFilter;
    if (currencyFilter !== 'ALL') f.currency = currencyFilter;
    if (planTemplateId !== 'ALL') f.planTemplateId = Number(planTemplateId);
    if (fromDate) f.fromDate = fromDate;
    if (toDate) f.toDate = toDate;
    if (debouncedSearch) f.q = debouncedSearch;
    // Suppress UPCOMING projections when the user is paginating past
    // the first page or has explicitly filtered to a non-UPCOMING
    // status — they'd otherwise re-appear on page 0 only and confuse
    // counts. The endpoint also enforces this server-side; doing it
    // here avoids one extra projection scan when we already know we
    // don't want them.
    if (page > 0) f.includeUpcoming = false;
    return f;
  }, [page, statusFilter, currencyFilter, planTemplateId, fromDate, toDate, debouncedSearch]);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await actions.listInvoices(filters);
    if (isErrorResponse(result)) {
      setError(result.detail || 'Failed to load invoices.');
      setData(null);
    } else {
      // ``ResponseProps``'s index-signature defeats TS narrowing on
      // the success branch — the runtime type guard above is what we
      // trust here.
      setData(result as AdminInvoiceListResponse);
    }
    setLoading(false);
  }, [actions, filters]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  // --- Derived ------------------------------------------------------------
  // Distinct currency set for the currency filter — derived from the
  // template catalog (so the filter shows every currency we *could*
  // have invoices in, not just the ones currently on screen).
  const currencyOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const t of templates) {
      if (t.currency) seen.add(t.currency.toUpperCase());
    }
    return Array.from(seen).sort();
  }, [templates]);

  const items: AdminInvoiceListItem[] = data?.invoices ?? [];
  const total = data?.total ?? 0;
  const upcomingCount = data?.upcomingCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-h1 text-semibold">Invoices</h1>
          </div>
          <p className="text-caption">
            All invoices across billing accounts. <strong>Upcoming</strong> rows are projected
            month-end totals for active METERED plans — actual invoice amounts may differ once the
            period closes.
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by org, email, billing account id, or Stripe invoice id"
              className="pl-8"
              aria-label="Search invoices"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="w-[140px]" aria-label="Currency filter">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All currencies</SelectItem>
              {currencyOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={planTemplateId} onValueChange={setPlanTemplateId}>
            <SelectTrigger className="w-[200px]" aria-label="Plan filter">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All plans</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.displayName || t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <label className="text-caption text-muted-foreground" htmlFor="from-date">
              From
            </label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[160px]"
            />
            <label className="text-caption text-muted-foreground" htmlFor="to-date">
              To
            </label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[160px]"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={loading}
            aria-label="Refresh invoices"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Result summary line */}
        <div className="text-caption flex items-center gap-3 border-b border-border px-4 py-1.5 text-muted-foreground">
          {loading ? (
            <span>Loading…</span>
          ) : error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            <>
              <span>
                Showing {items.length} of {total + upcomingCount} invoices
                {upcomingCount > 0 && (
                  <>
                    {' '}
                    <span className="text-foreground">({upcomingCount} upcoming)</span>
                  </>
                )}
              </span>
              <span>
                Page {page + 1} / {totalPages}
              </span>
            </>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-body-muted">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : loading && !data ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Receipt className="h-6 w-6 text-muted-foreground" />
              <p className="text-body-muted">No invoices match the current filters.</p>
            </div>
          ) : (
            <table className="text-body w-full caption-bottom border-separate border-spacing-0">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr className="text-caption text-left text-muted-foreground">
                  <th className="border-b border-border px-3 py-2 font-medium">Date</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Recipient</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Plan</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Status</th>
                  <th className="border-b border-border px-3 py-2 text-right font-medium">
                    Amount
                  </th>
                  <th className="border-b border-border px-3 py-2 font-medium">Period</th>
                  <th
                    className="border-b border-border px-3 py-2 font-medium"
                    aria-label="Actions"
                  />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <InvoiceRow
                    key={`${it.kind}:${it.id ?? `${it.billingAccountId}:${it.planAssignmentId}`}`}
                    item={it}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function InvoiceRow({ item }: { item: AdminInvoiceListItem }) {
  const isUpcoming = item.kind === 'UPCOMING';
  const recipientLabel =
    item.recipientName || item.recipientEmail || `${item.recipientKind}#${item.recipientId}`;
  const recipientSubtitle = item.recipientName && item.recipientEmail ? item.recipientEmail : null;

  // Stripe Dashboard deep-link — only shown for HISTORICAL rows that
  // actually have a Stripe invoice id. Without a customer-facing PDF
  // URL on hand (the customer-scoped /invoices/{id}/urls endpoint
  // requires an API key tied to the BA), the admin view falls back
  // to the Stripe Dashboard which is the right surface for operators
  // anyway — they have access via Unify's Stripe team.
  const stripeDashboardUrl = item.stripeInvoiceId
    ? `https://dashboard.stripe.com/invoices/${item.stripeInvoiceId}`
    : null;

  return (
    <tr
      className={`hover:bg-muted/40 border-b border-border transition-colors ${
        isUpcoming ? 'bg-[color:var(--status-warning-bg)]/50' : ''
      }`}
    >
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-1.5">
          {isUpcoming && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Clock className="h-3.5 w-3.5 text-[color:var(--status-warning)]" />
              </TooltipTrigger>
              <TooltipContent>Projected — actual amount finalised at period close.</TooltipContent>
            </Tooltip>
          )}
          <span className="text-body-sm">
            {isUpcoming ? formatDate(item.at) : formatDateTime(item.at)}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start gap-1.5">
          {item.recipientKind === 'ORG' ? (
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <UserIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="text-body-sm truncate">{recipientLabel}</div>
            {recipientSubtitle && (
              <div className="text-caption truncate text-muted-foreground">{recipientSubtitle}</div>
            )}
            <div className="text-caption text-muted-foreground">BA #{item.billingAccountId}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="text-body-sm">
          {item.planTemplateDisplayName || item.planTemplateName || '—'}
        </div>
        {item.billingMode && (
          <div className="text-caption text-muted-foreground">{item.billingMode}</div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
      </td>
      <td className="px-3 py-2 text-right align-top">
        <div className="text-body-sm font-mono">{formatPlanMoney(item.amount, item.currency)}</div>
        <div className="text-caption text-muted-foreground">{item.currency}</div>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="text-body-sm">{formatDate(item.invoiceGroup)}</div>
      </td>
      <td className="px-3 py-2 text-right align-top">
        {stripeDashboardUrl ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                aria-label="Open in Stripe dashboard"
              >
                <a href={stripeDashboardUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in Stripe dashboard</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-caption text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
