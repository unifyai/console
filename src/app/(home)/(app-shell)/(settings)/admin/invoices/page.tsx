/**
 * Admin Invoices Page
 *
 * Cross-account invoice list for Unify operators. Shows historical
 * invoices (recharges in any non-internal status) and synthesised
 * `UPCOMING` projections for active METERED assignments that
 * haven't been invoiced for the current period yet.
 *
 * Backed by `GET /v0/admin/invoices` — distinct from the
 * customer-scoped `/v0/billing/invoices` surface used by the
 * customer billing page (that one is keyed off the API-key billing
 * account and lives in `lib/billing/billing.ts`).
 *
 * Access: Unify organization Owner or Admin only (enforced by the
 * /admin layout).
 */

import * as React from 'react';
import AdminInvoicesMain from '@/components/Pages/Admin/AdminInvoicesMain';
import { listAdminInvoicesAction } from '@/lib/admin/invoices';
import { listBillingTemplatesAction } from '@/lib/admin/billing-plans';
import type { AdminInvoiceActions } from '@/types/admin';

const AdminInvoicesPage = async () => {
  const actions: AdminInvoiceActions = {
    listInvoices: listAdminInvoicesAction,
  };
  // The plan-template filter dropdown needs the catalog. We hand it
  // in once at render time rather than re-fetching on every filter
  // mount — the catalog is small and doesn't change between pages.
  const listTemplates = listBillingTemplatesAction;

  return (
    <div className="h-full w-full">
      <AdminInvoicesMain actions={actions} listTemplates={listTemplates} />
    </div>
  );
};

export default AdminInvoicesPage;
