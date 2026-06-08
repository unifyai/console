'use client';

import { useState } from 'react';
import { Receipt } from 'lucide-react';
import { Button } from '../../UI/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../UI/sheet';
import { InvoicesTable } from './InvoicesTable';
import type { BillingActions, InvoiceListItem } from '@/types/billing';

// =============================================================================
// Props
// =============================================================================

export interface InvoicesSectionProps {
  /** Invoices to render, newest first. */
  invoices: InvoiceListItem[];
  /** Spinner state — when true, the panel table shows a loader. */
  loading: boolean;
  /** Copy/heading variant, forwarded to the hosted table. */
  variant?: 'metered' | 'credits';
  /** Forwarded to the table for the lazy PDF/View buttons. */
  actions: Pick<BillingActions, 'getInvoiceUrls'>;
  /** Inline fetch-failure detail, forwarded to the table. */
  error?: string | null;
  /** Re-runs the invoice fetch — forwarded to the table's retry button. */
  onRetry?: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

/** One-line summary for the section header (mirrors the other sections). */
function summarize(invoices: InvoiceListItem[], loading: boolean, error: string | null): string {
  if (loading || (error && invoices.length === 0)) {
    return 'Your billing history and receipts';
  }
  if (invoices.length === 0) {
    return 'No invoices yet';
  }
  const count = invoices.length;
  const noun = count === 1 ? 'invoice' : 'invoices';
  return `${count} ${noun} · view receipts and payment status`;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Invoices section, matching the billing-profile / payment-method layout: a
 * compact header + summary line + "View" button that opens a right-side
 * slide-out panel holding the full ``InvoicesTable``. Keeping the (potentially
 * long) invoice history behind a panel keeps the billing page scannable while
 * the summary still surfaces whether any invoices exist at a glance.
 */
export const InvoicesSection = ({
  invoices,
  loading,
  variant = 'metered',
  actions,
  error = null,
  onRetry,
}: InvoicesSectionProps) => {
  const [open, setOpen] = useState(false);
  const description =
    variant === 'metered'
      ? 'Newest first. Each invoice covers one billing period.'
      : 'Newest first. Your subscription invoices appear here.';

  return (
    <section className="space-y-4" data-testid={`${variant}-invoices-section`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-h3 flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoices
          </h2>
          <p className="text-body-muted mt-1" data-testid="invoices-summary">
            {summarize(invoices, loading, error)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5"
          data-testid="view-invoices"
        >
          <Receipt className="h-4 w-4" />
          View
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-3xl"
        >
          <SheetHeader>
            <SheetTitle>Invoices</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <InvoicesTable
              headless
              invoices={invoices}
              loading={loading}
              variant={variant}
              actions={actions}
              error={error}
              onRetry={onRetry}
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};
