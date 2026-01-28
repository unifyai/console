import React from 'react';
import { Metadata } from 'next';
import OnPrem from '@/components/Shared/OnPrem';
import Main from '@/components/Pages/Billing/Main';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  getOrgSpend,
  getOrgSpendingLimit,
  setOrgSpendingLimit,
} from '@/lib/organizations/spending';
import { getUserSpend, getUserSpendingLimit, setUserSpendingLimit } from '@/lib/user/spending';

export const metadata: Metadata = {
  title: 'Billing',
};

const BillingPage: React.FC = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  const onPrem = process.env.ON_PREM;
  if (onPrem) {
    return (
      <div className="h-full w-full overflow-auto p-1">
        <Suspense fallback={<SkeletonLoader />}>
          <OnPrem />
        </Suspense>
      </div>
    );
  }

  const apiKey = user.apiKey || '';
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get('unify_workspace_id')?.value;

  // Determine organization context
  let orgContext: {
    orgId: number;
    orgName: string;
    canEdit: boolean;
  } | null = null;

  if (workspaceId && workspaceId !== 'personal') {
    const activeOrg = user.organizations?.find((o) => o.id.toString() === workspaceId);
    if (activeOrg) {
      const roleName = activeOrg.roleName?.toLowerCase();
      // Only admins and owners can access billing in org context
      if (roleName !== 'owner' && roleName !== 'admin') {
        redirect('/profile');
      }
      orgContext = {
        orgId: activeOrg.id,
        orgName: activeOrg.name,
        canEdit: roleName === 'owner' || roleName === 'admin',
      };
    } else {
      redirect('/profile');
    }
  }

  // Create bound org spending actions if in org context
  let orgSpendingActions = null;
  if (orgContext) {
    orgSpendingActions = {
      getSpend: await getOrgSpend(apiKey),
      getLimit: await getOrgSpendingLimit(apiKey),
      setLimit: await setOrgSpendingLimit(apiKey),
    };
  }

  // Create bound user spending actions for personal workspace only
  // Only shown when NOT in org context (personal workspace)
  let userSpendingActions = null;
  if (!orgContext) {
    userSpendingActions = {
      getSpend: await getUserSpend(apiKey),
      getLimit: await getUserSpendingLimit(apiKey),
      setLimit: await setUserSpendingLimit(apiKey),
    };
  }

  return (
    <div className="h-full w-full overflow-auto p-1">
      <Suspense fallback={<SkeletonLoader />}>
        <Main
          orgContext={orgContext}
          orgSpendingActions={orgSpendingActions}
          userSpendingActions={userSpendingActions}
        />
      </Suspense>
    </div>
  );
};

export default BillingPage;
