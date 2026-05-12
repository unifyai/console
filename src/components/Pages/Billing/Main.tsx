'use client';

import { Separator } from '../../UI/separator';
import { Alert, AlertDescription, AlertTitle } from '../../UI/alert';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useBilling } from '@/hooks/Billing/useBilling';
import type { BillingActions, BillingOrgContext } from '@/types/billing';
import { BillingProfileSection } from './BillingProfileSection';
import { CreditsBillingSection } from './CreditsBillingSection';
import { InvoicesTable } from './InvoicesTable';
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
    balance,
    loadingBalance,
    isRefreshingBalance,
    billingMode,
    plan,
    invoices,
    loadingInvoices,
    invoicesError,
    refetchInvoices,
    currentPeriodUsage,
    loadingCurrentPeriodUsage,
    checkoutStatus,
    handleBuyCredits,
    handleManagePaymentMethods,
    autoRechargeData,
    isAutoRechargeEnabled,
    minBalance,
    rechargeAmount,
    hasAutoRechargeChanges,
    isIneligibleForAutoRecharge,
    autoRechargeIneligibilityReason,
    autoRechargeAlert,
    setMinBalance,
    setRechargeAmount,
    handleToggleAutoRecharge,
    handleSaveAutoRecharge,
    isProfileDialogOpen,
    setIsProfileDialogOpen,
    availablePlans,
    loadingAvailablePlans,
    planGroupDisplayName,
    nextPeriodStart,
    handleSwitchPlan,
  } = useBilling(actions, orgContext);

  const isMetered = billingMode === 'METERED';

  return (
    <div className="w-full max-w-4xl space-y-6 p-8">
      {checkoutStatus && (
        <Alert variant={checkoutStatus.type === 'success' ? 'default' : 'destructive'}>
          {checkoutStatus.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {checkoutStatus.type === 'success' ? 'Payment Successful' : 'Payment Issue'}
          </AlertTitle>
          <AlertDescription>{checkoutStatus.message}</AlertDescription>
        </Alert>
      )}

      {!dataLoaded ? (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
          <p className="text-body-muted">Loading...</p>
        </div>
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

          <InvoicesTable
            invoices={invoices}
            loading={loadingInvoices}
            variant="metered"
            actions={actions}
            error={invoicesError}
            onRetry={refetchInvoices}
          />

          <Separator />

          <BillingProfileSection
            actions={actions}
            orgContext={orgContext}
            isProfileDialogOpen={isProfileDialogOpen}
            setIsProfileDialogOpen={setIsProfileDialogOpen}
          />
        </>
      ) : (
        <>
          <CreditsBillingSection
            orgContext={orgContext}
            balance={balance}
            loadingBalance={loadingBalance}
            isRefreshingBalance={isRefreshingBalance}
            handleBuyCredits={handleBuyCredits}
            handleManagePaymentMethods={handleManagePaymentMethods}
            autoRechargeData={autoRechargeData}
            isAutoRechargeEnabled={isAutoRechargeEnabled}
            minBalance={minBalance}
            rechargeAmount={rechargeAmount}
            hasAutoRechargeChanges={hasAutoRechargeChanges}
            isIneligibleForAutoRecharge={isIneligibleForAutoRecharge}
            autoRechargeIneligibilityReason={autoRechargeIneligibilityReason}
            autoRechargeAlert={autoRechargeAlert}
            setMinBalance={setMinBalance}
            setRechargeAmount={setRechargeAmount}
            handleToggleAutoRecharge={handleToggleAutoRecharge}
            handleSaveAutoRecharge={handleSaveAutoRecharge}
          />

          <Separator />

          {/*
            Invoices for CREDITS accounts: historical autorecharge
            invoices only. Admin-driven wallet credits (promo / manual
            top-ups) are excluded server-side because they don't have
            a Stripe invoice — they're visible in the credits-balance
            card. The Stripe customer portal (linked from "Manage
            Payment Methods" above) remains the canonical invoice
            receipt source; this table is a convenience view alongside
            it.
          */}
          <InvoicesTable
            invoices={invoices}
            loading={loadingInvoices}
            variant="credits"
            actions={actions}
            error={invoicesError}
            onRetry={refetchInvoices}
          />

          <Separator />

          <BillingProfileSection
            actions={actions}
            orgContext={orgContext}
            isProfileDialogOpen={isProfileDialogOpen}
            setIsProfileDialogOpen={setIsProfileDialogOpen}
          />
        </>
      )}
    </div>
  );
};

export default Main;
