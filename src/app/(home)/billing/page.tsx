import React from 'react';
import { Metadata } from 'next';
import OnPrem from '@/components/Shared/OnPrem';
import Main from '@/components/Pages/Billing/Main';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

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

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get('unify_workspace_id')?.value;

  // Determine organization context.
  // Priority: explicit cookie → non-Unify org lock → personal.
  let orgContext: {
    orgId: number;
    orgName: string;
    canEdit: boolean;
  } | null = null;

  let activeOrg =
    workspaceId && workspaceId !== 'personal'
      ? user.organizations?.find((o) => o.id.toString() === workspaceId)
      : undefined;

  // Non-Unify org members are locked to their org even without a cookie
  if (!activeOrg) {
    const isUnifyMember = user.organizations?.some((o) => o.name === 'Unify') ?? false;
    if (!isUnifyMember && user.organizations && user.organizations.length > 0) {
      activeOrg = user.organizations[0];
    }
  }

  if (activeOrg) {
    const roleName = activeOrg.roleName?.toLowerCase();
    if (roleName !== 'owner' && roleName !== 'admin') {
      redirect('/profile');
    }
    orgContext = {
      orgId: activeOrg.id,
      orgName: activeOrg.name,
      canEdit: roleName === 'owner' || roleName === 'admin',
    };
  }

  return (
    <div className="h-full w-full overflow-auto p-1">
      <Suspense fallback={<SkeletonLoader />}>
        <Main orgContext={orgContext} />
      </Suspense>
    </div>
  );
};

export default BillingPage;
