"use server";

import {OrchestraAdminClient} from "@/lib/orchestra/orchestra-client";

export interface BillingDetails {
  id: string;
  credits: number;
  stripe_customer_id: string;
  autorecharge: boolean;
  autorecharge_threshold: number;
  autorecharge_qty: number;
  store_prompts: boolean;
}

/**
 * Retrieves billing details for a given user.
 * @param userID The ID of the user to retrieve billing details for.
 * @returns An array of billing details objects.
 */
export async function getUserBillingDetails(userID: string) {
  const response = await OrchestraAdminClient.get("/get_user", {
    params: { id: userID },
  });
  const billingDetails = response.data as BillingDetails[];
  return billingDetails;
}

/**
 * Enables or disables the auto-recharge feature for a user.
 * 
 * @param userID - The ID of the user.
 * @param enabled - A boolean indicating whether auto-recharge should be enabled or disabled.
 * @throws Will throw an error if the auto-recharge status update fails.
 */
export async function enableAutoRecharge(userID: string, enabled: boolean) {

  const response = await OrchestraAdminClient.put("/enable_autorecharge", null, {
    params: { id: userID, enable: enabled },
  });

  return response.data;
}

/**
 * Sets the auto-recharge threshold for a user.
 * 
 * @param userID - The ID of the user.
 * @param threshold - The threshold amount.
 * @throws Will throw an error if the auto-recharge threshold update fails.
 */
export async function setAutoRechargeThreshold (userID: string, threshold: number) {
  const response = await OrchestraAdminClient.put("/autorecharge_threshold", null, {
    params: { id: userID, threshold },
  })  
  return response.data
}

/**
 * Sets the auto-recharge amount for a user.
 * 
 * @param userID - The ID of the user.
 * @param amount - The recharge amount.
 * @throws Will throw an error if the auto-recharge amount update fails.
 * @returns The response from the API call.
 */
export async function setAutoRechargeQty(userID: string, amount: number) {
  const response = await OrchestraAdminClient.put("/autorecharge_qty", null, {
    params: { id: userID, qty: amount },
  })  
  return response.data
}

/**
 * Creates a new recharge transaction for a user.
 * 
 * @param userID - The ID of the user for whom to create the recharge transaction.
 * @param credits - The number of credits to add to the user's balance.
 * @param transactionID - The ID of the transaction that resulted in the recharge.
 * @returns The response from the API call, which should contain the recharge transaction details.
 * @throws Will throw an error if the recharge transaction creation fails.
 */
export async function createRecharge(userID: string, credits: number, transactionID: string) {
    const response = await OrchestraAdminClient.post("/create_recharge", null, {
        params: { id: userID, credits, type: "payment", transaction_id: transactionID },
    });
    return response.data
}