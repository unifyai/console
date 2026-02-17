'use client';

import { useState, useEffect, useCallback } from 'react';
import { Separator } from '../../UI/separator';
import { Alert, AlertDescription, AlertTitle } from '../../UI/alert';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wallet,
  FileText,
  Pencil,
  RefreshCw,
  CreditCard,
  Zap,
} from 'lucide-react';
import { Button } from '../../UI/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../UI/card';
import { Switch } from '../../UI/switch';
import { Input } from '../../UI/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../UI/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../UI/tooltip';
import { useSearchParams } from 'next/navigation';
import BillingProfile from './BillingProfile';

interface CheckoutStatus {
  message: string;
  type: 'success' | 'error';
}

/** Organization context for billing page */
interface OrgContext {
  orgId: number;
  orgName: string;
  canEdit: boolean;
}

export interface BillingMainProps {
  /** Organization context (null for personal workspace) */
  orgContext?: OrgContext | null;
}

interface AutoRechargeEligibility {
  userId: string;
  totalSpending: number;
  canEnableAutoRecharge: boolean;
  minimumSpendRequired: number;
  remainingSpendNeeded: number;
}

const Main = ({ orgContext }: BillingMainProps) => {
  // ── State ────────────────────────────────────────────────────────────────
  const [dataLoaded, setBillingSetupChecked] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);

  // Balance
  const [balance, setBalance] = useState<number | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Auto-recharge
  const [isAutoRechargeEnabled, setIsAutoRechargeEnabled] = useState(false);
  const [minBalance, setMinBalance] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [initialMinBalance, setInitialMinBalance] = useState('');
  const [initialRechargeAmount, setInitialRechargeAmount] = useState('');
  const [autoRechargeAlert, setAutoRechargeAlert] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [eligibility, setEligibility] = useState<AutoRechargeEligibility | null>(null);

  // Billing Profile Dialog
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  const searchParams = useSearchParams();

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    try {
      const data = await fetch('/api/billing/balance').then((r) => r.json());
      if (data) {
        setBalance(data.balance);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, []);

  // ── Checkout return handling ─────────────────────────────────────────────
  useEffect(() => {
    const checkCheckoutStatus = async () => {
      const sessionId = searchParams.get('sessionId');
      if (sessionId) {
        let status: CheckoutStatus | null = null;
        try {
          const res = await fetch(`/api/stripe/session-status?sessionId=${sessionId}`);
          const data = await res.json();

          if (res.ok) {
            if (data.paymentStatus === 'paid') {
              status = {
                message: 'Payment successful! Your new balance will be reflected shortly.',
                type: 'success',
              };
            } else {
              status = {
                message: 'Your payment was not successful. Please try again.',
                type: 'error',
              };
            }
          } else {
            status = {
              message: data.error || 'An error occurred while checking your payment status.',
              type: 'error',
            };
          }
        } catch {
          status = {
            message: 'Unable to verify payment status. Please refresh to see your new balance.',
            type: 'error',
          };
        }

        setCheckoutStatus(status);
        window.history.replaceState(null, '', '/billing');
        setTimeout(() => setCheckoutStatus(null), 7000);
      }
    };

    checkCheckoutStatus();
  }, [searchParams]);

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Load balance
      setLoadingBalance(true);
      await fetchBalance();
      setLoadingBalance(false);

      // Load auto-recharge eligibility + settings
      try {
        const [eligRes, settingsRes] = await Promise.all([
          fetch('/api/billing/eligibility'),
          fetch('/api/billing/auto-recharge/settings'),
        ]);
        if (eligRes.ok) {
          setEligibility(await eligRes.json());
        }
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setIsAutoRechargeEnabled(s.autoRechargeEnabled);
          setMinBalance(s.autoRechargeThreshold.toString());
          setRechargeAmount(s.autoRechargeQty.toString());
          setInitialMinBalance(s.autoRechargeThreshold.toString());
          setInitialRechargeAmount(s.autoRechargeQty.toString());
        }
      } catch (error) {
        console.error('Error loading auto-recharge data:', error);
      }

      setBillingSetupChecked(true);
    };

    init();
  }, [fetchBalance]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRefreshBalance = async () => {
    setIsRefreshingBalance(true);
    await fetchBalance();
    setIsRefreshingBalance(false);
  };

  const handleBuyCredits = async () => {
    try {
      const response = await fetch('/api/stripe/checkoutSession');
      if (!response.ok) {
        console.error('Error creating checkout session:', response.statusText);
        return;
      }
      const { url } = await response.json();
      if (url) {
        window.location.assign(url);
      }
    } catch (error) {
      console.error('Error during buy credits:', error);
    }
  };

  const handleManagePaymentMethods = async () => {
    try {
      const response = await fetch('/api/stripe/portalSession');
      if (response.ok) {
        const { url: portalUrl } = await response.json();
        if (portalUrl) {
          window.location.assign(portalUrl);
        }
      } else {
        console.error('Failed to open billing portal');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
    }
  };

  const handleToggleAutoRecharge = async () => {
    if (!isAutoRechargeEnabled && !eligibility?.canEnableAutoRecharge) {
      setAutoRechargeAlert({
        type: 'error',
        message: `You need to spend $${eligibility?.minimumSpendRequired ?? 100} to access automated top-ups. ${eligibility?.totalSpending ? `You've spent ${eligibility?.totalSpending?.toFixed(2)}` : ''}`,
      });
      return;
    }

    const newStatus = !isAutoRechargeEnabled;
    setIsAutoRechargeEnabled(newStatus);

    try {
      await fetch('/api/billing/auto-recharge/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newStatus }),
      });
      setAutoRechargeAlert({
        type: 'success',
        message: `Auto-recharge has been ${newStatus ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error toggling auto-recharge:', error);
      setAutoRechargeAlert({ type: 'error', message: 'Failed to update auto-recharge status.' });
    }
  };

  const handleSaveAutoRecharge = async () => {
    if (Number(minBalance) <= 0 || Number(rechargeAmount) <= 0) {
      setAutoRechargeAlert({
        type: 'error',
        message: 'Please enter valid amounts greater than zero.',
      });
      return;
    }

    if (Number(rechargeAmount) < 25) {
      setAutoRechargeAlert({
        type: 'error',
        message: 'Recharge amount must be at least $25 to save changes.',
      });
      return;
    }

    try {
      const response = await fetch('/api/billing/auto-recharge/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoRechargeEnabled: isAutoRechargeEnabled,
          autoRechargeThreshold: Number(minBalance),
          autoRechargeQty: Number(rechargeAmount),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setAutoRechargeAlert({
          type: 'error',
          message: errorData.error || 'Failed to save auto-recharge settings.',
        });
        return;
      }

      setInitialMinBalance(minBalance);
      setInitialRechargeAmount(rechargeAmount);
      setAutoRechargeAlert({
        type: 'success',
        message: 'Auto-recharge settings updated successfully.',
      });
    } catch (error) {
      console.error('Error saving auto-recharge settings:', error);
      setAutoRechargeAlert({
        type: 'error',
        message: 'Failed to save auto-recharge settings.',
      });
    }
  };

  const hasAutoRechargeChanges =
    minBalance !== initialMinBalance || rechargeAmount !== initialRechargeAmount;

  const isIneligibleForAutoRecharge =
    eligibility && !eligibility.canEnableAutoRecharge && !isAutoRechargeEnabled;

  // ── Render ───────────────────────────────────────────────────────────────
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
      ) : (
        <>
          {/* ─────────────────── A. BALANCE SECTION ─────────────────── */}
          <section className="space-y-4">
            <div>
              <h2 className="text-h3 flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Balance
              </h2>
              <p className="text-body-muted mt-1">
                {orgContext
                  ? `Credits and payment methods for ${orgContext.orgName}`
                  : 'Manage your credits and payment methods'}
              </p>
            </div>

            {/* A.1 — Credits Block */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Credits</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-body font-semibold text-primary">
                      {loadingBalance || isRefreshingBalance ? (
                        <span className="text-muted-foreground">Loading...</span>
                      ) : (
                        `$${balance ?? 0}`
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="default" onClick={handleBuyCredits} size="sm">
                      Buy Credits
                    </Button>
                    <Button variant="outline" onClick={handleManagePaymentMethods} size="sm">
                      Manage Payment Methods
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* A.2 — Auto-Recharge Block */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Auto-Recharge</CardTitle>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Switch
                            checked={isAutoRechargeEnabled}
                            onCheckedChange={handleToggleAutoRecharge}
                            disabled={!!isIneligibleForAutoRecharge}
                          />
                        </div>
                      </TooltipTrigger>
                      {isIneligibleForAutoRecharge && (
                        <TooltipContent className="max-w-xs">
                          <p>
                            You need to spend ${eligibility?.minimumSpendRequired} before enabling
                            auto-recharge. You&apos;ve spent $
                            {eligibility?.totalSpending?.toFixed(2)}, spend $
                            {eligibility?.remainingSpendNeeded?.toFixed(2)} more to unlock.
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription className="text-body-muted">
                  {isIneligibleForAutoRecharge
                    ? `Spend $${eligibility?.remainingSpendNeeded?.toFixed(2)} more to unlock automatic refills.`
                    : 'Automatically top up your balance when it falls below a threshold.'}
                </CardDescription>
              </CardHeader>

              {isAutoRechargeEnabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label htmlFor="minBalance" className="text-label mb-1">
                        Minimum Balance
                      </label>
                      <Input
                        prefix="$"
                        id="minBalance"
                        type="number"
                        placeholder="Enter minimum balance"
                        value={minBalance}
                        onChange={(e) => setMinBalance(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="rechargeAmount" className="text-label mb-1">
                        Recharge Amount
                      </label>
                      <Input
                        prefix="$"
                        id="rechargeAmount"
                        type="number"
                        placeholder="Enter recharge amount"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(e.target.value)}
                      />
                      <p className="text-caption mt-1 text-muted-foreground">
                        Minimum recharge amount: $25
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveAutoRecharge}
                    disabled={!hasAutoRechargeChanges}
                    size="sm"
                  >
                    Save Changes
                  </Button>

                  {autoRechargeAlert && (
                    <Alert
                      variant={
                        autoRechargeAlert.type === 'success' ? 'default' : 'destructive'
                      }
                    >
                      {autoRechargeAlert.type === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription className="whitespace-normal break-words">
                        {autoRechargeAlert.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              )}

              {!isAutoRechargeEnabled && autoRechargeAlert && (
                <CardContent>
                  <Alert
                    variant={autoRechargeAlert.type === 'success' ? 'default' : 'destructive'}
                  >
                    {autoRechargeAlert.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription className="whitespace-normal break-words">
                      {autoRechargeAlert.message}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              )}
            </Card>
          </section>

          <Separator />

          {/* ─────────────────── B. BILLING PROFILE SECTION ─────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-h3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Billing Profile
                </h2>
                <p className="text-body-muted mt-1">
                  {orgContext
                    ? `Billing details for ${orgContext.orgName}`
                    : 'Your billing details and tax information'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsProfileDialogOpen(true)}
                className="gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>

            {/* Read-only billing profile view */}
            <BillingProfile isEditing={false} onEditingChange={() => {}} />

            {/* Edit Dialog */}
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Edit Billing Profile</DialogTitle>
                  <DialogDescription>
                    {orgContext
                      ? `Update billing details for ${orgContext.orgName}`
                      : 'Update your billing details and tax information'}
                  </DialogDescription>
                </DialogHeader>
                <BillingProfile
                  isEditing={true}
                  onEditingChange={(editing) => {
                    if (!editing) {
                      setIsProfileDialogOpen(false);
                    }
                  }}
                />
              </DialogContent>
            </Dialog>
          </section>
        </>
      )}
    </div>
  );
};

export default Main;
