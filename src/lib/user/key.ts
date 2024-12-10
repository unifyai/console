import {OrchestraAdminClient} from "../orchestra/orchestra-client";
import { getCurrentUser } from "./user";
import { User } from "@/types/user";


/**
 * Regenerates the API key for a user.
 * 
 * @param id - The ID of the user whose API key will be regenerated.
 * @returns {Promise<any>} The new API key.
 */
export async function regenerateUserKey(userID: string) {
  let response = await OrchestraAdminClient.post("/api_key/reset", null, { params: { user_id: userID } });
  const key = response.data;
  return key;
};

/**
 * Regenerates the API key for the current user in an on-premise setup.
 *
 * @returns {Promise<string | null>} The new API key or null if it could not be
 * regenerated.
 */
export async function regenerateOnPremUserKey() {
  const userResponse = await fetch(`${process.env.NEXTAUTH_URL}/userInfo.json`);
  const userInfo = (await userResponse.json()) as User;
  return userInfo?.apiKey || null;
};