import React, { Suspense } from 'react';
import { Metadata } from 'next';
import BillingUnavailable from '@/components/Shared/BillingUnavailable';
import Main from '@/components/Pages/Billing/Main';
import FreeTrialBillingLock from '@/components/Pages/Billing/FreeTrialBillingLock';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import * as BillingLib from '@/lib/billing/billing';
import type { BillingActions, BillingOrgContext } from '@/types/billing';
import { resolveWorkspaceContext } from '@/lib/user/workspace';
import { getServerFeatures } from '@/lib/features/server';

export const metadata: Metadata = {
  title: 'Billing',
};

const BillingPage: React.FC = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // No billing feature (self-host / external-auth / no Stripe) → nothing to show.
  // `features.billing` already accounts for these via the credential authority.
  if (!(await getServerFeatures()).billing) {
    return (
      <div className="h-full w-full overflow-auto p-1">
        <Suspense fallback={<SkeletonLoader />}>
          <BillingUnavailable />
        </Suspense>
      </div>
    );
  }

  const apiKey = user.apiKey;
  const { activeOrganization, isUnifyMember } = resolveWorkspaceContext(user);
  let orgContext: BillingOrgContext | null = null;

  if (activeOrganization) {
    const roleName = activeOrganization.roleName?.toLowerCase();
    const isOrgAdmin = roleName === 'owner' || roleName === 'admin';
    // Unify members (internal staff) can view billing for any org they belong
    // to, regardless of their role in that org. Edit rights still follow the
    // org role so a non-owner/admin Unify member gets a read-only view.
    if (!isOrgAdmin && !isUnifyMember) {
      redirect('/profile');
    }
    orgContext = {
      orgId: activeOrganization.id,
      orgName: activeOrganization.name,
      canEdit: isOrgAdmin,
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
    subscribe: await BillingLib.subscribe(apiKey),
    cancelSubscription: await BillingLib.cancelSubscription(apiKey),
    reactivateSubscription: await BillingLib.reactivateSubscription(apiKey),
    getAutoIncrement: await BillingLib.getAutoIncrement(apiKey),
    updateAutoIncrement: await BillingLib.updateAutoIncrement(apiKey),
    getProfile: await BillingLib.getProfile(apiKey),
    updateProfile: await BillingLib.updateProfile(apiKey),
    createPortalSession: await BillingLib.createPortalSession(apiKey),
    createSetupIntent: await BillingLib.createSetupIntent(apiKey),
    listPaymentMethods: await BillingLib.listPaymentMethods(apiKey),
    setDefaultPaymentMethod: await BillingLib.setDefaultPaymentMethod(apiKey),
    detachPaymentMethod: await BillingLib.detachPaymentMethod(apiKey),
    getSupportedTaxCountries: await BillingLib.getSupportedTaxCountries(apiKey),
    validateTaxId: await BillingLib.validateTaxId(apiKey),
    getInvoices: await BillingLib.getInvoices(apiKey),
    getInvoiceUrls: await BillingLib.getInvoiceUrls(apiKey),
    getCurrentPeriodUsage: await BillingLib.getCurrentPeriodUsage(apiKey),
    getAvailablePlans: await BillingLib.getAvailablePlans(apiKey),
    switchPlan: await BillingLib.switchPlan(apiKey),
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
