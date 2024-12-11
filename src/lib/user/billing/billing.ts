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

export interface RechargeModelRequest {
  user_id : string,
  quantity: number,
  type: string,
  transaction_id: string
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

  const billingDetails: BillingDetails[] = response.data;
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
 * Creates a recharge for a user, given the user's ID, the amount of credits to add
 * and a transaction ID.
 * 
 * @param userID - The ID of the user to recharge.
 * @param credits - The amount of credits to add. Must be a positive number.
 * @param transactionID - The ID of the transaction that triggered the recharge.
 * @throws Will throw an error if the recharge amount is invalid.
 * @returns The response from the API call.
 */
export async function createRecharge(userID: string, credits: number, transactionID: string) {

  if (credits <= 0) {
    throw new Error("Invalid recharge amount");
  }

  const rechargeData: RechargeModelRequest = {
      user_id: userID,
      quantity: credits,
      type: "payment",
      transaction_id: transactionID
  }

  const response = await OrchestraAdminClient.post("/create_recharge", rechargeData);
  return response.data
}

/**
 * Retrieves the user's card fingerprints from Stripe.
 * @param userID - The user ID.
 * @returns An array of card fingerprints.
 */
export const getUserCards = async (userID: string): Promise<string[]> => {
  const response = await OrchestraAdminClient.get("credit_card_fingerprint", {
    params: { user_id: userID },
  });
  return response.data;
};

/**
 * Stores a new card fingerprint for a user.
 * @param userID - The ID of the user to store the card fingerprint for.
 * @param fingerprint - The card fingerprint to store.
 * @returns The response from the API call, which should contain the stored card fingerprint details.
 * @throws Will throw an error if the card fingerprint storage fails.
 */
export const storeUserCard = async (userID: string, fingerprint: string) => {
  const response = await OrchestraAdminClient.post("credit_card_fingerprint", null, {
    params: { user_id: userID, fingerprint },
  });
  return response.data;
};

/**
 * Checks if a card fingerprint is a duplicate for a user.
 * @param userID - The ID of the user to check.
 * @param fingerprint - The card fingerprint to check.
 * @returns A boolean indicating whether the card fingerprint is a duplicate.
 */
export const isDuplicateCard = async (userID: string, fingerprint: string) => {
  const response = await OrchestraAdminClient.get("duplicated_credit_card_fingerprint", {
    params: { user_id: userID, fingerprint },
  });
  return response.data;
}