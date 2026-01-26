'use client';

import { useState, useEffect } from 'react';
import Balance from './Balance';
import AutomaticRefill from './Refill';
import TaxClassification from './TaxClassification';
import Subscriptions from './Subscriptions';
import { Separator } from '../../UI/separator';
import { Alert, AlertDescription, AlertTitle } from '../../UI/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface BillingEligibility {
  userId: string;
  totalSpending: number;
  canEnableMonthlyBilling: boolean;
  minimumSpendRequired: number;
  remainingSpendNeeded: number;
}

interface CheckoutStatus {
  message: string;
  type: 'success' | 'error';
}

const Main = () => {
  const [billingSetupChecked, setBillingSetupChecked] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [billingEligibility, setBillingEligibility] = useState<BillingEligibility | null>(null);
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    const checkCheckoutStatus = async () => {
      const sessionId = searchParams.get('sessionId');
      if (sessionId) {
        let status: CheckoutStatus | null = null;
        // Use a try-catch block to handle network errors
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
        } catch (error) {
          status = {
            message: 'Unable to verify payment status. Please refresh to see your new balance.',
            type: 'error',
          };
        }

        setCheckoutStatus(status);

        // Clean the URL to avoid showing the message on page refresh
        window.history.replaceState(null, '', '/billing');

        // Set a timer to make the notification disappear after 7 seconds
        setTimeout(() => {
          setCheckoutStatus(null);
        }, 7000);
      }
    };

    checkCheckoutStatus();
  }, [searchParams]);

  useEffect(() => {
    //Handle New Users New Customer ID for Stripe
    const checkCustomerId = async () => {
      const response = await fetch('/api/billing/hasCustomerId');
      if (response.ok) {
        const hasCustomerId = await response.json();
        if (!hasCustomerId.hasCustomerId) {
          // Ensure Stripe customer by hitting account-type endpoint (keeps individual)
          await fetch('/api/user/account-type', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountType: 'individual' }),
          });
          setIsNewUser(true);
        }
      }
    };

    // Check billing eligibility first
    const checkBillingEligibility = async () => {
      try {
        const response = await fetch('/api/billing/eligibility');
        if (response.ok) {
          const eligibility = await response.json();
          setBillingEligibility(eligibility);
        }
      } catch (error) {
        console.error('Error fetching billing eligibility:', error);
      }
    };

    // Check auto-recharge status
    const checkAutoRechargeStatus = async () => {
      try {
        const response = await fetch('/api/billing/auto-recharge/settings');
        if (response.ok) {
          const settings = await response.json();
          setAutoRechargeEnabled(settings.autoRechargeEnabled);
        }
      } catch (error) {
        console.error('Error fetching auto-recharge settings:', error);
      }
    };

    const checkBillingSetup = async () => {
      await checkCustomerId();
      await checkBillingEligibility();
      await checkAutoRechargeStatus();
      setBillingSetupChecked(true);
    };

    checkBillingSetup();
  }, []);

  return (
    <div className="w-fit space-y-6 p-8">
      <div>
        <h1 className="text-h1 text-foreground">Billing</h1>
        <p className="text-subtitle">Manage your credits balance and payment preferences.</p>
      </div>

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

      {!billingSetupChecked ? (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
          <p className="text-body-muted">Loading...</p>
        </div>
      ) : (
        <>
          <Subscriptions />

          <Separator />
          {billingEligibility && !billingEligibility.canEnableMonthlyBilling ? (
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Spend $100 to Access Automated Top-ups</AlertTitle>
              <AlertDescription className="whitespace-normal break-words">
                You&#39;ve spent ${billingEligibility.totalSpending.toFixed(2)}, spend $
                {billingEligibility.remainingSpendNeeded.toFixed(2)} more to unlock automatic
                refills. You can still purchase credits manually.
              </AlertDescription>
            </Alert>
          ) : null}

          <Balance
            billingEligibility={billingEligibility}
            autoRechargeEnabled={autoRechargeEnabled}
          />

          <Separator />
          <TaxClassification />

          {billingEligibility?.canEnableMonthlyBilling && (
            <>
              <Separator />
              <AutomaticRefill />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Main;
