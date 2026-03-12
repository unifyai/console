'use server';

import { getServerSession } from 'next-auth/next';
import { cache } from 'react';
import authOptions from '@/app/api/auth/[...nextauth]/options';
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
  const response = (await OrchestraAdminClient.get('/user/by-user-id', {
    params: { user_id: userId },
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
    params: { user_id: userID },
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
      try {
        user = await getUserByEmail(session.user.email);
      } catch {
        // User doesn't exist in the DB (e.g. DB was reset) or Orchestra is
        // unreachable. Return null so the calling page redirects to /login
        // rather than showing an unhandled error page.
        console.warn('[getCurrentUser] Failed to fetch user by email — session may be stale');
        return null;
      }
    } else {
      console.error('No user email found in session');
      return null;
    }
  }

  if (!user) return null;

  // 2. Session Invalidation on Password Change
  // If the user signed in with email/password and changed their password after
  // this JWT was issued, reject the session so the stale JWT is cleared.
  // Skip this check for OAuth sessions — password changes don't affect them.
  const isCredentialsSession =
    session && 'provider' in session && session.provider === 'credentials';
  if (isCredentialsSession && 'iat' in session && typeof session.iat === 'number') {
    try {
      const credRes = await OrchestraAdminClient.get('/auth/email-credentials', {
        params: { userId: user.id },
      });
      const creds = credRes.data;
      if (creds?.hasEmailAccount && creds?.passwordChangedAt) {
        const changedAtMs = new Date(creds.passwordChangedAt).getTime();
        const issuedAtMs = session.iat * 1000; // JWT iat is in seconds
        if (issuedAtMs < changedAtMs) {
          console.warn(
            `[getCurrentUser] Session invalidated: JWT issued at ${new Date(issuedAtMs).toISOString()} ` +
              `but password changed at ${creds.passwordChangedAt}`
          );
          return null;
        }
      }
    } catch {
      // If the credentials check fails, don't block the user — log and continue.
      // This avoids locking out users if the email-credentials endpoint is down.
      console.warn(
        '[getCurrentUser] Failed to check password_changed_at, skipping session invalidation'
      );
    }
  }

  // 3. Apply Workspace Context
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

  // Priority 3: Lock non-Unify org members to their organization workspace.
  // Users who belong to a non-Unify organization are always placed in that
  // org workspace (the UI switcher is also disabled for them). This overrides
  // any cookie value. Unify org members retain free switching.
  // Skip if context was resolved via an explicit header API key (API calls).
  let effectiveWorkspaceId: string | undefined = workspaceId;
  if (!headerApiKey) {
    const isUnifyMember = user.organizations?.some((org) => org.name === 'Unify') ?? false;
    if (!isUnifyMember && user.organizations && user.organizations.length > 0) {
      user.apiKey = user.organizations[0].apiKey;
      effectiveWorkspaceId = user.organizations[0].id.toString();
      contextResolved = true;
    }
  }

  // 4. MFA Enforcement Check
  // If the active workspace is an org, check whether the org requires MFA
  // and the user hasn't set it up yet. Applies to all auth providers.
  if (effectiveWorkspaceId && effectiveWorkspaceId !== 'personal') {
    const activeOrg = user.organizations?.find((org) => org.id.toString() === effectiveWorkspaceId);
    if (activeOrg) {
      try {
        const enforcementRes = await OrchestraAdminClient.get('/auth/mfa/enforcement-status', {
          params: { userId: user.id, orgId: activeOrg.id },
        });
        const enforcement = enforcementRes.data;
        if (enforcement?.setupRequired) {
          user.mfaSetupRequired = {
            orgId: activeOrg.id,
            orgName: activeOrg.name,
          };
        }
      } catch {
        // Don't block the user if the enforcement check fails
        console.warn('[getCurrentUser] Failed to check MFA enforcement, skipping');
      }
    }
  }

  return user;
}

/**
 * Creates a server action that returns the user's API key.
 * This keeps the API key in a server-side closure so it's never embedded
 * in client-side props/HTML — the client must explicitly call the action
 * to retrieve it.
 */
export const getUserApiKey = async (apiKey: string) => {
  return async (): Promise<string> => {
    'use server';
    return apiKey;
  };
};

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
