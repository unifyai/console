"use client";

import { useState, useEffect } from "react";
import { Switch } from "../../UI/switch";
import { Input } from "../../UI/input";
import { Button } from "../../UI/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../UI/card";
import { Alert, AlertDescription, AlertTitle } from "../../UI/alert";
import { AlertCircle } from "lucide-react";

interface BillingEligibility {
  user_id: string;
  total_spending: number;
  can_enable_monthly_billing: boolean;
  minimum_spend_required: number;
  remaining_spend_needed: number;
}

const AutomaticRefill = () => {
  const [isAutoRechargeEnabled, setIsAutoRechargeEnabled] = useState(false);
  const [minBalance, setMinBalance] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [initialMinBalance, setInitialMinBalance] = useState("");
  const [initialRechargeAmount, setInitialRechargeAmount] = useState("");
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"success" | "error">("success");
  const [billingEligibility, setBillingEligibility] = useState<BillingEligibility | null>(null);

  useEffect(() => {
    const fetchBillingEligibility = async () => {
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

    const fetchAutoRechargeSettings = async () => {
      try {
        const response = await fetch("/api/billing/auto-recharge/settings",);
        if (response.ok) {
          const data = await response.json();
          setIsAutoRechargeEnabled(data.autoRechargeEnabled);
          setMinBalance(data.autoRechargeThreshold.toString());
          setRechargeAmount(data.autoRechargeQty.toString());
          setInitialMinBalance(data.autoRechargeThreshold.toString());
          setInitialRechargeAmount(data.autoRechargeQty.toString());
        }
      } catch (error) {
        console.error("Error fetching auto-recharge settings:", error);
      }
    };

    // Always fetch settings
    fetchBillingEligibility();
    fetchAutoRechargeSettings();
  }, []);

  const handleToggleAutoRecharge = async () => {
    // Only check eligibility when trying to ENABLE auto-recharge (not disable)
    if (!isAutoRechargeEnabled && !billingEligibility?.can_enable_monthly_billing) {
      setAlertMessage(
        `You need to spend $${billingEligibility?.minimum_spend_required} to access automated top-ups. You've spent $${billingEligibility?.total_spending?.toFixed(2)}, spend $${billingEligibility?.remaining_spend_needed?.toFixed(2)} more to unlock this feature.`
      );
      setAlertType("error");
      return;
    }

    const newStatus = !isAutoRechargeEnabled;
    setIsAutoRechargeEnabled(newStatus);

    try {
      await fetch("/api/billing/auto-recharge/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: newStatus }),
      });
      setAlertMessage(
        `Auto-recharge has been ${newStatus ? "enabled" : "disabled"}.`
      );
      setAlertType("success");
    } catch (error) {
      console.error("Error toggling auto-recharge:", error);
      setAlertMessage("Failed to update auto-recharge status.");
      setAlertType("error");
    }
  };

  const handleSaveSettings = async () => {
    if (Number(minBalance) <= 0 || Number(rechargeAmount) <= 0) {
      setAlertMessage("Please enter valid amounts greater than zero.");
      setAlertType("error");
      return;
    }

    // Strict $25 minimum enforcement for all modifications
    if (Number(rechargeAmount) < 25) {
      setAlertMessage("Recharge amount must be at least $25 to save changes.");
      setAlertType("error");
      return;
    }

    try {
      const response = await fetch("/api/billing/auto-recharge/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          autoRechargeEnabled: isAutoRechargeEnabled,
          autoRechargeThreshold: Number(minBalance),
          autoRechargeQty: Number(rechargeAmount),
        }),
      });
      
      if (!response.ok) {
        // Handle error response
        const errorData = await response.json();
        setAlertMessage(errorData.error || "Failed to save auto-recharge settings.");
        setAlertType("error");
        return;
      }
      
      // Success case
      setInitialMinBalance(minBalance);
      setInitialRechargeAmount(rechargeAmount);
      setAlertMessage("Auto-recharge settings updated successfully.");
      setAlertType("success");
    } catch (error) {
      console.error("Error saving auto-recharge settings:", error);
      setAlertMessage("Failed to save auto-recharge settings.");
      setAlertType("error");
    }
  };

  const hasChanges = () => {
    return (
      minBalance !== initialMinBalance || rechargeAmount !== initialRechargeAmount
    );
  };

  return (
    <Card className="w-full relative">
      <CardHeader>
        <CardTitle className="text-h3">Automatic Refill</CardTitle>
        <CardDescription className="text-body">
          Set up automatic refills to keep your account balance topped up.
        </CardDescription>
        <div className="absolute top-4 right-4">
          <Switch
            checked={isAutoRechargeEnabled}
            onCheckedChange={handleToggleAutoRecharge}
            disabled={false}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {billingEligibility && !billingEligibility.can_enable_monthly_billing && !isAutoRechargeEnabled && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-normal break-words">
                <div>
                  <strong>Spend $100 to Access Automated Top-ups</strong>
                  <br />
                  You&#39;ve spent ${billingEligibility.total_spending.toFixed(2)}, spend ${billingEligibility.remaining_spend_needed.toFixed(2)} more to unlock automatic refills.
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex flex-col">
            <label htmlFor="minBalance" className="text-label">
              Minimum Balance
            </label>
            <Input
              prefix="$"
              id="minBalance"
              type="number"
              placeholder="Enter minimum balance"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              disabled={!isAutoRechargeEnabled}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="rechargeAmount" className="text-label">
              Recharge Amount
            </label>
            <Input
              prefix="$"
              id="rechargeAmount"
              type="number"
              placeholder="Enter recharge amount"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              disabled={!isAutoRechargeEnabled}
            />
            {isAutoRechargeEnabled && (
              <p className="text-xs text-muted-foreground mt-1">
                Minimum recharge amount: $25
              </p>
            )}
          </div>
          <Button
            onClick={handleSaveSettings}
            disabled={!hasChanges() || !isAutoRechargeEnabled}
          >
            Save Changes
          </Button>
          {alertMessage && (
            <Alert variant={alertType === "success" ? "default" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-normal break-words">{alertMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AutomaticRefill;