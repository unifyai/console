'use server';

import { getCurrentUser } from '@/lib/user/user';
import { getActiveOrganization } from '@/lib/user/workspace';

export async function requireUserApiKey(): Promise<string> {
  const user = await getCurrentUser();
  if (!user?.apiKey) {
    throw new Error('Unauthorized');
  }
  return user.apiKey;
}

export async function requireAdminKey(): Promise<string> {
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
  if (!adminKey) {
    throw new Error('Admin key not configured');
  }
  return adminKey;
}

export async function resolveSecretSession(): Promise<{
  apiKey: string;
  orgId: number | null;
  orgName: string | null;
}> {
  const user = await getCurrentUser();
  if (!user?.apiKey) {
    throw new Error('Unauthorized');
  }
  const activeOrganization = getActiveOrganization(user);
  return {
    apiKey: user.apiKey,
    orgId: activeOrganization?.id ?? null,
    orgName: activeOrganization?.name ?? null,
  };
}
