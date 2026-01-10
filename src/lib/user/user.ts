'use server';

import { getServerSession } from 'next-auth/next';
import { cache } from 'react';
import authOptions from '@/app/api/auth/[...nextauth]/options';
import { Storage } from '@google-cloud/storage';
import { Session, User, UserUpdateRequest } from '@/types/user';
import { cookies, headers } from 'next/headers';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

// Note: getUserByID, getUserByEmail, updateUser, deleteUser are defined here
// but also available from '@/lib/orchestra/api/admin' for new code

/**
 * Retrieves a user by their ID.
 * @param userId The ID of the user.
 * @returns The user with the given ID.
 */
export async function getUserByID(userId: string) {
  const response = (await OrchestraAdminClient.get('/auth-user/by-user-id', {
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
  const response = (await OrchestraAdminClient.get('/auth-user/by-email', {
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
  const response = (await OrchestraAdminClient.put('/auth-user', apiPayload)) as { data: unknown };
  return snakeToCamelObject<User>(response.data as Record<string, unknown>);
}

/**
 * Deletes a user's account.
 * @param userID The user's id.
 * @returns The response message.
 */
export async function deleteUser(userID: string) {
  const response = (await OrchestraAdminClient.delete('/auth-user', {
    params: { userId: userID },
  })) as { data: string };
  return response.data;
}

/**
 * Retrieves the current user's session information.
 *
 * In on-prem setups, this returns the session information from a local
 * file. Otherwise, it returns the session information from NextAuth.
 *
 * @returns The session information as a Session object if available,
 * otherwise null.
 */
export const getServerSessionCached = cache(() => getServerSession(authOptions));

export async function getSession() {
  if (process.env.ON_PREM) {
    const sessionResponse = await fetch(`${process.env.NEXTAUTH_URL}/sessionInfo.json`);
    const sessionInfo = snakeToCamelObject<Session>(await sessionResponse.json());
    return sessionInfo;
  } else {
    // Avoid caching here to ensure per-request cookies (e.g., console_auth) are respected
    const session = await getServerSession(authOptions);
    return session;
  }
}

/**
 * Retrieves the email address of the current user from the session.
 *
 * @returns {Promise<string | null>} The email address of the current user if available, otherwise null.
 */
export async function getCurrentUserEmail() {
  const email = await getSession().then((session) => session?.user?.email);
  return email;
}

/**
 * Fetches the user information for an on-premise setup.
 *
 * @returns {Promise<User | null>} The user information as a
 * User object if available, otherwise null.
 */
export async function getOnPremUser(): Promise<User | null> {
  const userResponse = await fetch(`${process.env.NEXTAUTH_URL}/userInfo.json`);
  const userInfo = snakeToCamelObject<User>(await userResponse.json());
  return userInfo;
}

/**
 * Retrieves the current user's information.
 *
 * For on-premise setups, fetches the user information from a local file.
 * For other setups, retrieves the user information based on the user's email
 * from the session.
 *
 * @returns {Promise<User | null>} The user information as a
 * User object if available, otherwise null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  let user: User | null = null;

  // 1. Fetch User Identity
  if (process.env.ON_PREM) {
    user = await getOnPremUser();
  } else {
    if (session && session.user?.email) {
      user = await getUserByEmail(session.user.email);
    } else {
      console.error('No user email found in session');
      return null;
    }
  }

  if (!user) return null;

  // 2. Apply Workspace Context
  const cookieStore = cookies();
  const workspaceId = cookieStore.get('unify_workspace_id')?.value;
  let contextResolved = false;

  // Priority 1: Header API Key
  let headerApiKey: string | null = null;
  try {
    const headerStore = headers();
    headerApiKey = headerStore.get('apiKey');
  } catch (e) {
    // Ignore context errors
  }

  if (headerApiKey) {
    // Check if the header key matches the default personal key
    if (user.apiKey === headerApiKey) {
      contextResolved = true;
    }
    // Check if the header key matches any of the user's organizations
    else if (user.organizations) {
      const targetOrg = user.organizations.find((org) => org.apiKey === headerApiKey);
      if (targetOrg) {
        user.apiKey = targetOrg.apiKey;
        contextResolved = true;
      }
    }
  }

  // Priority 2: Cookie (if not resolved by header)
  if (!contextResolved && workspaceId) {
    if (workspaceId === 'personal') {
      // Explicitly personal. user.apiKey is already personal default.
      contextResolved = true;
    } else {
      // Check if user still belongs to this org
      const targetOrg = user.organizations?.find((org) => org.id.toString() === workspaceId);

      if (targetOrg) {
        user.apiKey = targetOrg.apiKey;
        contextResolved = true;
      }
      // If targetOrg not found (e.g. user removed from org), contextResolved remains false
      // and we fall through to default logic below.
    }
  }

  return user;
}

/**
 * Updates a user's profile image.
 *
 * @param id The ID of the user to update.
 * @param image The new profile image as a File object.
 *
 * @returns {Promise<void>} The promise resolves when the image has been uploaded.
 */
export async function updateUserImage(userID: string, image: File) {
  const fileName = `${process.env.BUCKET_FOLDER}/${userID}.${image.name.split('.').at(-1)}`;

  const buffer = await image.arrayBuffer();
  const storage = new Storage();
  await storage.bucket('console-app-profile-images').file(fileName).save(Buffer.from(buffer));
}

/**
 * Sends a verification code to the user's phone number via SMS.
 * Uses admin authentication to call the communication service.
 *
 * @param phoneNumber The phone number to verify (international format, e.g., +15551234567)
 * @returns The verification code and sent timestamp, or an error response.
 */
export async function verifyUserPhone(
  phoneNumber: string
): Promise<{ verificationCode: string; sentAt: string } | { detail: string }> {
  const COMMUNICATION_URL = process.env.COMMUNICATION_URL;
  const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

  if (!COMMUNICATION_URL || !ADMIN_KEY) {
    console.error(
      '[verifyUserPhone] Missing COMMUNICATION_URL or ORCHESTRA_ADMIN_KEY environment variable'
    );
    return { detail: 'Server configuration error' };
  }

  try {
    const response = await fetch(`${COMMUNICATION_URL}/social/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform: 'phone',
        accountIdentifier: phoneNumber,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(`[verifyUserPhone] Backend error (${response.status}):`, data);
      return { detail: data?.detail || `Failed to send verification code: ${response.statusText}` };
    }

    if (data?.verificationCode && data?.sentAt) {
      return { verificationCode: data.verificationCode, sentAt: data.sentAt };
    }

    return { detail: 'Verification succeeded but response format was unexpected.' };
  } catch (error) {
    console.error('[verifyUserPhone] Fetch error:', error);
    return {
      detail: error instanceof Error ? error.message : 'Unknown error during phone verification.',
    };
  }
}
