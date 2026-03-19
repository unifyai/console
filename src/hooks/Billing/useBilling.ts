'use client';

/**
 * useBilling – Central hook for the billing page.
 *
 * Receives server-action-bound `BillingActions` from the page and manages
 * all billing state + business logic. Components consume its return value.
 *
 * Pattern mirrors:
 *   @/hooks/useOrganization.ts
 *   @/hooks/Assistants/useAssistantActions.ts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  BillingActions,
  AutoRechargeData,
  AutoRechargeBlockedReason,
  CheckoutStatus,
  BillingOrgContext,
} from '@/types/billing';
import { isBillingError } from '@/types/billing';

// =============================================================================
// Return type
// =============================================================================

export interface UseBillingReturn {
  // Loading
  dataLoaded: boolean;

  // Balance
  balance: string | null;
  loadingBalance: boolean;
  isRefreshingBalance: boolean;
  handleRefreshBalance: () => Promise<void>;

  // Checkout
  checkoutStatus: CheckoutStatus | null;
  handleBuyCredits: () => Promise<void>;
  handleManagePaymentMethods: () => Promise<void>;

  // Auto-recharge
  autoRechargeData: AutoRechargeData | null;
  isAutoRechargeEnabled: boolean;
  minBalance: string;
  rechargeAmount: string;
  initialMinBalance: string;
  initialRechargeAmount: string;
  hasAutoRechargeChanges: boolean;
  isIneligibleForAutoRecharge: boolean;
  autoRechargeIneligibilityReason: AutoRechargeBlockedReason | null;
  autoRechargeAlert: { type: 'success' | 'error'; message: string } | null;
  setMinBalance: (value: string) => void;
  setRechargeAmount: (value: string) => void;
  handleToggleAutoRecharge: () => Promise<void>;
  handleSaveAutoRecharge: () => Promise<void>;

  // Billing Profile
  isProfileDialogOpen: boolean;
  setIsProfileDialogOpen: (open: boolean) => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useBilling(
  actions: BillingActions,
  orgContext?: BillingOrgContext | null
): UseBillingReturn {
  // ── Loading ──────────────────────────────────────────────────────────
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Balance ──────────────────────────────────────────────────────────
  const [balance, setBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // ── Checkout ─────────────────────────────────────────────────────────
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);

  // ── Auto-recharge ────────────────────────────────────────────────────
  const [autoRechargeData, setAutoRechargeData] = useState<AutoRechargeData | null>(null);
  const [isAutoRechargeEnabled, setIsAutoRechargeEnabled] = useState(false);
  const [minBalance, setMinBalance] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [initialMinBalance, setInitialMinBalance] = useState('');
  const [initialRechargeAmount, setInitialRechargeAmount] = useState('');
  const [autoRechargeAlert, setAutoRechargeAlert] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ── Billing Profile Dialog ───────────────────────────────────────────
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  const searchParams = useSearchParams();

  // ── Derived ──────────────────────────────────────────────────────────
  const hasAutoRechargeChanges =
    minBalance !== initialMinBalance || rechargeAmount !== initialRechargeAmount;

  const isIneligibleForAutoRecharge = useMemo(
    () =>
      autoRechargeData !== null &&
      autoRechargeData.blockedReason !== null &&
      !isAutoRechargeEnabled,
    [autoRechargeData, isAutoRechargeEnabled]
  );

  const autoRechargeIneligibilityReason = useMemo((): AutoRechargeBlockedReason | null => {
    if (!autoRechargeData || isAutoRechargeEnabled) return null;
    return autoRechargeData.blockedReason;
  }, [autoRechargeData, isAutoRechargeEnabled]);

  // ── Fetch balance ────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    const result = await actions.getBalance();
    if (!isBillingError(result)) {
      setBalance(result.balance);
    }
  }, [actions]);

  // ── Initial data load ────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Load balance
        setLoadingBalance(true);
        await fetchBalance();

        // Load auto-recharge settings + eligibility
        const arResult = await actions.getAutoRecharge();
        if (!isBillingError(arResult)) {
          setAutoRechargeData(arResult);
          setIsAutoRechargeEnabled(arResult.autoRechargeEnabled);
          setMinBalance(arResult.autoRechargeThreshold.toString());
          setRechargeAmount(arResult.autoRechargeQty.toString());
          setInitialMinBalance(arResult.autoRechargeThreshold.toString());
          setInitialRechargeAmount(arResult.autoRechargeQty.toString());
        }
      } catch (error) {
        console.error('Failed to initialise billing page:', error);
      } finally {
        setLoadingBalance(false);
        setDataLoaded(true);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Checkout return handling ─────────────────────────────────────────
  useEffect(() => {
    const checkCheckoutReturn = async () => {
      const sessionId = searchParams.get('sessionId');
      if (!sessionId) return;

      let status: CheckoutStatus;
      try {
        const result = await actions.getCheckoutStatus(sessionId);

        if (isBillingError(result)) {
          status = {
            message: result.detail || 'An error occurred while checking your payment status.',
            type: 'error',
          };
        } else if (result.paymentStatus === 'paid') {
          status = {
            message: 'Payment successful! Your new balance will be reflected shortly.',
            type: 'success',
          };
          // Refresh balance to show updated credits
          await fetchBalance();
        } else {
          status = {
            message: 'Your payment was not successful. Please try again.',
            type: 'error',
          };
        }
      } catch (error) {
        console.error('Error checking checkout status:', error);
        status = {
          message: 'An error occurred while checking your payment status.',
          type: 'error',
        };
      }

      setCheckoutStatus(status);
      window.history.replaceState(null, '', '/billing');
      setTimeout(() => setCheckoutStatus(null), 7000);
    };

    checkCheckoutReturn();
  }, [searchParams, actions, fetchBalance]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleRefreshBalance = useCallback(async () => {
    setIsRefreshingBalance(true);
    await fetchBalance();
    setIsRefreshingBalance(false);
  }, [fetchBalance]);

  const handleBuyCredits = useCallback(async () => {
    const result = await actions.createCheckoutSession();
    if (isBillingError(result)) {
      console.error('Error creating checkout session:', result.detail);
      return;
    }
    if (result.url) {
      window.location.assign(result.url);
    }
  }, [actions]);

  const handleManagePaymentMethods = useCallback(async () => {
    const result = await actions.createPortalSession();
    if (isBillingError(result)) {
      console.error('Failed to open billing portal:', result.detail);
      return;
    }
    if (result.url) {
      window.location.assign(result.url);
    }
  }, [actions]);

  const handleToggleAutoRecharge = useCallback(async () => {
    if (!isAutoRechargeEnabled && autoRechargeData?.blockedReason) {
      const reason = autoRechargeData.blockedReason;
      const blockedMessages = new Map<AutoRechargeBlockedReason, string>([
        ['account_status', 'Auto-recharge cannot be enabled while your account has an outstanding billing issue. Please resolve it first.'],
        ['unpaid_invoice', 'Auto-recharge cannot be enabled while you have an unpaid invoice. It will be available once your invoice is paid.'],
        ['spending', `You need to spend $${autoRechargeData.minimumSpendRequired ?? 1000} to access automated top-ups. ${autoRechargeData.totalSpending ? `You've spent $${autoRechargeData.totalSpending.toFixed(2)}` : ''}`],
        ['payment_method', 'A default payment method is required to enable auto-recharge. Please add one via "Manage Payment Methods".'],
      ]);
      setAutoRechargeAlert({
        type: 'error',
        message: blockedMessages.get(reason) ?? 'Auto-recharge cannot be enabled at this time.',
      });
      return;
    }

    const newStatus = !isAutoRechargeEnabled;
    setIsAutoRechargeEnabled(newStatus);

    const result = await actions.toggleAutoRecharge(newStatus);
    if (isBillingError(result)) {
      setAutoRechargeAlert({
        type: 'error',
        message: result.detail || 'Failed to update auto-recharge status.',
      });
      // Revert
      setIsAutoRechargeEnabled(!newStatus);
      return;
    }

    setAutoRechargeAlert({
      type: 'success',
      message: `Auto-recharge has been ${newStatus ? 'enabled' : 'disabled'}.`,
    });
  }, [isAutoRechargeEnabled, autoRechargeData, actions]);

  const handleSaveAutoRecharge = useCallback(async () => {
    if (Number(minBalance) <= 0 || Number(rechargeAmount) <= 0) {
      setAutoRechargeAlert({
        type: 'error',
        message: 'Please enter valid amounts greater than zero.',
      });
      return;
    }

    const minAmount = autoRechargeData?.minRechargeAmount ?? 25;
    if (Number(rechargeAmount) < minAmount) {
      setAutoRechargeAlert({
        type: 'error',
        message: `Recharge amount must be at least $${minAmount} to save changes.`,
      });
      return;
    }

    const result = await actions.updateAutoRecharge({
      enabled: isAutoRechargeEnabled,
      threshold: Number(minBalance),
      qty: Number(rechargeAmount),
    });

    if (isBillingError(result)) {
      setAutoRechargeAlert({
        type: 'error',
        message: result.detail || 'Failed to save auto-recharge settings.',
      });
      return;
    }

    setInitialMinBalance(minBalance);
    setInitialRechargeAmount(rechargeAmount);
    setAutoRechargeAlert({
      type: 'success',
      message: 'Auto-recharge settings updated successfully.',
    });
  }, [minBalance, rechargeAmount, isAutoRechargeEnabled, autoRechargeData, actions]);

  // ── Return ───────────────────────────────────────────────────────────
  return {
    dataLoaded,

    balance,
    loadingBalance,
    isRefreshingBalance,
    handleRefreshBalance,

    checkoutStatus,
    handleBuyCredits,
    handleManagePaymentMethods,

    autoRechargeData,
    isAutoRechargeEnabled,
    minBalance,
    rechargeAmount,
    initialMinBalance,
    initialRechargeAmount,
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
  };
}

