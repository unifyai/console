import React, { Suspense } from 'react';
import { Metadata } from 'next';
import OnPrem from '@/components/Shared/OnPrem';
import Main from '@/components/Pages/Billing/Main';
import FreeTrialBillingLock from '@/components/Pages/Billing/FreeTrialBillingLock';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import * as BillingLib from '@/lib/billing/billing';
import type { BillingActions, BillingOrgContext } from '@/types/billing';

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

  const apiKey = user.apiKey;

  // ── Determine organization context ──────────────────────────────────
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get('unify_workspace_id')?.value;

  let orgContext: BillingOrgContext | null = null;

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

  // ── Free trial lock ─────────────────────────────────────────────────
  if (activeOrg?.freeTrial) {
    return (
      <div className="h-full w-full overflow-auto p-1">
        <FreeTrialBillingLock />
      </div>
    );
  }

  // ── Build server actions (bind API key once, on the server) ─────────
  const billingActions: BillingActions = {
    getBalance: await BillingLib.getBalance(apiKey),
    getAutoRecharge: await BillingLib.getAutoRecharge(apiKey),
    updateAutoRecharge: await BillingLib.updateAutoRecharge(apiKey),
    toggleAutoRecharge: await BillingLib.toggleAutoRecharge(apiKey),
    getProfile: await BillingLib.getProfile(apiKey),
    updateProfile: await BillingLib.updateProfile(apiKey),
    createCheckoutSession: await BillingLib.createCheckoutSession(apiKey),
    createPortalSession: await BillingLib.createPortalSession(apiKey),
    getCheckoutStatus: await BillingLib.getCheckoutStatus(apiKey),
    getSupportedTaxCountries: await BillingLib.getSupportedTaxCountries(apiKey),
    validateTaxId: await BillingLib.validateTaxId(apiKey),
  };

  return (
    <div className="h-full w-full overflow-auto p-1">
      <Suspense fallback={<SkeletonLoader />}>
        <Main actions={billingActions} orgContext={orgContext} />
      </Suspense>
    </div>
  );
};

export default BillingPage;
