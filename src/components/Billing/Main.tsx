"use client";

import { useState, useEffect } from "react";
import Balance from "./Balance";
import AutomaticRefill from "./Refill";
import { Separator } from "../UI/separator";
import { Alert, AlertDescription, AlertTitle } from "../UI/alert";
import { AlertCircle } from "lucide-react";
import { Loader2 } from "lucide-react";

interface BillingEligibility {
  user_id: string;
  total_spending: number;
  can_enable_monthly_billing: boolean;
  minimum_spend_required: number;
  remaining_spend_needed: number;
}

const Main = () => {
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [billingSetupChecked, setBillingSetupChecked] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [billingEligibility, setBillingEligibility] = useState<BillingEligibility | null>(null);
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false);

  useEffect(() => {
    //Handle New Users New Customer ID for Stripe
    const checkCustomerId = async () => {
      const response = await fetch("/api/billing/hasCustomerId");
      if (response.ok) {
        const hasCustomerId = await response.json();
        if (hasCustomerId.hasCustomerId == false) {
          const createCustomerResponse = await fetch(
            "/api/stripe/createCustomer"
          );
          if (createCustomerResponse.ok) {
            setIsNewUser(true);
          }
        }
      }
    };

    // Check billing eligibility first
    const checkBillingEligibility = async () => {
      try {
        const response = await fetch("/api/billing/eligibility");
        if (response.ok) {
          const eligibility = await response.json();
          setBillingEligibility(eligibility);
        }
      } catch (error) {
        console.error("Error fetching billing eligibility:", error);
      }
    };

    // Check auto-recharge status for grandfathering
    const checkAutoRechargeStatus = async () => {
      try {
        const response = await fetch("/api/billing/auto-recharge/settings");
        if (response.ok) {
          const settings = await response.json();
          setAutoRechargeEnabled(settings.autoRechargeEnabled);
        }
      } catch (error) {
        console.error("Error fetching auto-recharge settings:", error);
      }
    };
  
    // Check if the user has a payment method set up
    const checkPaymentMethod = async () => {
      const response = await fetch("/api/stripe/hasCardSetup");
      if (response.ok) {
        const hasCardSetup = await response.json();
        setHasPaymentMethod(hasCardSetup.hasCardSetup);
      }
    };

    // Sync Cards
    const syncCards = async () => {
      await fetch("/api/billing/syncCards");
    };

    const checkBillingSetup = async () => {
      await checkCustomerId();
      await checkBillingEligibility();
      await checkAutoRechargeStatus();
      await checkPaymentMethod();
      if (hasPaymentMethod) {
        await syncCards();
      }
      setBillingSetupChecked(true);
    };

    checkBillingSetup();
  }, [hasPaymentMethod]);

  return (
    <div className="space-y-6 p-8 w-fit">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground">
          Manage your credits balance and payment preferences.
        </p>
      </div>

      {!billingSetupChecked ? (
        <div className="flex flex-col justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <>
          {billingEligibility && !billingEligibility.can_enable_monthly_billing ? (
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Spend $100 to Access Automated Top-ups</AlertTitle>
              <AlertDescription className="whitespace-normal break-words">
                You've spent ${billingEligibility.total_spending.toFixed(2)}, spend ${billingEligibility.remaining_spend_needed.toFixed(2)} more to unlock automatic refills. You can still purchase credits manually.
              </AlertDescription>
            </Alert>
          ) : !hasPaymentMethod ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Payment Method Required</AlertTitle>
              <AlertDescription className="whitespace-normal break-words">
                Please set up your payment method to enable purchasing credits and automatic refills.
              </AlertDescription>
            </Alert>
          ) : null}

          <Balance hasPaymentMethod={hasPaymentMethod} billingEligibility={billingEligibility} autoRechargeEnabled={autoRechargeEnabled} />
          
          {(billingEligibility?.can_enable_monthly_billing || autoRechargeEnabled) && (
            <>
              <Separator />
              <AutomaticRefill hasPaymentMethod={hasPaymentMethod} />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Main;