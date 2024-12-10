"use server";

import {OrchestraAdminClient} from "@/lib/orchestra/orchestra-client";


/**
 * Retrieves free recharges for the current user.
 * @param userID - The user ID.
 * @returns An array of free recharges.
 */
export const getFreeRecharges = async (userID: string) => {
  try {
    const response = await OrchestraAdminClient.get("/free-credits/recharges", {
      params: { user_id: userID },
    });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch free recharges:", error);
    throw new Error("Failed to fetch free recharges.");
  }
};

/**
 * Retrieves stored card fingerprints for the current user.
 * @param userID - The user ID.
 * @returns An array of stored card fingerprints.
 */
export const getStoredCards = async (userID: string) => {
  try {
    const response = await OrchestraAdminClient.get("/free-credits/stored-cards", {
      params: { user_id: userID },
    });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch stored cards:", error);
    throw new Error("Failed to fetch stored cards.");
  }
};

/**
 * Checks if a card fingerprint is duplicated across users.
 * @param userID - The user ID.
 * @param fingerprint - The card fingerprint.
 * @returns Boolean indicating whether the card is a duplicate.
 */
export const isDuplicateCard = async (userID: string, fingerprint: string): Promise<boolean> => {
  try {
    const response = await OrchestraAdminClient.post(
      "/free-credits/is-duplicate-card",
      null,
      {
        params: { user_id: userID, fingerprint },
      }
    );
    return response.data?.isDuplicate || false;
  } catch (error) {
    console.error("Failed to check for duplicate card:", error);
    throw new Error("Failed to check for duplicate card.");
  }
};

/**
 * Adds free credits to the user's account.
 * @param userID - The user ID.
 * @param amount - The amount of free credits to add.
 */
export const addFreeCredits = async (userID: string, amount: number) => {
  try {
    await OrchestraAdminClient.post("/free-credits/add", null, {
      params: { user_id: userID, amount },
    });
  } catch (error) {
    console.error("Failed to add free credits:", error);
    throw new Error("Failed to add free credits.");
  }
};

/**
 * Stores a new card fingerprint for the user.
 * @param userID - The user ID.
 * @param fingerprint - The card fingerprint.
 */
export const storeNewCard = async (userID: string, fingerprint: string) => {
  try {
    await OrchestraAdminClient.post("/free-credits/store-card", null, {
      params: { user_id: userID, fingerprint },
    });
  } catch (error) {
    console.error("Failed to store new card:", error);
    throw new Error("Failed to store new card.");
  }
};

/**
 * Retrieves the user's card fingerprints from Stripe.
 * @param customerID - The Stripe customer ID.
 * @returns An array of card fingerprints.
 */
export const getUserCards = async (customerID: string): Promise<string[]> => {
  try {
    const response = await OrchestraAdminClient.get("/stripe/customer-cards", {
      params: { customer_id: customerID },
    });
    return response.data?.cardFingerprints || [];
  } catch (error) {
    console.error("Failed to fetch user cards:", error);
    throw new Error("Failed to fetch user cards.");
  }
};