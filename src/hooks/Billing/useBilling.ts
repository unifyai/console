'use client';

/**
 * useBilling – Central hook for the billing page.
 *
 * Receives server-action-bound `BillingActions` from the page and manages
 * all billing state + business logic. Components consume its return value.
 *
 * Self-serve model: accounts subscribe to a monthly credit tier (1 credit
 * = $1). Credits reset each cycle; free/trial credits expire a week after
 * signup. There is no one-time top-up and no auto-recharge — depletion is
 * a hard stop the customer resolves by upgrading a tier (manual) or opting
 * into auto-increment (auto-upgrade to the next tier, capped at the top).
 *
 * Pattern mirrors:
 *   @/hooks/Organizations/useOrganization.ts
 *   @/hooks/Assistants/useAssistantActions.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  AutoIncrementData,
  AvailablePlanItem,
  AvailablePlansResponse,
  BillingActions,
  BillingMode,
  CurrentPeriodUsage,
  CurrentPlanSummary,
  InvoiceListItem,
  BillingOrgContext,
  SubscribeResponse,
  SwitchPlanResponse,
} from '@/types/billing';
import { isBillingError } from '@/types/billing';
import { resolveDisplayCurrency, type DisplayCurrency } from '@/lib/billing/currency';
// =============================================================================
// Return type
// =============================================================================

export interface UseBillingReturn {
  // Loading
  dataLoaded: boolean;

  // Balance / credits
  balance: string | null;
  fullBalance: number;
  loadingBalance: boolean;
  isRefreshingBalance: boolean;
  handleRefreshBalance: () => Promise<void>;

  // Managed-billing: discriminator + active plan + subscription facts
  billingMode: BillingMode;
  plan: CurrentPlanSummary | null;
  /** Whether the self-serve account holds a paid subscription. */
  isSubscribed: boolean;
  /** Monthly credit grant for the active tier (null when unsubscribed). */
  monthlyCreditAllowance: number | null;
  /** ISO trial-credit expiry (null once subscribed). */
  trialExpiresAt: string | null;
  /** ISO next subscription renewal (null when unsubscribed). */
  nextRenewalAt: string | null;
  /**
   * Whether the active subscription is scheduled to cancel at period end.
   * Drives a persistent "cancels on {nextRenewalAt}" indicator.
   */
  cancelAtPeriodEnd: boolean;

  // Display currency (DISPLAY-ONLY; settlement is always USD)
  displayCurrency: DisplayCurrency;

  /**
   * Whether the billing profile has a complete address on file (street, city,
   * postal code, country). Subscriptions enable Stripe automatic tax, which
   * needs a resolvable customer location — a country alone is enough for
   * country-level VAT (UK) but not US sales tax (needs postal code/state) — so
   * the subscribe flow is gated on a full address (the backend rejects without).
   */
  hasBillingAddress: boolean;
  /**
   * Re-fetch the billing profile (display currency + address gate). Call after
   * the profile is edited so `hasBillingAddress` updates without a full reload.
   */
  refetchBillingProfile: () => Promise<void>;

  /** Whether the account has at least one saved card (self-serve subscribe gate). */
  hasPaymentMethod: boolean;
  /** Re-check saved cards — call after the payment-methods section mutates them. */
  refreshPaymentMethods: () => Promise<void>;

  // Invoices
  invoices: InvoiceListItem[];
  loadingInvoices: boolean;
  invoicesError: string | null;
  refetchInvoices: () => Promise<void>;

  // METERED mid-period usage
  currentPeriodUsage: CurrentPeriodUsage | null;
  loadingCurrentPeriodUsage: boolean;

  // Self-serve plan catalog
  availablePlans: AvailablePlanItem[];
  loadingAvailablePlans: boolean;
  planGroupDisplayName: string | null;
  nextPeriodStart: string | null;

  /** Subscribe an unsubscribed account to a tier (first payment). */
  handleSubscribe: (templateId: number) => Promise<SubscribeResponse | null>;
  /** Cancel the active subscription (at period end by default). */
  handleCancelSubscription: (immediate?: boolean) => Promise<boolean>;
  /** Resume a subscription scheduled to cancel at period end. */
  handleResumeSubscription: () => Promise<boolean>;
  /** Change an already-subscribed account to another tier (immediate). */
  handleSwitchPlan: (
    templateId: number,
    changeReason?: string
  ) => Promise<SwitchPlanResponse | null>;

  // Auto-increment (replaces auto-recharge)
  autoIncrement: AutoIncrementData | null;
  isAutoIncrementEnabled: boolean;
  isAtTopTier: boolean;
  handleToggleAutoIncrement: () => Promise<void>;

  // Payment methods (Stripe portal)
  handleManagePaymentMethods: () => Promise<void>;

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

  // ── Balance / credits ──────────────────────────────────────────────────
  const [balance, setBalance] = useState<string | null>(null);
  const [fullBalance, setFullBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // ── Managed-billing / subscription ───────────────────────────────────
  const [billingMode, setBillingMode] = useState<BillingMode>('CREDITS');
  const [plan, setPlan] = useState<CurrentPlanSummary | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [nextRenewalAt, setNextRenewalAt] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  // ── Display currency (DISPLAY-ONLY) ──────────────────────────────────
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('USD');

  // ── Billing-profile tax gate (full address present?) ─────────────────
  const [hasBillingAddress, setHasBillingAddress] = useState(false);

  // ── Payment-method gate (any saved card present?) ────────────────────
  // Self-serve subscribe charges the saved card off-session, so it's gated
  // on a card being on file (added in the always-on payment section).
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);

  // ── Invoices ─────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [currentPeriodUsage, setCurrentPeriodUsage] = useState<CurrentPeriodUsage | null>(null);
  const [loadingCurrentPeriodUsage, setLoadingCurrentPeriodUsage] = useState(false);

  // ── Plan catalog ─────────────────────────────────────────────────────
  const [availablePlans, setAvailablePlans] = useState<AvailablePlanItem[]>([]);
  const [loadingAvailablePlans, setLoadingAvailablePlans] = useState(false);
  const [planGroupDisplayName, setPlanGroupDisplayName] = useState<string | null>(null);
  const [nextPeriodStart, setNextPeriodStart] = useState<string | null>(null);

  // ── Auto-increment ───────────────────────────────────────────────────
  const [autoIncrement, setAutoIncrement] = useState<AutoIncrementData | null>(null);
  const [isAutoIncrementEnabled, setIsAutoIncrementEnabled] = useState(false);

  // ── Billing Profile Dialog ───────────────────────────────────────────
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  // ── Pending activation (off-session first payment cleared) ───────────
  // Subscribe charges the saved card synchronously, but the tier/credits are
  // activated by the asynchronous ``invoice.paid`` webhook. While that's in
  // flight we poll + refetch until the subscription is recognised.
  const [pendingCheckout, setPendingCheckout] = useState(false);

  const isAtTopTier = autoIncrement?.atTopTier ?? false;

  // ── Fetch balance ────────────────────────────────────────────────────
  // Returns the resolved billing mode so callers can branch on it during
  // the initial load rather than waiting for state to settle.
  const fetchBalance = useCallback(async (): Promise<BillingMode> => {
    const result = await actions.getBalance();
    if (!isBillingError(result)) {
      setBalance(result.balance);
      setFullBalance(result.fullBalance);
      setBillingMode(result.billingMode);
      setPlan(result.plan);
      setIsSubscribed(result.isSubscribed);
      setTrialExpiresAt(result.trialExpiresAt);
      setNextRenewalAt(result.nextRenewalAt);
      setCancelAtPeriodEnd(result.cancelAtPeriodEnd);
      return result.billingMode;
    }
    return 'CREDITS';
  }, [actions]);

  // ── Fetch billing profile: display currency + tax gate (full address) ─
  const fetchDisplayCurrency = useCallback(async () => {
    const result = await actions.getProfile();
    if (!isBillingError(result)) {
      const address = result.billingAddress as Record<string, string> | undefined;
      const country = address?.country;
      setDisplayCurrency(resolveDisplayCurrency(country));
      // The subscribe tax gate is the backend-authoritative
      // ``billing_setup_complete`` flag — set when a complete billing address
      // has been synced to the Stripe customer (billing PII now lives on
      // Stripe, not locally). The FE mirrors that exact flag instead of
      // re-deriving address completeness, so the CTA gate can never disagree
      // with what the subscribe endpoint will enforce.
      setHasBillingAddress(Boolean(result.billingSetupComplete));
    }
  }, [actions]);

  // ── Fetch saved-card presence (subscribe gate) ───────────────────────
  const fetchPaymentMethods = useCallback(async () => {
    const result = await actions.listPaymentMethods();
    setHasPaymentMethod(!isBillingError(result) && result.paymentMethods.length > 0);
  }, [actions]);

  // ── Fetch auto-increment opt-in ──────────────────────────────────────
  const fetchAutoIncrement = useCallback(async () => {
    const result = await actions.getAutoIncrement();
    if (!isBillingError(result)) {
      setAutoIncrement(result);
      setIsAutoIncrementEnabled(result.enabled);
    }
  }, [actions]);

  // ── Fetch invoices ───────────────────────────────────────────────────
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
  const fetchCurrentPeriodUsage = useCallback(async () => {
    setLoadingCurrentPeriodUsage(true);
    try {
      const result = await actions.getCurrentPeriodUsage();
      setCurrentPeriodUsage(isBillingError(result) ? null : result);
    } finally {
      setLoadingCurrentPeriodUsage(false);
    }
  }, [actions]);

  // ── Fetch self-serve plan catalog ────────────────────────────────────
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

  // ── Subscribe (unsubscribed → first paid tier) ───────────────────────
  // When the response carries a hosted invoice URL the customer must
  // complete the first payment on the Stripe-hosted page. We return the URL
  // and let the caller open it (in a new tab); local state is NOT refreshed
  // here because the account isn't subscribed until Stripe confirms payment
  // (``invoice.paid``). Only the immediate-subscribe path (no hosted invoice)
  // refreshes state and reports success.
  const handleSubscribe = useCallback(
    async (templateId: number): Promise<SubscribeResponse | null> => {
      const result = await actions.subscribe(templateId);
      if (isBillingError(result)) {
        toast.error(result.detail || 'We could not start your subscription. Please try again.');
        return null;
      }

      // Subscribe charges the saved card off-session server-side, so by the
      // time we get here payment has cleared. The tier/credits activate on
      // the ``invoice.paid`` webhook, so refresh now and arm a short poll to
      // pick that up without a manual refresh.
      await Promise.all([
        fetchBalance(),
        fetchAvailablePlans(),
        fetchAutoIncrement(),
        fetchInvoices(),
      ]);
      setPendingCheckout(true);
      return result;
    },
    [actions, fetchBalance, fetchAvailablePlans, fetchAutoIncrement, fetchInvoices]
  );

  // ── Cancel subscription (subscribed → free, at period end) ───────────
  const handleCancelSubscription = useCallback(
    async (immediate = false): Promise<boolean> => {
      const result = await actions.cancelSubscription(immediate);
      if (isBillingError(result)) {
        toast.error(result.detail || 'We could not cancel your subscription. Please try again.');
        return false;
      }

      await Promise.all([fetchBalance(), fetchAvailablePlans(), fetchAutoIncrement()]);
      toast.success(
        result.status === 'canceling' && result.effectiveAt
          ? `Your subscription will end on ${new Date(
              result.effectiveAt
            ).toLocaleDateString()}. You keep your credits until then.`
          : 'Your subscription has been cancelled.'
      );
      return true;
    },
    [actions, fetchBalance, fetchAvailablePlans, fetchAutoIncrement]
  );

  // ── Resume subscription (undo a scheduled end-of-period cancel) ──────
  const handleResumeSubscription = useCallback(async (): Promise<boolean> => {
    const result = await actions.reactivateSubscription();
    if (isBillingError(result)) {
      toast.error(result.detail || 'We could not resume your subscription. Please try again.');
      return false;
    }

    await Promise.all([fetchBalance(), fetchAvailablePlans(), fetchAutoIncrement()]);
    toast.success(
      result.effectiveAt
        ? `Your subscription will continue and renew on ${new Date(
            result.effectiveAt
          ).toLocaleDateString()}.`
        : 'Your subscription has been resumed.'
    );
    return true;
  }, [actions, fetchBalance, fetchAvailablePlans, fetchAutoIncrement]);

  // ── Change tier (subscribed → another tier, immediate) ───────────────
  const handleSwitchPlan = useCallback(
    async (templateId: number, changeReason?: string): Promise<SwitchPlanResponse | null> => {
      const result = await actions.switchPlan(templateId, changeReason);
      if (isBillingError(result)) {
        toast.error(result.detail || 'We could not change your plan. Please try again.');
        return null;
      }
      await Promise.all([
        fetchBalance(),
        fetchAvailablePlans(),
        fetchAutoIncrement(),
        fetchInvoices(),
      ]);
      // Immediate (subscribed) tier changes report success here so the
      // message is a toast rather than an inline body banner. The METERED
      // "scheduled" path has its own dedicated confirmation UI.
      if (result.status === 'switched') {
        toast.success(
          'Your plan was updated and takes effect immediately. Your credit allowance has been adjusted with a prorated charge.'
        );
      } else if (result.status === 'noop') {
        toast.info("You're already on that tier.");
      }
      return result;
    },
    [actions, fetchBalance, fetchAvailablePlans, fetchAutoIncrement, fetchInvoices]
  );

  // ── Initial data load ────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingBalance(true);
        const mode = await fetchBalance();

        const invoicesPromise = fetchInvoices();
        const currencyPromise = fetchDisplayCurrency();

        if (mode === 'METERED') {
          await Promise.all([
            invoicesPromise,
            currencyPromise,
            fetchCurrentPeriodUsage(),
            fetchAvailablePlans(),
          ]);
        } else {
          await Promise.all([
            invoicesPromise,
            currencyPromise,
            fetchAvailablePlans(),
            fetchAutoIncrement(),
            fetchPaymentMethods(),
          ]);
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

  // ── Recognise the activated subscription without a manual refresh ────
  // The off-session first charge clears during the subscribe call, but the
  // tier activates on the asynchronous ``invoice.paid`` webhook. While that's
  // pending we poll the balance (and refetch on tab focus) until the
  // subscription lands, then stop and confirm. A deadline caps the polling.
  useEffect(() => {
    if (!pendingCheckout) return;

    if (isSubscribed) {
      setPendingCheckout(false);
      toast.success('Your subscription is now active.');
      void fetchInvoices();
      return;
    }

    const POLL_MS = 4000;
    const DEADLINE_MS = 10 * 60 * 1000;
    const startedAt = Date.now();
    const refresh = () =>
      Promise.all([fetchBalance(), fetchAvailablePlans(), fetchAutoIncrement()]);

    const intervalId = setInterval(() => {
      if (Date.now() - startedAt > DEADLINE_MS) {
        setPendingCheckout(false);
        return;
      }
      void refresh();
    }, POLL_MS);

    const onReturn = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [
    pendingCheckout,
    isSubscribed,
    fetchBalance,
    fetchAvailablePlans,
    fetchAutoIncrement,
    fetchInvoices,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleRefreshBalance = useCallback(async () => {
    setIsRefreshingBalance(true);
    await fetchBalance();
    setIsRefreshingBalance(false);
  }, [fetchBalance]);

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

  const handleToggleAutoIncrement = useCallback(async () => {
    const next = !isAutoIncrementEnabled;
    setIsAutoIncrementEnabled(next);

    const result = await actions.updateAutoIncrement({ enabled: next });
    if (isBillingError(result)) {
      setIsAutoIncrementEnabled(!next);
      toast.error(result.detail || 'Failed to update auto-increment.');
      return;
    }

    setAutoIncrement(result);
    setIsAutoIncrementEnabled(result.enabled);
    toast.success(`Auto-increment has been ${result.enabled ? 'enabled' : 'disabled'}.`);
  }, [isAutoIncrementEnabled, actions]);

  // The monthly allowance is exactly the active tier's commit amount
  // (1 credit = $1) — derived from the plan rather than a duplicated
  // top-level account-info field.
  const monthlyCreditAllowance = isSubscribed ? (plan?.commitAmount ?? null) : null;

  // ── Return ───────────────────────────────────────────────────────────
  return {
    dataLoaded,

    balance,
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
    refetchBillingProfile: fetchDisplayCurrency,

    hasPaymentMethod,
    refreshPaymentMethods: fetchPaymentMethods,

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
    handleSubscribe,
    handleCancelSubscription,
    handleResumeSubscription,
    handleSwitchPlan,

    autoIncrement,
    isAutoIncrementEnabled,
    isAtTopTier,
    handleToggleAutoIncrement,

    handleManagePaymentMethods,

    isProfileDialogOpen,
    setIsProfileDialogOpen,
  };
}
