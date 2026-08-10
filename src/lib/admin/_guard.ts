/**
 * Defense-in-depth gate for admin server actions.
 *
 * Server actions in Next.js App Router are public RPC endpoints
 * addressable by an action-ID hash. The `/admin/layout.tsx` redirect
 * only protects *page rendering* — it does NOT prevent a non-admin
 * (or unauthenticated) caller from POSTing to a leaked action ID.
 *
 * Every admin server action MUST call this helper at the top of its
 * body. Returns ``null`` when the caller is a Unify-org Owner/Admin;
 * otherwise returns a ``ResponseProps`` error meant to be returned
 * verbatim by the action. The 403 / 401 statuses mirror orchestra's
 * ``auth_admin_key`` rejection so callers can branch identically on
 * either source.
 *
 * NOTE: this module is intentionally not marked ``'use server'``.
 * It's imported into ``'use server'`` files and runs server-side; not
 * registering it as a server action itself avoids creating yet another
 * public RPC endpoint and is slightly cheaper (no per-call action
 * dispatch).
 */

import { isUnifyStaff } from '@/lib/auth/unify-staff';
import { getCurrentUser } from '@/lib/user/user';
import type { ResponseProps } from '@/types/common';

export async function requireUnifyAdmin(): Promise<ResponseProps | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { detail: 'Unauthorized', status: 401 };
  }
  // Org names are user-choosable, so membership in an org named "Unify"
  // only counts for a verified unify.ai session email.
  const isUnifyAdmin =
    isUnifyStaff(user.email) &&
    user.organizations?.some(
      (o) => o.name === 'Unify' && ['owner', 'admin'].includes(o.roleName?.toLowerCase() ?? '')
    );
  if (!isUnifyAdmin) {
    return { detail: 'Forbidden', status: 403 };
  }
  return null;
}

/**
 * Membership-only sibling of {@link requireUnifyAdmin}. Returns ``null`` when
 * the caller belongs to the "Unify" organization (any role); otherwise returns
 * a ``ResponseProps`` error meant to be returned verbatim by the action.
 *
 * Used by the impersonation ("view as user") actions, which are available to
 * every Unify staff member rather than only Owner/Admin.
 */
export async function requireUnifyMember(): Promise<ResponseProps | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { detail: 'Unauthorized', status: 401 };
  }
  const isUnifyMember =
    isUnifyStaff(user.email) && (user.organizations?.some((o) => o.name === 'Unify') ?? false);
  if (!isUnifyMember) {
    return { detail: 'Forbidden', status: 403 };
  }
  return null;
}
