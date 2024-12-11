"use client";

import { useState, useEffect } from "react";
import Balance from "./Balance";
import AutomaticRefill from "./Refill";
import { Separator } from "../UI/separator";
import { Alert, AlertDescription, AlertTitle } from "../UI/alert";
import { AlertCircle } from "lucide-react";

const Main = () => {
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [billingSetupChecked, setBillingSetupChecked] = useState(false);

  useEffect(() => {
    // Check if the user has a payment method set up
    const checkPaymentMethod = async () => {
      console.log("Checking for payment method...");
      const SyncCards = await fetch("/api/billing/syncCards");
      if (!SyncCards.ok) {
        console.error("Error syncing cards:", SyncCards.statusText);
      }

      const checkCardSetup = await fetch("/api/billing/hasCardSetup");
      if (checkCardSetup.ok) {
        const hasCardSetup = await checkCardSetup.json();
        setHasPaymentMethod(hasCardSetup.hasCardSetup);
        console.log("Has payment method:", hasCardSetup.hasCardSetup);
      } else {
        console.error("Error checking for card setup:", checkCardSetup.statusText);
      }

      setBillingSetupChecked(true);
    };

    checkPaymentMethod();
  }, []);

  return (
    <div className="space-y-6 p-8 w-fit">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground">
          Manage your credits balance and payment preferences.
        </p>
      </div>

      {!billingSetupChecked ? (
        <p>Loading...</p>
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