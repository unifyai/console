'use client';

import Main from '@/components/Pages/Links/Main';
import {
  deleteOneTimeCreditGrantLink,
  generateOneTimeCreditGrantLink,
  listOneTimeCreditGrantLinks,
} from '@/lib/links/one-time-links';
import type { AdminCreditGrantActions } from '@/types/admin';

const adminCreditGrantActions: AdminCreditGrantActions = {
  generateOneTimeLink: generateOneTimeCreditGrantLink,
  listOneTimeLinks: listOneTimeCreditGrantLinks,
  deleteOneTimeLink: deleteOneTimeCreditGrantLink,
};

export default function AdminLinksPanel() {
  return (
    <div className="flex h-full w-full">
      <Main adminCreditGrantActions={adminCreditGrantActions} />
    </div>
  );
}
