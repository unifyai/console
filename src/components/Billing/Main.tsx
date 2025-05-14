"use client";

import { useState, useEffect } from "react";
import Balance from "./Balance";
import AutomaticRefill from "./Refill";
import { Separator } from "../UI/separator";
import { Alert, AlertDescription, AlertTitle } from "../UI/alert";
import { AlertCircle } from "lucide-react";
import { Loader2 } from "lucide-react";

const Main = () => {
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [billingSetupChecked, setBillingSetupChecked] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

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
          {!hasPaymentMethod && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Payment Method Required</AlertTitle>
              <AlertDescription>
                Please set up your payment method to enable purchasing credits
                and automatic refills.
              </AlertDescription>
            </Alert>
          )}

          <Balance hasPaymentMethod={hasPaymentMethod} />
          <Separator />
          <AutomaticRefill hasPaymentMethod={hasPaymentMethod} />
        </>
      )}
    </div>
  );
};

export default Main;