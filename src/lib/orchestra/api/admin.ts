/**
 * Admin-only Orchestra API calls
 *
 * This file consolidates all direct Orchestra calls that require admin authentication.
 * These endpoints are not in the public OpenAPI spec for security reasons.
 * Uses the admin Axios client.
 */
'use server';

import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';
import { User, UserUpdateRequest } from '@/types/user';

// =============================================================================
// User Admin Functions
// =============================================================================

/**
 * Retrieves a user by their ID.
 * @param userId The ID of the user.
 * @returns The user with the given ID.
 */
export async function getUserByID(userId: string) {
  const response = (await OrchestraAdminClient.get('/user/by-user-id', {
    params: { userId: userId },
  })) as { data: unknown };
  return snakeToCamelObject<User>(response.data as Record<string, unknown>);
}

/**
 * Retrieves a user by their email address.
 *
 * @param email - The email address of the user.
 * @returns The user associated with the given email address.
 */
export async function getUserByEmail(email: string) {
  const response = (await OrchestraAdminClient.get('/user/by-email', {
    params: { email },
  })) as { data: unknown };
  return snakeToCamelObject<User>(response.data as Record<string, unknown>);
}

/**
 * Updates a user's information.
 *
 * @param updatedUser The data to update. Only the fields provided will be updated.
 *
 * @returns {Promise<User>} The updated user information.
 */
export async function updateUser(updatedUser: UserUpdateRequest): Promise<User> {
  const apiPayload = camelToSnakeObject(updatedUser);
  const response = (await OrchestraAdminClient.put('/user', apiPayload)) as { data: unknown };
  return snakeToCamelObject<User>(response.data as Record<string, unknown>);
}

/**
 * Deletes a user's account.
 * @param userID The user's id.
 * @returns The response message.
 */
export async function deleteUser(userID: string) {
  const response = (await OrchestraAdminClient.delete('/user', {
    params: { userId: userID },
  })) as { data: string };
  return response.data;
}

// =============================================================================
// API Key Functions
// =============================================================================

/**
 * Regenerates the API key for a user or an organization.
 *
 * @param userID - The ID of the user whose API key will be regenerated.
 * @param organizationID - The ID of the organization (optional). If provided, resets org key.
 * @returns {Promise<string>} The new API key.
 */
export async function regenerateUserKey(userID: string, organizationID?: string) {
  const params: Record<string, string | number> = { userId: userID };
  if (organizationID) {
    params.organizationId = organizationID;
  }
  const response = await OrchestraAdminClient.post('/apiKey/reset', null, { params });
  const key = response.data;
  return key;
}

/**
 * Regenerates the API key for the current user in an on-premise setup.
 *
 * @returns {Promise<string | null>} The new API key or null if it could not be regenerated.
 */
export async function regenerateOnPremUserKey() {
  const userResponse = await fetch(`${process.env.NEXTAUTH_URL}/userInfo.json`);
  const userInfo = snakeToCamelObject<User>(await userResponse.json());
  return userInfo?.apiKey || null;
}
