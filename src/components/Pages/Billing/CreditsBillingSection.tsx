'use client';

import { AlertCircle, CheckCircle2, CreditCard, Wallet, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '../../UI/alert';
import { Button } from '../../UI/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../UI/card';
import { Input } from '../../UI/input';
import { Switch } from '../../UI/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../UI/tooltip';
import type {
  AutoRechargeBlockedReason,
  AutoRechargeData,
  BillingOrgContext,
} from '@/types/billing';

// =============================================================================
// Props
// =============================================================================

export interface CreditsBillingSectionProps {
  orgContext?: BillingOrgContext | null;

  // Balance
  balance: string | null;
  loadingBalance: boolean;
  isRefreshingBalance: boolean;
  handleBuyCredits: () => Promise<void>;
  handleManagePaymentMethods: () => Promise<void>;

  // Auto-recharge
  autoRechargeData: AutoRechargeData | null;
  isAutoRechargeEnabled: boolean;
  minBalance: string;
  rechargeAmount: string;
  hasAutoRechargeChanges: boolean;
  isIneligibleForAutoRecharge: boolean;
  autoRechargeIneligibilityReason: AutoRechargeBlockedReason | null;
  autoRechargeAlert: { type: 'success' | 'error'; message: string } | null;
  setMinBalance: (value: string) => void;
  setRechargeAmount: (value: string) => void;
  handleToggleAutoRecharge: () => Promise<void>;
  handleSaveAutoRecharge: () => Promise<void>;
}

// =============================================================================
// Component
// =============================================================================

/**
 * CREDITS-mode balance + auto-recharge UI.
 *
 * Shown only when ``billingMode === 'CREDITS'``. METERED accounts hide
 * this entirely (their wallet is intentionally zero) and instead see
 * ``MeteredBillingSection``.
 */
export const CreditsBillingSection = ({
  orgContext,
  balance,
  loadingBalance,
  isRefreshingBalance,
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
}: CreditsBillingSectionProps) => (
  <section className="space-y-4" data-testid="credits-balance-section">
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

    {/* Credits Block */}
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

    {/* Auto-Recharge Block */}
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
                  {autoRechargeIneligibilityReason === 'account_status' ? (
                    <p>
                      Auto-recharge is unavailable while your account has an outstanding billing
                      issue. Please resolve it to re-enable.
                    </p>
                  ) : autoRechargeIneligibilityReason === 'unpaid_invoice' ? (
                    <p>
                      Auto-recharge was disabled because a payment failed. It can be re-enabled once
                      your outstanding invoice is paid.
                    </p>
                  ) : autoRechargeIneligibilityReason === 'spending' ? (
                    <p>
                      You need to spend ${autoRechargeData?.minimumSpendRequired} before enabling
                      auto-recharge. You&apos;ve spent $
                      {autoRechargeData?.totalSpending?.toFixed(2)}, spend $
                      {autoRechargeData?.remainingSpendNeeded?.toFixed(2)} more to unlock.
                    </p>
                  ) : (
                    <p>
                      A default payment method is required to enable auto-recharge. Please add one
                      via &quot;Manage Payment Methods&quot; below.
                    </p>
                  )}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-body-muted">
          {isIneligibleForAutoRecharge
            ? autoRechargeIneligibilityReason === 'account_status'
              ? 'Resolve your billing issue to re-enable automatic refills.'
              : autoRechargeIneligibilityReason === 'unpaid_invoice'
                ? 'Automatic refills paused until your outstanding invoice is paid.'
                : autoRechargeIneligibilityReason === 'spending'
                  ? `Spend $${autoRechargeData?.remainingSpendNeeded?.toFixed(2)} more to unlock automatic refills.`
                  : 'Add a default payment method to enable automatic refills.'
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
                Minimum recharge amount: ${autoRechargeData?.minRechargeAmount ?? 25}
              </p>
            </div>
          </div>
          <Button onClick={handleSaveAutoRecharge} disabled={!hasAutoRechargeChanges} size="sm">
            Save Changes
          </Button>

          {autoRechargeAlert && (
            <Alert variant={autoRechargeAlert.type === 'success' ? 'default' : 'destructive'}>
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
          <Alert variant={autoRechargeAlert.type === 'success' ? 'default' : 'destructive'}>
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
);
