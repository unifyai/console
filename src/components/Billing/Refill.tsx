"use client";

import { useState, useEffect } from "react";
import { Switch } from "../UI/switch";
import { Input } from "../UI/input";
import { Button } from "../UI/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../UI/card";
import { Alert, AlertDescription, AlertTitle } from "../UI/alert";
import { AlertCircle } from "lucide-react";

interface AutomaticRefillProps {
  hasPaymentMethod: boolean;
}

const AutomaticRefill = ({ hasPaymentMethod }: AutomaticRefillProps) => {
  const [isAutoRechargeEnabled, setIsAutoRechargeEnabled] = useState(false);
  const [minBalance, setMinBalance] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [initialMinBalance, setInitialMinBalance] = useState("");
  const [initialRechargeAmount, setInitialRechargeAmount] = useState("");
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"success" | "error">("success");

  useEffect(() => {
    const fetchAutoRechargeSettings = async () => {
      try {
        console.log("Fetching auto-recharge settings...");
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

    if (hasPaymentMethod) {
      fetchAutoRechargeSettings();
    } else {
      setIsAutoRechargeEnabled(false);
    }
  }, [hasPaymentMethod]);

  const handleToggleAutoRecharge = async () => {
    const newStatus = !isAutoRechargeEnabled;
    setIsAutoRechargeEnabled(newStatus);

    try {
      console.log("Toggling auto-recharge to:", newStatus);
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

    try {
      console.log("Saving auto-recharge settings...");
      await fetch("/api/billing/auto-recharge/settings", {
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
        <CardTitle className="text-2xl">Automatic Refill</CardTitle>
        <CardDescription className="text-sm">
          Set up automatic refills to keep your account balance topped up.
        </CardDescription>
        <div className="absolute top-4 right-4">
          <Switch
            checked={isAutoRechargeEnabled}
            onCheckedChange={handleToggleAutoRecharge}
            disabled={!hasPaymentMethod}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col">
            <label htmlFor="minBalance" className="text-sm font-medium">
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
            <label htmlFor="rechargeAmount" className="text-sm font-medium">
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
          </div>
          <Button
            onClick={handleSaveSettings}
            disabled={!hasChanges() || !isAutoRechargeEnabled}
          >
            Save Changes
          </Button>
          {!hasPaymentMethod && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Add a payment method to enable automatic refills.
              </AlertDescription>
            </Alert>
          )}
          {alertMessage && (
            <Alert variant={alertType === "success" ? "default" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AutomaticRefill;