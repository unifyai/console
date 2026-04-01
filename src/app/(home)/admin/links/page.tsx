import * as React from 'react';
import Main from '@/components/Pages/Links/Main';
import {
  generateOneTimeCreditGrantLink,
  listOneTimeCreditGrantLinks,
  deleteOneTimeCreditGrantLink,
} from '@/lib/links/one-time-links';
import { AdminCreditGrantActions } from '@/types/admin';

const LinksPage = async ({ searchParams }: { searchParams: { token?: string } }) => {
  const adminCreditGrantActions: AdminCreditGrantActions = {
    generateOneTimeLink: await generateOneTimeCreditGrantLink(),
    listOneTimeLinks: await listOneTimeCreditGrantLinks(),
    deleteOneTimeLink: await deleteOneTimeCreditGrantLink(),
  };

  return (
    <div className="flex h-full w-full">
      <Main adminCreditGrantActions={adminCreditGrantActions} />
    </div>
  );
};

export default LinksPage;
