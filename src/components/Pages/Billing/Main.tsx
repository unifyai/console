'use client';

import { useMemo, useState } from 'react';
import { Separator } from '../../UI/separator';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { useBilling } from '@/hooks/Billing/useBilling';
import type { BillingActions, BillingOrgContext } from '@/types/billing';
import { BillingProfileSection } from './BillingProfileSection';
import { CreditsBillingSection } from './CreditsBillingSection';
import { TopUpSection } from './TopUpSection';
import { ReferralsSection } from './ReferralsSection';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { PlansBillingSection } from './PlansBillingSection';
import { PaymentMethodsSection } from './PaymentMethodsManager';
import { InvoicesSection } from './InvoicesSection';
import { MeteredBillingSection } from './MeteredBillingSection';
import { SwitchPlanSection } from './SwitchPlanSection';

// =============================================================================
// Props
// =============================================================================

export interface BillingMainProps {
  /** Server-action-bound billing actions */
  actions: BillingActions;
  /** Organization context (null for personal workspace) */
  orgContext?: BillingOrgContext | null;
}

// =============================================================================
// Component
// =============================================================================

const Main = ({ actions, orgContext }: BillingMainProps) => {
  const {
    dataLoaded,
    fullBalance,
    loadingBalance,
    isRefreshingBalance,
    handleRefreshBalance,
    billingMode,
    plan,
    isSubscribed,
    monthlyCreditAllowance,
    trialExpiresAt,
    nextRenewalAt,
    cancelAtPeriodEnd,
    displayCurrency,
    hasBillingAddress,
    refetchBillingProfile,
    hasPaymentMethod,
    refreshPaymentMethods,
    invoices,
    loadingInvoices,
    invoicesError,
    refetchInvoices,
    currentPeriodUsage,
    loadingCurrentPeriodUsage,
    handleManagePaymentMethods,
    isProfileDialogOpen,
    setIsProfileDialogOpen,
    availablePlans,
    loadingAvailablePlans,
    planGroupDisplayName,
    nextPeriodStart,
    handleSubscribe,
    handleCancelSubscription,
    handleResumeSubscription,
    handleSwitchPlan,
    isAutoIncrementEnabled,
    isAtTopTier,
    handleToggleAutoIncrement,
  } = useBilling(actions, orgContext);

  const { manualTopup } = useFeatures();
  const isMetered = billingMode === 'METERED';
  const canEdit = orgContext ? orgContext.canEdit : true;

  // The payment-methods panel is normally self-managed, but the subscribe
  // prerequisites checklist needs to pop it open, so its open state is lifted
  // here and shared between the two surfaces.
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // ``PaymentMethodsSection`` keys its card-list fetch off this object, so it
  // has to keep its identity across renders — otherwise every re-render of
  // this page refetches and the summary line flickers back to its loading text.
  const paymentMethodActions = useMemo(
    () => ({
      createSetupIntent: actions.createSetupIntent,
      listPaymentMethods: actions.listPaymentMethods,
      setDefaultPaymentMethod: actions.setDefaultPaymentMethod,
      detachPaymentMethod: actions.detachPaymentMethod,
      getProfile: actions.getProfile,
    }),
    [actions]
  );

  return (
    <div className="h-full min-h-0 w-full max-w-4xl space-y-6 overflow-y-auto p-8">
      {!dataLoaded ? (
        <SectionBodySkeleton className="max-w-4xl p-8" />
      ) : manualTopup ? (
        <>
          <CreditsBillingSection
            orgContext={orgContext}
            fullBalance={fullBalance}
            loadingBalance={loadingBalance}
            isRefreshingBalance={isRefreshingBalance}
            isSubscribed={isSubscribed}
            monthlyCreditAllowance={monthlyCreditAllowance}
            trialExpiresAt={trialExpiresAt}
            plan={plan}
          />

          <Separator />

          <TopUpSection topUp={actions.topUp} onToppedUp={handleRefreshBalance} canEdit={canEdit} />
        </>
      ) : isMetered ? (
        <>
          <MeteredBillingSection
            plan={plan}
            currentPeriodUsage={currentPeriodUsage}
            loadingCurrentPeriodUsage={loadingCurrentPeriodUsage}
            orgContext={orgContext}
            handleManagePaymentMethods={handleManagePaymentMethods}
          />

          {availablePlans.length > 0 && (
            <>
              <Separator />
              <SwitchPlanSection
                availablePlans={availablePlans}
                loading={loadingAvailablePlans}
                groupDisplayName={planGroupDisplayName}
                nextPeriodStart={nextPeriodStart}
                onSwitchPlan={handleSwitchPlan}
              />
            </>
          )}

          <Separator />

          <BillingProfileSection
            actions={actions}
            orgContext={orgContext}
            isProfileDialogOpen={isProfileDialogOpen}
            setIsProfileDialogOpen={setIsProfileDialogOpen}
            onProfileSaved={refetchBillingProfile}
          />

          <Separator />

          <InvoicesSection
            invoices={invoices}
            loading={loadingInvoices}
            variant="metered"
            actions={actions}
            error={invoicesError}
            onRetry={refetchInvoices}
          />
        </>
      ) : (
        <>
          <CreditsBillingSection
            orgContext={orgContext}
            fullBalance={fullBalance}
            loadingBalance={loadingBalance}
            isRefreshingBalance={isRefreshingBalance}
            isSubscribed={isSubscribed}
            monthlyCreditAllowance={monthlyCreditAllowance}
            trialExpiresAt={trialExpiresAt}
            plan={plan}
          />

          {/*
            Refer & earn. Works in both personal and organization workspaces:
            the referral endpoints are scoped by the active workspace's API
            key, so in an org context the code is org-owned and rewards are
            credited to the organization's balance.
          */}
          <Separator />

          <ReferralsSection orgContext={orgContext} />

          <Separator />

          <PlansBillingSection
            orgContext={orgContext}
            isSubscribed={isSubscribed}
            plan={plan}
            nextRenewalAt={nextRenewalAt}
            cancelAtPeriodEnd={cancelAtPeriodEnd}
            displayCurrency={displayCurrency}
            availablePlans={availablePlans}
            loadingAvailablePlans={loadingAvailablePlans}
            onSubscribe={handleSubscribe}
            onSwitchPlan={handleSwitchPlan}
            onCancelSubscription={handleCancelSubscription}
            onResumeSubscription={handleResumeSubscription}
            isAutoIncrementEnabled={isAutoIncrementEnabled}
            isAtTopTier={isAtTopTier}
            handleToggleAutoIncrement={handleToggleAutoIncrement}
            hasBillingAddress={hasBillingAddress}
            hasPaymentMethod={hasPaymentMethod}
            onEditBillingProfile={() => setIsProfileDialogOpen(true)}
            onManagePaymentMethods={() => setIsPaymentDialogOpen(true)}
          />

          <Separator />

          <BillingProfileSection
            actions={actions}
            orgContext={orgContext}
            isProfileDialogOpen={isProfileDialogOpen}
            setIsProfileDialogOpen={setIsProfileDialogOpen}
            onProfileSaved={refetchBillingProfile}
          />

          <Separator />

          {/*
            Always-on payment-methods section: cards are collected with
            Stripe Elements against a SetupIntent (the card never touches our
            servers — PCI SAQ-A). A card can be added before subscribing,
            and the default backs renewals + plan changes. ``onChanged``
            re-checks the subscribe gate when the card set mutates.
          */}
          <PaymentMethodsSection
            actions={paymentMethodActions}
            isSubscribed={isSubscribed}
            canEdit={orgContext ? orgContext.canEdit : true}
            onChanged={refreshPaymentMethods}
            open={isPaymentDialogOpen}
            onOpenChange={setIsPaymentDialogOpen}
          />

          <Separator />

          {/*
            Invoices for CREDITS accounts: self-serve subscription
            invoices (monthly/annual credit-tier payments). Admin-driven
            wallet credits (promo / manual top-ups) are excluded
            server-side because they don't have a Stripe invoice —
            they're visible in the credits-balance card. Each row links to
            its Stripe-hosted receipt.
          */}
          <InvoicesSection
            invoices={invoices}
            loading={loadingInvoices}
            variant="credits"
            actions={actions}
            error={invoicesError}
            onRetry={refetchInvoices}
          />
        </>
      )}
    </div>
  );
};

export default Main;
