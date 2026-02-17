import * as React from 'react';
import Main from '@/components/Pages/Links/Main';
import { signOut } from 'next-auth/react';
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
    signOut();
    redirect('/login');
  }

  const isAdmin =
    user.organizations.find(
      (o) =>
        o.name === 'Orchestra Admin Organization' &&
        ['owner', 'admin'].includes(o.roleName?.toLowerCase())
    ) !== undefined;

  const adminCreditGrantActions: AdminCreditGrantActions = {
    generateOneTimeLink: await generateOneTimeCreditGrantLink(),
    listOneTimeLinks: await listOneTimeCreditGrantLinks(),
    deleteOneTimeLink: await deleteOneTimeCreditGrantLink(),
  };

  return (
    <div className="flex h-full w-full">
      {isAdmin ? (
        <Main adminCreditGrantActions={adminCreditGrantActions} />
      ) : (
        <div className="flex h-screen items-center justify-center p-4">
          <Alert variant="destructive" className="w-auto max-w-md">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>You do not have permission to view this page.</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default LinksPage;
