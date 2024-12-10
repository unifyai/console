"use client";

import React from "react";
import PrimaryButton from "../Common/Buttons/Primary";
import { User } from "@/types/user";
/**
 * Opens the Stripe billing portal for the user to manage their subscription.
 * It fetches the URL of the portal session from `/api/stripe/portalSession`.
 * If the response is not OK, it throws an error.
 * Otherwise, it opens the portal in a new tab.
 */
const openBillingPortal = async () => {

  const response = await fetch(`/api/stripe/portalSession`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  console.log(response);  

  if (!response.ok) {
    throw new Error("Failed to get the billing portal URL.");
  }
  const { url: portalUrl } = await response.json();
  window.open(portalUrl, "_blank");
};

/**
 * A component for managing billing information.
 * 
 * This component provides an interface for users to manage their payment methods,
 * download invoices, and update billing information. It includes a button that
 * opens the Stripe billing portal in a new tab, allowing users to handle their
 * subscription details.
 */
const BillingPortal = () => {
  return (
      <PrimaryButton
        onClick={() => openBillingPortal()}
        className="bg-primary disabled:muted rounded-lg text-primary-foreground px-7 py-3 uppercase text-xs font-bold mb-2 tutorial-billing-portal"
        label="Manage Account"
      />
  );
};

export default BillingPortal;
