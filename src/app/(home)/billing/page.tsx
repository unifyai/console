import React, { Suspense } from 'react';
import { Metadata } from 'next';
import OnPrem from '@/components/Shared/OnPrem';
import Main from '@/components/Pages/Billing/Main';
import FreeTrialBillingLock from '@/components/Pages/Billing/FreeTrialBillingLock';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import * as BillingLib from '@/lib/billing/billing';
import type { BillingActions, BillingOrgContext } from '@/types/billing';
import { resolveWorkspaceContext } from '@/lib/user/workspace';

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
  const { activeOrganization, isUnifyMember } = resolveWorkspaceContext(user);
  let orgContext: BillingOrgContext | null = null;

  if (activeOrganization) {
    const roleName = activeOrganization.roleName?.toLowerCase();
    if (roleName !== 'owner' && roleName !== 'admin') {
      redirect('/profile');
    }
    orgContext = {
      orgId: activeOrganization.id,
      orgName: activeOrganization.name,
      canEdit: roleName === 'owner' || roleName === 'admin',
    };
  }

  if (activeOrganization?.freeTrial && !isUnifyMember) {
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
