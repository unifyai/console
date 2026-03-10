'use client';

import { Separator } from '../../UI/separator';
import { Alert, AlertDescription, AlertTitle } from '../../UI/alert';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Wallet,
  FileText,
  Pencil,
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
import BillingProfile from './BillingProfile';
import { useBilling } from '@/hooks/Billing/useBilling';
import type { BillingActions, BillingOrgContext } from '@/types/billing';

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
    handleRefreshBalance,
    checkoutStatus,
    handleBuyCredits,
    handleManagePaymentMethods,
    autoRechargeData,
    isAutoRechargeEnabled,
    minBalance,
    rechargeAmount,
    hasAutoRechargeChanges,
    isIneligibleForAutoRecharge,
    autoRechargeAlert,
    setMinBalance,
    setRechargeAmount,
    handleToggleAutoRecharge,
    handleSaveAutoRecharge,
    isProfileDialogOpen,
    setIsProfileDialogOpen,
  } = useBilling(actions, orgContext);

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
                            You need to spend ${autoRechargeData?.minimumSpendRequired} before enabling
                            auto-recharge. You&apos;ve spent $
                            {autoRechargeData?.totalSpending?.toFixed(2)}, spend $
                            {autoRechargeData?.remainingSpendNeeded?.toFixed(2)} more to unlock.
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription className="text-body-muted">
                  {isIneligibleForAutoRecharge
                    ? `Spend $${autoRechargeData?.remainingSpendNeeded?.toFixed(2)} more to unlock automatic refills.`
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
                {!orgContext && (
                  <p className="text-caption mt-2 flex items-start gap-1.5 text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Personal workspaces use individual tax treatment. If you need business
                      tax invoicing, <a href="/organizations" className="underline text-primary">create an organization</a>.
                    </span>
                  </p>
                )}
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
            <BillingProfile
              actions={actions}
              isEditing={false}
              onEditingChange={() => {}}
            />

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
                  actions={actions}
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
