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
  const [isNewUser, setIsNewUser] = useState(false);
  const [freeCreditsClaimed, setFreeCreditsClaimed] = useState(false);

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

    // Handle Free Credits Claim
    const handleFreeCreditsClaim = async () => {
      //check if user has got free credits
      const response = await fetch("/api/billing/hasFreeCredits");
      if (response.ok) {  
        const hasFreeCredits = await response.json();
        if (!hasFreeCredits.hasFreeCredits) {
          const response = await fetch("/api/billing/claimFreeCredits");
          if (response.status == 200) {
            setFreeCreditsClaimed(true);          
          }
        } 
      }
    };

    const checkBillingSetup = async () => {
      await checkCustomerId();
      await checkPaymentMethod();
      if (hasPaymentMethod) {
        await syncCards();
        await handleFreeCreditsClaim();
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
        <p>Loading...</p>
      ) : (
        <>
          {!hasPaymentMethod && !isNewUser && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Payment Method Required</AlertTitle>
              <AlertDescription>
                Please set up your payment method to enable purchasing credits
                and automatic refills.
              </AlertDescription>
            </Alert>
          )}

          {isNewUser && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Welcome to Unify! 🎉</AlertTitle>
              <AlertDescription>
                You&apos;re eligible for free credits! Add a payment method to our billing portal to claim $5 free credits.
              </AlertDescription>
            </Alert>
          )}

          {freeCreditsClaimed && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Free Credits Claimed 💸</AlertTitle>
              <AlertDescription>
                You have successfully claimed $5 free credits! These credits will be added to your account shortly.
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