"use client";

import React, { useEffect, useState } from "react";
import { Switch } from "../UI/switch";
import BaseCard from "../Common/Card/Base";
import { Input } from "../Common/Input/Content";
import PrimaryButton from "../Common/Buttons/Primary";
import {
  getUserBillingDetails,
  enableAutoRecharge,
  setAutoRechargeThreshold,
  setAutoRechargeQty,
} from "@/lib/user/billing/billing";
import { getCustomerDefaultPaymentMethod } from "@/lib/user/billing/stripe/stripe";
import { getCurrentUser } from "@/lib/user/user";
import { BalanceDetails, User } from "@/types/user";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/UI/alert"
import { AlertCircle } from "lucide-react"

const AutomaticRefill = () => {
  const [userID, setUserID] = useState<string>("");
  const [isAutoRechargeEnabled, setIsAutoRechargeEnabled] = useState(false);
  const [minCutoff, setMinCutoff] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [initialMinCutoff, setInitialMinCutoff] = useState("");
  const [initialRechargeAmount, setInitialRechargeAmount] = useState("");
  const [hasDefaultPaymentMethod, setHasDefaultPaymentMethod] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const billingDetailsResponse = fetch(`/api/billing/details`);
        const defaultPaymentMethodResponse = fetch(`/api/stripe/defaultPaymentMethod`);

        const [billingDetails, defaultPaymentMethod] = await Promise.all([
          billingDetailsResponse.then((res) => res.json()),
          defaultPaymentMethodResponse.then((res) => res.json()),
        ]);

        if (billingDetails && billingDetails.length > 0) {
          const userDetails = billingDetails[0];
          const initialCutoff = userDetails.autorecharge_threshold || "";
          const initialAmount = userDetails.autorecharge_qty || "";

          setMinCutoff(initialCutoff.toString());
          setRechargeAmount(initialAmount.toString());
          setInitialMinCutoff(initialCutoff.toString());
          setInitialRechargeAmount(initialAmount.toString());
          setIsAutoRechargeEnabled(userDetails.autorecharge || false);
        }

        setHasDefaultPaymentMethod(!!defaultPaymentMethod);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setAlert({ type: 'error', message: "Billing details have not been set." });
      }
    };
    fetchData();
  }, []);

  const handleToggleAutoRecharge = async () => {
    const newStatus = !isAutoRechargeEnabled;
    setIsAutoRechargeEnabled(newStatus);
    try {
      await enableAutoRecharge(userID, newStatus);
      setAlert({ type: 'success', message: `Auto-recharge ${newStatus ? 'enabled' : 'disabled'}.` });
    } catch (error) {
      console.error("Error toggling auto-recharge:", error);
      setAlert({ type: 'error', message: "Failed to update auto-recharge status." });
    }
  };

  const handleSave = async () => {
    if (Number(minCutoff) <= 0 || Number(rechargeAmount) <= 0) {
      setAlert({ type: 'error', message: "Please enter valid non-zero values before saving." });
      return;
    }

    try {
      await Promise.all([
        setAutoRechargeThreshold(userID, Number(minCutoff)),
        setAutoRechargeQty(userID, Number(rechargeAmount))
      ]);
      setInitialMinCutoff(minCutoff);
      setInitialRechargeAmount(rechargeAmount);
      setAlert({ type: 'success', message: `Auto-recharge settings saved: Min Cutoff - $${minCutoff}, Recharge Amount - $${rechargeAmount}` });
    } catch (error) {
      console.error("Error saving auto-recharge settings:", error);
      setAlert({ type: 'error', message: "Failed to save auto-recharge settings." });
    }
  };

  const hasChanges = () => {
    return (
      minCutoff !== initialMinCutoff || rechargeAmount !== initialRechargeAmount
    );
  };

  return (
    <BaseCard
      title="Automatic Refill"
      description="Set up automatic refills to keep your account balance topped up."
      className="relative"
    >
      <div className="absolute top-4 right-4">
        <Switch
          checked={isAutoRechargeEnabled}
          onCheckedChange={handleToggleAutoRecharge}
          disabled={!hasDefaultPaymentMethod}
        />
      </div>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-primary">
            Minimum balance:
          </p>
          <Input
            StartContent="$"
            type="number"
            value={minCutoff}
            onChange={(e) => setMinCutoff(e.target.value)}
            placeholder="Enter minimum balance"
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-primary">
            Recharge amount:
          </p>
          <Input
            StartContent="$"
            type="number"
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(e.target.value)}
            placeholder="Enter recharge amount"
          />
        </div>
        <PrimaryButton
          onClick={handleSave}
          disabled={!hasChanges()}
          label="Save Changes"
        />
      </div>
      {alert && (
        <Alert variant={alert.type === 'error' ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{alert.type === 'error' ? "Error" : "Success"}</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}
    </BaseCard>
  );
};

export default AutomaticRefill;