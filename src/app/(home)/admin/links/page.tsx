import * as React from 'react';
import Main from '@/components/Pages/Links/Main';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Terminal } from 'lucide-react';
import {
  generateOneTimeCreditGrantLink,
  listOneTimeCreditGrantLinks,
  deleteOneTimeCreditGrantLink,
} from '@/lib/links/one-time-links';
import { AdminCreditGrantActions } from '@/types/admin';

const LinksPage = async ({ searchParams }: { searchParams: { token?: string } }) => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }

  const isAdmin =
    user.organizations.find(
      (o) => o.name === 'Unify' && ['owner', 'admin'].includes(o.roleName?.toLowerCase())
    ) !== undefined;

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="w-auto max-w-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be a Unify organization admin to access one-time credit grant links.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
