'use client';

import { AlertCircle, Download, ExternalLink, Loader2, Receipt } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../UI/card';
import { Button } from '../../UI/button';
import type { BillingActions, InvoiceListItem } from '@/types/billing';
import { isBillingError } from '@/types/billing';

// =============================================================================
// Props
// =============================================================================

export interface InvoicesTableProps {
  /** Invoices to render, newest first. */
  invoices: InvoiceListItem[];
  /** Spinner state — when true, hides the table and shows a loader. */
  loading: boolean;
  /**
   * Variant tweaks copy + section heading without forking the component.
   *
   * - 'metered' — month-end invoices from the metered invoicer.
   *   Empty state copy mentions the upcoming month-end run.
   * - 'credits' — historical autorecharge invoices. (Admin-driven
   *   wallet credits — promo grants, manual top-ups — are excluded
   *   server-side because they don't produce a Stripe invoice; they
   *   show up in the credits-balance card instead.)
   *   Empty state copy explains there's no billing history yet.
   *
   * Defaults to 'metered' for back-compat with the original call site.
   */
  variant?: 'metered' | 'credits';
  /**
   * Hands us `getInvoiceUrls` for the lazy PDF download button.
   * Stripe-hosted URLs are short-lived so we don't pre-fetch them; the
   * row resolves them on click and opens the PDF in a new tab.
   */
  actions: Pick<BillingActions, 'getInvoiceUrls'>;
  /**
   * When the invoice-list fetch failed, surface the server detail
   * inline so users see "we couldn't load invoices" instead of an
   * empty-state that would otherwise read as "you have none". When
   * provided alongside ``onRetry`` the table also renders a "Try
   * again" button.
   */
  error?: string | null;
  /** Re-runs the invoice fetch — wired to the inline retry button. */
  onRetry?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Reusable historical-invoices table.
 *
 * Used by both billing-mode variants so customers see the same audit trail
 * regardless of how they pay. The METERED variant is the primary surface
 * (Stripe portal is intentionally hidden for the enterprise cohort); the
 * CREDITS variant supplements the Stripe customer portal with an inline
 * view that also flags the active plan template per row.
 *
 * The PDF button round-trips through the backend, which calls the
 * payment processor to resolve the customer-facing PDF URL. That's
 * necessary because the bare invoice id only resolves to an internal
 * dashboard URL (which 404s for customers). Round-tripping per click
 * also keeps short-lived signed URLs fresh.
 */
export function InvoicesTable({
  invoices,
  loading,
  variant = 'metered',
  actions,
  error = null,
  onRetry,
}: InvoicesTableProps) {
  const heading = 'Invoices';
  const description =
    variant === 'metered'
      ? 'Newest first. Each invoice covers one billing period.'
      : 'Newest first. Auto-recharge invoices appear here once Stripe finalises them.';
  const emptyCopy =
    variant === 'metered'
      ? 'No invoices yet. The first one will appear after the end of your current billing period.'
      : 'No invoices yet. Auto-recharge invoices will appear here once your first payment is processed.';

  return (
    <section className="space-y-4" data-testid={`${variant}-invoices-section`}>
      <div>
        <h2 className="text-h3 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {heading}
        </h2>
        <p className="text-body-muted mt-1">{description}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : error && invoices.length === 0 ? (
            // Distinct from the empty state: an empty list is "no
            // invoices yet" (a normal lifecycle state for new
            // accounts) whereas this branch is "we tried and failed
            // to fetch", which the user otherwise has no way to
            // tell apart from the legitimate empty case.
            <div
              className="flex flex-col items-center gap-3 px-6 py-8 text-center"
              data-testid="invoices-error"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-body-muted">{error}</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} data-testid="invoices-retry">
                  Try again
                </Button>
              )}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-body-muted px-6 py-8 text-center" data-testid="invoices-empty">
              {emptyCopy}
            </p>
          ) : (
            <table className="text-body w-full" data-testid="invoices-table">
              <thead>
                <tr className="text-caption border-b text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Period</th>
                  <th className="px-4 py-2 text-left font-medium">Plan</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  {/*
                    Two side-by-side actions per row: View opens the
                    Stripe-hosted invoice page (which includes
                    bank-transfer funding instructions for
                    customer_balance accounts; this is the only
                    customer-facing surface where those appear).
                    PDF downloads the static receipt.
                  */}
                  <th className="px-4 py-2 text-right font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} actions={actions} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// =============================================================================
// Row
// =============================================================================

interface InvoiceRowProps {
  invoice: InvoiceListItem;
  actions: Pick<BillingActions, 'getInvoiceUrls'>;
}

const InvoiceRow = ({ invoice: inv, actions }: InvoiceRowProps) => {
  // ``viewing`` and ``downloading`` are tracked separately so a click
  // on one button doesn't grey out the other — both go through the
  // same backend round-trip but resolve independent URLs.
  const [viewing, setViewing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const breakdown = extractMeteredBreakdown(inv);
  const isMeteredRow = breakdown !== null;

  const openUrl = async (
    pickUrl: (urls: {
      hostedInvoiceUrl: string | null;
      invoicePdfUrl: string | null;
    }) => string | null,
    setBusy: (b: boolean) => void,
    failureMessage: string
  ) => {
    if (!inv.stripeInvoiceId) return;
    setBusy(true);
    try {
      const result = await actions.getInvoiceUrls(inv.id);
      // Surface a single, payment-processor-agnostic message regardless
      // of the underlying failure (network, missing invoice, processor
      // outage). The `detail` field on the error response can contain
      // implementation specifics ("Stripe is not configured", etc.) —
      // we deliberately don't pipe it through to the user.
      if (isBillingError(result)) {
        toast.error(failureMessage);
        return;
      }
      const url = pickUrl(result);
      if (!url) {
        toast.error(failureMessage);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(failureMessage);
    } finally {
      setBusy(false);
    }
  };

  const viewInvoice = () =>
    openUrl(
      (urls) => urls.hostedInvoiceUrl,
      setViewing,
      "Couldn't open invoice. Please try again."
    );

  const downloadPdf = () =>
    openUrl(
      (urls) => urls.invoicePdfUrl,
      setDownloading,
      "Couldn't download invoice. Please try again."
    );

  return (
    <>
      <tr
        className={`${isMeteredRow ? '' : 'border-b last:border-b-0'}`}
        data-testid={`invoice-row-${inv.id}`}
      >
        <td className="px-4 py-3">{formatInvoicePeriod(inv, isMeteredRow)}</td>
        <td className="px-4 py-3 text-muted-foreground">{inv.planTemplateName ?? '—'}</td>
        <td className="px-4 py-3 text-right font-medium tabular-nums">
          {formatInvoiceAmount(inv, breakdown)}
        </td>
        <td className="px-4 py-3">
          <InvoiceStatusBadge status={inv.status} />
        </td>
        <td className="px-4 py-3 text-right">
          {inv.stripeInvoiceId ? (
            <div className="inline-flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={viewing}
                onClick={viewInvoice}
                title="Open the hosted invoice (includes bank-transfer payment instructions when applicable)"
                data-testid={`invoice-view-${inv.id}`}
              >
                {viewing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ExternalLink className="h-3 w-3" />
                )}
                <span className="ml-1">View</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={downloading}
                onClick={downloadPdf}
                data-testid={`invoice-download-${inv.id}`}
              >
                {downloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                <span className="ml-1">PDF</span>
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {isMeteredRow && (
        <tr className="border-b last:border-b-0" data-testid={`invoice-breakdown-${inv.id}`}>
          <td />
          <td colSpan={4} className="text-caption -mt-2 px-4 pb-3 text-muted-foreground">
            {renderBreakdown(breakdown)}
          </td>
        </tr>
      )}
    </>
  );
};

// =============================================================================
// Helpers
// =============================================================================

const InvoiceStatusBadge = ({ status }: { status: string }) => {
  // Map orchestra's RechargeStatus enum to a colour family. Anything we
  // don't recognise falls through to neutral so the UI doesn't blow up
  // on a server-side enum addition.
  const tone =
    status === 'PAID'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'INVOICE_CREATED'
        ? 'bg-amber-100 text-amber-800'
        : status === 'FAILED' || status === 'DISPUTED'
          ? 'bg-red-100 text-red-800'
          : 'bg-secondary text-secondary-foreground';
  return (
    <span className={`text-caption rounded px-2 py-0.5 ${tone}`}>{prettifyStatus(status)}</span>
  );
};

function prettifyStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * METERED rows: stamp the invoicing month ("April 2026"). Every other
 * row is a discrete event (autorecharge top-up, manual payment) — show
 * the precise date so customers can match it against bank statements.
 */
function formatInvoicePeriod(inv: InvoiceListItem, isMeteredRow: boolean): string {
  if (isMeteredRow) {
    const iso = inv.invoiceGroup ?? inv.at;
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  const iso = inv.at;
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// =============================================================================
// Per-invoice METERED breakdown
// =============================================================================

interface MeteredBreakdown {
  currency: string;
  invoicedLocal: number;
  contractUsageLocal: number | null;
  commitAmount: number | null;
  grantsLocal: number | null;
  /** True when contract_usage > commit (overage period). */
  inOverage: boolean;
  /** contract_usage - commit, when in overage. */
  overageLocal: number | null;
}

/**
 * Pull the audit blob the metered invoicer stamps onto every Recharge
 * row (`raw_usage_local`, `commit_amount`, `invoiced_local`, …) and
 * coerce it into a typed shape we can render. Returns ``null`` for
 * autorecharge rows — those have no per-invoice breakdown to display.
 * (Manual top-ups / promo credits never reach this component because
 * the backend filters them out — they don't produce a Stripe invoice.)
 *
 * Internal pricing knobs (``base_pricing_factor``, ``overage_pricing_factor``) are intentionally
 * dropped here — they're not customer-facing.
 */
function extractMeteredBreakdown(inv: InvoiceListItem): MeteredBreakdown | null {
  const detail = inv.detail;
  if (!detail || typeof detail !== 'object') return null;
  // The invoicer always stamps `invoiced_local` + `currency`; their
  // presence is our marker for "this row came from the metered
  // pipeline". Autorecharge / manual rows have no `detail` shape.
  const invoiced = numberOrNull(detail.invoiced_local);
  const currency = typeof detail.currency === 'string' ? detail.currency : null;
  if (invoiced === null || !currency) return null;

  const commit = numberOrNull(detail.commit_amount);
  const usage = numberOrNull(detail.contract_usage_local);
  const grants = numberOrNull(detail.grants_local);

  const inOverage = commit !== null && commit > 0 && usage !== null && usage > commit;
  const overage = inOverage && commit !== null && usage !== null ? usage - commit : null;

  return {
    currency,
    invoicedLocal: invoiced,
    contractUsageLocal: usage,
    commitAmount: commit,
    grantsLocal: grants,
    inOverage,
    overageLocal: overage,
  };
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Use `detail.invoiced_local` + `detail.currency` when present so
 * non-USD invoices show the actual amount the customer was charged
 * (e.g. €5,000) rather than the USD-denominated equivalent stored
 * on the bare Recharge row. Falls back to USD on autorecharge rows
 * that have no localised detail.
 */
function formatInvoiceAmount(inv: InvoiceListItem, breakdown: MeteredBreakdown | null): string {
  if (breakdown) {
    return formatMoney(breakdown.invoicedLocal, breakdown.currency);
  }
  return formatMoney(inv.amountUsd, 'USD');
}

function renderBreakdown(b: MeteredBreakdown | null): string {
  if (!b) return '';
  const parts: string[] = [];
  if (b.commitAmount !== null && b.commitAmount > 0) {
    parts.push(`Commit ${formatMoney(b.commitAmount, b.currency)}`);
  }
  if (b.contractUsageLocal !== null) {
    parts.push(`Usage ${formatMoney(b.contractUsageLocal, b.currency)}`);
  }
  if (b.inOverage && b.overageLocal !== null) {
    parts.push(`Overage ${formatMoney(b.overageLocal, b.currency)}`);
  }
  if (b.grantsLocal !== null && b.grantsLocal > 0) {
    parts.push(`Credits applied −${formatMoney(b.grantsLocal, b.currency)}`);
  }
  return parts.join(' · ');
}
