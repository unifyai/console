"use client";

import { useState, useEffect } from "react";
import { Button } from "../UI/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../UI/card";

interface BalanceProps {
  hasPaymentMethod: boolean;
  billingEligibility: {
    user_id: string;
    total_spending: number;
    can_enable_monthly_billing: boolean;
    minimum_spend_required: number;
    remaining_spend_needed: number;
  } | null;
  autoRechargeEnabled: boolean;
}

const Balance = ({ hasPaymentMethod, billingEligibility, autoRechargeEnabled }: BalanceProps) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [fullBalance, setFullBalance] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balanceData  = await fetch("/api/billing/balance") . then((response) => response.json());

        if (!balanceData) {
          throw new Error("Failed to fetch balance data");
        }

        setBalance(balanceData.balance);
        setFullBalance(balanceData.fullBalance);
      } catch (error) {
        console.error("Error fetching balance:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [hasPaymentMethod]);

  const handleBuyCredits = async () => {
    try {
      const response = await fetch(`/api/stripe/checkoutSession`);

      if (!response.ok) {
        console.error("Error creating checkout session:", response.statusText);
        return;
      }

      const { url } = await response.json();

      if (url) {
        window.location.assign(url);
      }
    } catch (error) {
      console.error("Error during buy credits:", error);
    }
  };

  const handleOpenPortal = async () => {
    try {
      const response = await fetch("/api/stripe/portalSession");
      if (response.ok) {
        const { url: portalUrl } = await response.json();
        if (portalUrl) {
          window.location.assign(portalUrl);
        }
      } else {
        console.error("Failed to open billing portal");
      }
    } catch (error) {
      console.error("Error opening billing portal:", error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Account Balance</CardTitle>
        <CardDescription className="text-xl">
          {loading ? "Loading balance..." : "Your current balance is" + " $" + balance}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col space-y-4 items-start" >
            <Button
              className="w-fit"
              variant="link"
              onClick={handleBuyCredits}
            >
              Buy Credits
            </Button>
            <Button
              className="w-fit"
              variant="link"
              onClick={() =>
                window.open("https://calendly.com/unify-chat/general", "_blank")
              }
            >
              Request Extra Credits
            </Button>
          </div>
          <div className="flex flex-col space-y-4 items-center">
            {billingEligibility?.can_enable_monthly_billing && (
              <Button 
                variant="primary" 
                onClick={handleOpenPortal}
                className="w-fit"
              >
                Manage Billing Account
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Balance;