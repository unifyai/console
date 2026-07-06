'use client';

import AdminInvoicesMain from '@/components/Pages/Admin/AdminInvoicesMain';
import { listBillingTemplatesAction } from '@/lib/admin/billing-plans';
import { listAdminInvoicesAction } from '@/lib/admin/invoices';
import type { AdminInvoiceActions } from '@/types/admin';

const actions: AdminInvoiceActions = {
  listInvoices: listAdminInvoicesAction,
};

export default function AdminInvoicesPanel() {
  return (
    <div className="h-full w-full">
      <AdminInvoicesMain actions={actions} listTemplates={listBillingTemplatesAction} />
    </div>
  );
}
