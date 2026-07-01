'use server';

/**
 * Staging-only "Reset account" action for Unify staff.
 *
 * Rewinds the caller's own personal workspace back to its fresh-signup state:
 * hired assistants are removed, the Coordinator (T-W1N) is torn down and
 * re-provisioned, contact details beyond the email are cleared, and onboarding
 * is rewound. Organization memberships, org-scoped Coordinators, and billing
 * are left untouched.
 *
 * Gated by both `requireUnifyMember()` (defense-in-depth — server actions are
 * public RPC endpoints) and the `accountReset` capability (staging-only, owned
 * by Orchestra), so it can never fire in production. The heavy lifting lives
 * behind Orchestra's admin `POST /user/{id}/reset`.
 */

import { getCurrentUser } from '@/lib/user/user';
import { requireUnifyMember } from '@/lib/admin/_guard';
import { getServerFeatures } from '@/lib/features/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import type { ResponseProps } from '@/types/common';

export async function resetAccount(): Promise<ResponseProps | null> {
  const denied = await requireUnifyMember();
  if (denied) return denied;

  const { accountReset } = await getServerFeatures();
  if (!accountReset) {
    return { detail: 'Forbidden', status: 403 };
  }

  const user = await getCurrentUser();
  if (!user?.id) {
    return { detail: 'Unauthorized', status: 401 };
  }

  try {
    await OrchestraAdminClient.post(`/user/${user.id}/reset`);
    console.warn(`[account-reset] reset personal workspace for ${user.email} (${user.id})`);
    return null;
  } catch (error) {
    console.error('[account-reset] reset failed', error);
    return { detail: 'Could not reset account. Please try again.', status: 500 };
  }
}
