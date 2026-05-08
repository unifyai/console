'use client';

/**
 * useBilling – Central hook for the billing page.
 *
 * Receives server-action-bound `BillingActions` from the page and manages
 * all billing state + business logic. Components consume its return value.
 *
 * Pattern mirrors:
 *   @/hooks/Organizations/useOrganization.ts
 *   @/hooks/Assistants/useAssistantActions.ts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  AvailablePlanItem,
  AvailablePlansResponse,
  BillingActions,
  AutoRechargeData,
  AutoRechargeBlockedReason,
  BillingMode,
  CheckoutStatus,
  CurrentPeriodUsage,
  CurrentPlanSummary,
  InvoiceListItem,
  BillingOrgContext,
  SwitchPlanResponse,
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

  // Managed-billing: discriminator + active plan + invoices
  billingMode: BillingMode;
  plan: CurrentPlanSummary | null;
  invoices: InvoiceListItem[];
  loadingInvoices: boolean;
  /**
   * Surface for invoice-list fetch failures. ``null`` while a fetch
   * succeeds (or has not yet run) and a short server-supplied detail
   * string while one is failing — the table renders it inline so
   * users aren't left staring at an empty table thinking they have
   * no invoices when the API is actually down.
   */
  invoicesError: string | null;
  /**
   * Re-run the invoice fetch (also clears ``invoicesError`` on
   * success). Wired to the table's "Try again" affordance so users
   * can recover without reloading the whole page.
   */
  refetchInvoices: () => Promise<void>;
  /**
   * Mid-period usage snapshot (METERED only). `null` while loading or
   * when the active plan is CREDITS (the backend 404s in that case).
   */
  currentPeriodUsage: CurrentPeriodUsage | null;
  loadingCurrentPeriodUsage: boolean;

  // Self-serve plan switching
  /**
   * Server-derived list of templates the account can switch to.
   * Empty array when the account has no plan_group set; the
   * "Switch plan" UI section is hidden in that case.
   */
  availablePlans: AvailablePlanItem[];
  loadingAvailablePlans: boolean;
  /** Group display name for the section heading. */
  planGroupDisplayName: string | null;
  /** ISO-8601 next-month boundary every switch will land on. */
  nextPeriodStart: string | null;
  /**
   * Schedule a switch. Returns the server response so callers can
   * surface effective_at / classification in a confirmation toast.
   * Refreshes the plan + balance state on success.
   */
  handleSwitchPlan: (
    templateId: number,
    changeReason?: string
  ) => Promise<SwitchPlanResponse | null>;

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

  // ── Managed-billing ───────────────────────────────────────────────
  const [billingMode, setBillingMode] = useState<BillingMode>('CREDITS');
  const [plan, setPlan] = useState<CurrentPlanSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [currentPeriodUsage, setCurrentPeriodUsage] = useState<CurrentPeriodUsage | null>(null);
  const [loadingCurrentPeriodUsage, setLoadingCurrentPeriodUsage] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<AvailablePlanItem[]>([]);
  const [loadingAvailablePlans, setLoadingAvailablePlans] = useState(false);
  const [planGroupDisplayName, setPlanGroupDisplayName] = useState<string | null>(null);
  const [nextPeriodStart, setNextPeriodStart] = useState<string | null>(null);

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
  // Returns the resolved billing mode so callers can branch on it
  // *during the initial load* rather than waiting for state to settle.
  const fetchBalance = useCallback(async (): Promise<BillingMode> => {
    const result = await actions.getBalance();
    if (!isBillingError(result)) {
      setBalance(result.balance);
      setBillingMode(result.billingMode);
      setPlan(result.plan);
      return result.billingMode;
    }
    return 'CREDITS';
  }, [actions]);

  // ── Fetch invoices ───────────────────────────────────────────────────
  // Used by both METERED *and* CREDITS surfaces — InvoicesTable renders
  // either historical metered invoices or autorecharge / top-up
  // invoices depending on `variant`. On failure we surface the server
  // detail string via `invoicesError` so the table can render an inline
  // "couldn't load invoices" notice with a retry — silently swallowing
  // the error (the previous behaviour) made downtime indistinguishable
  // from a brand-new account with zero invoices.
  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const result = await actions.getInvoices({ limit: 50 });
      if (!isBillingError(result)) {
        setInvoices(result.invoices);
        setInvoicesError(null);
      } else {
        setInvoicesError(result.detail || "Couldn't load invoices. Try again in a moment.");
      }
    } catch (err) {
      setInvoicesError(
        err instanceof Error ? err.message : "Couldn't load invoices. Try again in a moment."
      );
    } finally {
      setLoadingInvoices(false);
    }
  }, [actions]);

  // ── Fetch in-progress usage estimate (METERED only) ──────────────────
  // The backend 404s for CREDITS accounts; we silently swallow that
  // here so the hook is safe to call unconditionally — callers gate on
  // ``billingMode`` to decide whether to render the progress bar.
  const fetchCurrentPeriodUsage = useCallback(async () => {
    setLoadingCurrentPeriodUsage(true);
    try {
      const result = await actions.getCurrentPeriodUsage();
      if (!isBillingError(result)) {
        setCurrentPeriodUsage(result);
      } else {
        setCurrentPeriodUsage(null);
      }
    } finally {
      setLoadingCurrentPeriodUsage(false);
    }
  }, [actions]);

  // ── Fetch self-serve plan switch catalog ─────────────────────────────
  // The endpoint is safe to call for every account — it returns an
  // empty list when no plan_group is assigned. We still render the
  // section conditionally on a non-empty list so unconfigured
  // accounts don't see a stale heading.
  const fetchAvailablePlans = useCallback(async () => {
    setLoadingAvailablePlans(true);
    try {
      const result: AvailablePlansResponse | { detail: string } = await actions.getAvailablePlans();
      if (!isBillingError(result)) {
        setAvailablePlans(result.available);
        setPlanGroupDisplayName(result.planGroupDisplayName);
        setNextPeriodStart(result.nextPeriodStart);
      } else {
        setAvailablePlans([]);
        setPlanGroupDisplayName(null);
      }
    } finally {
      setLoadingAvailablePlans(false);
    }
  }, [actions]);

  // ── Schedule a plan switch ───────────────────────────────────────────
  // After a successful switch, refresh balance (so the plan summary
  // updates if the move was effectively immediate) AND the available-
  // plans list (so the "current" badge moves to the new rung).
  const handleSwitchPlan = useCallback(
    async (templateId: number, changeReason?: string): Promise<SwitchPlanResponse | null> => {
      const result = await actions.switchPlan(templateId, changeReason);
      if (isBillingError(result)) {
        return null;
      }
      await Promise.all([fetchBalance(), fetchAvailablePlans()]);
      return result;
    },
    [actions, fetchBalance, fetchAvailablePlans]
  );

  // ── Initial data load ────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Load balance + plan first so we can branch on billingMode.
        setLoadingBalance(true);
        const mode = await fetchBalance();

        // Invoices apply to both modes:
        //   * METERED — month-end invoices from the metered invoicer.
        //   * CREDITS — autorecharge invoices + manual top-ups.
        // Fired in parallel with the mode-specific fetches below.
        const invoicesPromise = fetchInvoices();

        if (mode === 'METERED') {
          // METERED accounts: skip auto-recharge fetch (disabled server-side),
          // but pull the in-progress usage estimate that drives the
          // commitment / overage progress bar in MeteredBillingSection.
          // Available-plans is fired alongside — it returns [] for
          // accounts without a plan_group so calling it unconditionally
          // is cheap and lets the UI render the Switch Plan section
          // on the first paint with no extra round-trip.
          await Promise.all([invoicesPromise, fetchCurrentPeriodUsage(), fetchAvailablePlans()]);
        } else {
          // CREDITS path — load auto-recharge settings + eligibility alongside invoices.
          const [arResult] = await Promise.all([actions.getAutoRecharge(), invoicesPromise]);
          if (!isBillingError(arResult)) {
            setAutoRechargeData(arResult);
            setIsAutoRechargeEnabled(arResult.autoRechargeEnabled);
            setMinBalance(arResult.autoRechargeThreshold.toString());
            setRechargeAmount(arResult.autoRechargeQty.toString());
            setInitialMinBalance(arResult.autoRechargeThreshold.toString());
            setInitialRechargeAmount(arResult.autoRechargeQty.toString());
          }
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
        [
          'account_status',
          'Auto-recharge cannot be enabled while your account has an outstanding billing issue. Please resolve it first.',
        ],
        [
          'unpaid_invoice',
          'Auto-recharge cannot be enabled while you have an unpaid invoice. It will be available once your invoice is paid.',
        ],
        [
          'spending',
          `You need to spend $${autoRechargeData.minimumSpendRequired ?? 1000} to access automated top-ups. ${autoRechargeData.totalSpending ? `You've spent $${autoRechargeData.totalSpending.toFixed(2)}` : ''}`,
        ],
        [
          'payment_method',
          'A default payment method is required to enable auto-recharge. Please add one via "Manage Payment Methods".',
        ],
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

    billingMode,
    plan,
    invoices,
    loadingInvoices,
    invoicesError,
    refetchInvoices: fetchInvoices,
    currentPeriodUsage,
    loadingCurrentPeriodUsage,

    availablePlans,
    loadingAvailablePlans,
    planGroupDisplayName,
    nextPeriodStart,
    handleSwitchPlan,

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
