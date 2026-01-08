import { OrchestraAdminClient } from '../orchestra/orchestra-client';
import { getCurrentUser } from './user';
import { User } from '@/types/user';
import { snakeToCamelObject } from '@/utils/casing';

/**
 * Regenerates the API key for a user or an organization.
 *
 * @param userID - The ID of the user whose API key will be regenerated.
 * @param organizationID - The ID of the organization (optional). If provided, resets org key.
 * @returns {Promise<any>} The new API key.
 */
export async function regenerateUserKey(userID: string, organizationID?: string) {
  const params: Record<string, string | number> = { userId: userID };
  if (organizationID) {
    params.organizationId = organizationID;
  }
  let response = await OrchestraAdminClient.post('/apiKey/reset', null, { params });
  const key = response.data;
  return key;
}

/**
 * Regenerates the API key for the current user in an on-premise setup.
 *
 * @returns {Promise<string | null>} The new API key or null if it could not be
 * regenerated.
 */
export async function regenerateOnPremUserKey() {
  const userResponse = await fetch(`${process.env.NEXTAUTH_URL}/userInfo.json`);
  const userInfo = snakeToCamelObject<User>(await userResponse.json());
  return userInfo?.apiKey || null;
}
