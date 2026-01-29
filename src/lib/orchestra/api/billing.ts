/**
 * Billing-related Orchestra API calls
 *
 * This file consolidates all direct Orchestra calls for billing, credits, and recharges.
 * Uses the admin Axios client because these endpoints are not in the public OpenAPI spec.
 */
'use server';

import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { snakeToCamelObject } from '@/utils/casing';

// =============================================================================
// Types
// =============================================================================

export interface BillingDetails {
  id: string;
  credits: number;
  stripeCustomerId: string;
  autorecharge: boolean;
  autorechargeThreshold: number;
  autorechargeQty: number;
  storePrompts: boolean;
}

export interface RechargeModelRequest {
  userId: string;
  quantity: number;
  type: string;
  transactionId: string;
}

export interface BillingEligibility {
  userId: string;
  totalSpending: number;
  canEnableMonthlyBilling: boolean;
  minimumSpendRequired: number;
  remainingSpendNeeded: number;
}

// =============================================================================
// Billing Functions
// =============================================================================

/**
 * Retrieves billing details for a given user.
 * @param userID The ID of the user to retrieve billing details for.
 * @returns An array of billing details objects.
 */
export async function getUserBillingDetails(userID: string) {
  const response = await OrchestraAdminClient.get('/get_user', {
    params: { id: userID },
  });

  const billingDetails = snakeToCamelObject<BillingDetails[]>(response.data);
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
  const response = await OrchestraAdminClient.put('/enable_autorecharge', null, {
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
export async function setAutoRechargeThreshold(userID: string, threshold: number) {
  const response = await OrchestraAdminClient.put('/autorecharge_threshold', null, {
    params: { id: userID, threshold },
  });
  return response.data;
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
  const response = await OrchestraAdminClient.put('/autorecharge_qty', null, {
    params: { id: userID, qty: amount },
  });
  return response.data;
}

/**
 * Creates a new recharge record for a user.
 *
 * @param userID - The ID of the user.
 * @param credits - The amount of credits to add.
 * @param type - The type of recharge (e.g. "payment", "free", etc.).
 * @param transactionID - The transaction ID associated with the recharge.
 * @throws Will throw an error if the recharge amount is invalid or if the API call fails.
 * @returns The response from the API call.
 */
export async function createRecharge(
  userID: string,
  credits: number,
  type: string,
  transactionID: string
) {
  if (credits <= 0) {
    throw new Error('Invalid recharge amount');
  }

  const rechargeData = {
    userId: userID,
    quantity: credits,
    type: type,
    transactionId: transactionID,
  };

  const response = await OrchestraAdminClient.post('/create_recharge', rechargeData);
  return response;
}

/**
 * Retrieves the user's card fingerprints from Stripe.
 * @param userID - The user ID.
 * @returns An array of card fingerprints.
 */
export const getUserCards = async (userID: string) => {
  const response = await OrchestraAdminClient.get('credit_card_fingerprint', {
    params: { userId: userID },
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
  const response = await OrchestraAdminClient.post('credit_card_fingerprint', null, {
    params: { userId: userID, fingerprint },
  });
  return response.data;
};

/**
 * Checks if a card fingerprint is a duplicate in Orchestra
 * @param userID - The ID of the user to check.
 * @param fingerprint - The card fingerprint to check.
 * @returns A boolean indicating whether the card fingerprint is a duplicate.
 */
export const isDuplicateCard = async (userID: string, fingerprint: string) => {
  const response = await OrchestraAdminClient.get('duplicated_credit_card_fingerprint', {
    params: { userId: userID, fingerprint },
  });
  return response.data;
};

/**
 * Retrieves recharges for a user based on specified parameters.
 *
 * @param userID - The ID of the user to retrieve recharges for.
 * @param id - Optional ID of the recharge.
 * @param at - Optional date of the recharge (ISO date string).
 * @param quantity - Optional quantity of the recharge.
 * @param type - Optional type of the recharge.
 * @returns An array of recharge objects.
 */
export async function getRecharges(
  userID: string,
  id?: number,
  at?: string,
  quantity?: number,
  type?: string
) {
  const params = new URLSearchParams({ userId: userID });

  if (id !== undefined) params.append('id', id.toString());
  if (at !== undefined) params.append('at', at);
  if (quantity !== undefined) params.append('quantity', quantity.toString());
  if (type !== undefined) params.append('type', type);

  const response = await OrchestraAdminClient.get('/get_recharge', { params });
  return response.data as unknown[];
}

/**
 * Checks if a user is eligible for monthly billing based on spending.
 * @param userID - The ID of the user to check eligibility for.
 * @returns Billing eligibility information including spending details.
 */
export async function getUserBillingEligibility(userID: string): Promise<BillingEligibility> {
  const response = await OrchestraAdminClient.get('/user_billing_eligibility', {
    params: { userId: userID },
  });
  return snakeToCamelObject<BillingEligibility>(response.data);
}
