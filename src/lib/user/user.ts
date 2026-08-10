'use server';

import { getServerSession } from 'next-auth/next';
import { cache } from 'react';
import authOptions from '@/app/api/auth/[...nextauth]/options';
import { Session, User, UserUpdateRequest } from '@/types/user';
import { cookies, headers } from 'next/headers';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { populateApiKeyCache, invalidateApiKeyCache } from '@/app/api/_utils/api-key-cache';
import { isUnifyStaffMember } from '@/lib/auth/unify-staff';
import { resolveAuthMode } from '@/lib/environment/environment';
import { requireUserApiKey } from '@/lib/server-action-session';
import { mockSimulationEnabled } from '@/lib/simulation/config';
import { getActiveSimulation } from '@/lib/simulation/scenario-server';
import { buildMockSession, buildMockUser } from '@/lib/simulation/identity';
import { readActiveWorkspaceId } from '@/lib/user/workspace-session';

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
export const getServerSessionCached = cache(async () => getServerSession(authOptions));

export async function getSession() {
  if (mockSimulationEnabled()) {
    const { scenario, workspaceId } = await getActiveSimulation();
    return buildMockSession(scenario, workspaceId);
  }
  if (resolveAuthMode() === 'external') {
    const sessionResponse = await fetch(`${process.env.NEXTAUTH_URL}/sessionInfo.json`);
    const sessionInfo = snakeToCamelObject<Session>(await sessionResponse.json());
    return sessionInfo;
  } else {
    // Avoid caching here to ensure per-request cookies are respected.
    // Do not route through getServerSessionCached — explicit getSession()
    // callers need a live read; nested layouts dedupe via cache(getCurrentUser).
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
 * Fetches the user information when identity is injected externally
 * (`authMode === 'external'`, e.g. behind an enterprise SSO proxy). Reads a
 * user dict served by the deployment rather than resolving via Orchestra.
 *
 * @returns {Promise<User | null>} The user information as a
 * User object if available, otherwise null.
 */
export async function getExternalIdentityUser(): Promise<User | null> {
  const userResponse = await fetch(`${process.env.NEXTAUTH_URL}/userInfo.json`);
  const userInfo = snakeToCamelObject<User>(await userResponse.json());
  return userInfo;
}

/**
 * Retrieves the current user's information.
 *
 * For external-auth deployments (`authMode === 'external'`), fetches the user
 * from the externally-injected dict. Otherwise resolves the user by the
 * session email via Orchestra (managed auth — cloud and self-host).
 *
 * Wrapped in React `cache()` so nested layouts (Providers, home layout,
 * app-shell bootstrap, route gates) share one Orchestra round-trip per RSC
 * request instead of repeating `/admin/user/by-email` several times.
 *
 * @returns {Promise<User | null>} The user information as a
 * User object if available, otherwise null.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (mockSimulationEnabled()) {
    const { scenario, workspaceId } = await getActiveSimulation();
    return buildMockUser(scenario, workspaceId);
  }

  const session = await getSession();
  let user: User | null = null;

  // 1. Fetch User Identity
  if (resolveAuthMode() === 'external') {
    user = await getExternalIdentityUser();
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
  //
  // IMPORTANT: this check runs BEFORE cache population so that invalidated
  // sessions never seed the API key cache with stale credentials.
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
          if (session.user?.email) {
            invalidateApiKeyCache(session.user.email);
          }
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

  // Populate the in-memory API key cache AFTER session validation passes but
  // BEFORE workspace resolution mutates user.apiKey. This allows
  // getApiKeyFromRequest() in API routes to resolve the workspace-appropriate
  // key from cache without calling getCurrentUser() again (saving 1-3
  // Orchestra roundtrips per request).
  if (session?.user?.email) {
    populateApiKeyCache(
      session.user.email,
      user.apiKey,
      user.organizations,
      user.personalWorkspaceDisabled === true
    );
  }

  // 3. Apply Workspace Context
  const cookieStore = await cookies();
  // The switcher writes ``unify_workspace_id`` SameSite=Strict, so the browser
  // withholds it on cross-site entry points (an inbound Teams / Slack deep
  // link). The session token is Lax and carries the same selection, so fall back
  // to it rather than reading a withheld cookie as "personal" — that mis-scoped
  // Teams bot installs to the personal owner for anyone free to switch
  // workspaces. A session with no claim at all stays undefined and falls through
  // to the defaults below.
  const cookieWorkspaceId = cookieStore.get('unify_workspace_id')?.value;
  const workspaceId = cookieWorkspaceId ?? (await readActiveWorkspaceId());
  let contextResolved = false;

  // Priority 1: Header API Key
  let headerApiKey: string | null = null;
  try {
    const headerStore = await headers();
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
    if (workspaceId === 'personal' && !user.personalWorkspaceDisabled) {
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
    const isUnifyMember = isUnifyStaffMember(user.email, user.organizations);
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
});

/**
 * Returns the authenticated user's API key from the server session.
 */
export async function getUserApiKey(): Promise<string> {
  return requireUserApiKey();
}

/**
 * Sends a verification code to the user's phone number via SMS.
 * Calls the orchestra backend which handles code generation, storage,
 * and dispatching the SMS via the communication service.
 */
export async function sendPhoneVerification(
  userId: string,
  phoneNumber: string,
  phoneType: 'phone' | 'whatsapp' = 'phone'
): Promise<{ detail: string; expiresInSeconds?: number }> {
  try {
    const response = await OrchestraAdminClient.post('/user/phone/send-verification', {
      user_id: userId,
      phone_number: phoneNumber,
      phone_type: phoneType,
    });
    return (response as { data: { detail: string; expiresInSeconds?: number } }).data;
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { detail?: string } } };
    const detail = axiosErr?.response?.data?.detail || 'Failed to send verification code.';
    return { detail };
  }
}

/**
 * Confirms a phone verification code against the orchestra backend.
 * On success, the number is marked as verified so that a subsequent
 * profile update will be accepted.
 */
export async function confirmPhoneVerification(
  userId: string,
  phoneNumber: string,
  code: string,
  phoneType: 'phone' | 'whatsapp' = 'phone'
): Promise<{ detail: string; success: boolean }> {
  try {
    const response = await OrchestraAdminClient.post('/user/phone/confirm-verification', {
      user_id: userId,
      phone_number: phoneNumber,
      phone_type: phoneType,
      code,
    });
    return { ...(response as { data: { detail: string } }).data, success: true };
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: { detail?: string } } };
    const detail = axiosErr?.response?.data?.detail || 'Verification failed.';
    return { detail, success: false };
  }
}
