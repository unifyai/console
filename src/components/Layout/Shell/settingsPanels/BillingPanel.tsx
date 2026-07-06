'use client';

import * as React from 'react';
import BillingUnavailable from '@/components/Shared/BillingUnavailable';
import BillingMain from '@/components/Pages/Billing/Main';
import FreeTrialBillingLock from '@/components/Pages/Billing/FreeTrialBillingLock';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import * as BillingLib from '@/lib/billing/billing';
import type { BillingActions, BillingOrgContext } from '@/types/billing';

const billingActions: BillingActions = {
  getBalance: BillingLib.getBalance,
  topUp: BillingLib.topUp,
  subscribe: BillingLib.subscribe,
  cancelSubscription: BillingLib.cancelSubscription,
  reactivateSubscription: BillingLib.reactivateSubscription,
  getAutoIncrement: BillingLib.getAutoIncrement,
  updateAutoIncrement: BillingLib.updateAutoIncrement,
  getProfile: BillingLib.getProfile,
  updateProfile: BillingLib.updateProfile,
  createPortalSession: BillingLib.createPortalSession,
  createSetupIntent: BillingLib.createSetupIntent,
  listPaymentMethods: BillingLib.listPaymentMethods,
  setDefaultPaymentMethod: BillingLib.setDefaultPaymentMethod,
  detachPaymentMethod: BillingLib.detachPaymentMethod,
  getSupportedTaxCountries: BillingLib.getSupportedTaxCountries,
  validateTaxId: BillingLib.validateTaxId,
  getInvoices: BillingLib.getInvoices,
  getInvoiceUrls: BillingLib.getInvoiceUrls,
  getCurrentPeriodUsage: BillingLib.getCurrentPeriodUsage,
  getAvailablePlans: BillingLib.getAvailablePlans,
  switchPlan: BillingLib.switchPlan,
};

export default function BillingPanel() {
  const { billing } = useFeatures();
  const { activeOrganization, isUnifyMember } = useWorkspace();
  const { navigateTo } = useAppShellNavigation();

  React.useEffect(() => {
    const roleName = activeOrganization?.roleName?.toLowerCase();
    const isOrgAdmin = roleName === 'owner' || roleName === 'admin';
    if (activeOrganization && !isOrgAdmin && !isUnifyMember) {
      navigateTo('/account');
    }
  }, [activeOrganization, isUnifyMember, navigateTo]);

  if (!billing) {
    return <BillingUnavailable />;
  }

  const orgContext: BillingOrgContext | null = activeOrganization
    ? {
        orgId: activeOrganization.id,
        orgName: activeOrganization.name,
        canEdit: ['owner', 'admin'].includes(activeOrganization.roleName?.toLowerCase() ?? ''),
      }
    : null;

  if (activeOrganization?.freeTrial && !isUnifyMember) {
    return <FreeTrialBillingLock />;
  }

  return <BillingMain actions={billingActions} orgContext={orgContext} />;
}
