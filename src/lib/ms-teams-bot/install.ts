import 'server-only';

/**
 * MS Teams **bot** install bind-handshake server actions.
 *
 * A Teams Store install lands in Orchestra's ``ms_teams_bot_installs``
 * table as a **pending** row (no owner) carrying a one-time
 * ``bind_nonce``. Someone signed into Console claims it by binding the
 * pending install to their Unify **organization** — that is the whole
 * job of this module.
 *
 * These are admin-API calls (``/v0/admin/ms-teams-bot/...``) that carry
 * the ``ORCHESTRA_ADMIN_KEY``, so — exactly like the Slack install path
 * — Console is the **gatekeeper**. Every action here:
 *
 *   1. Resolves the current user via the session cookie.
 *   2. Verifies the user is an owner/admin of the target organization.
 *   3. Forwards the call to Orchestra via ``OrchestraAdminClient``.
 *
 * The bind is org-scoped: Orchestra's ``/bind`` endpoint takes exactly
 * one of ``organization_id`` / ``user_id`` and we always pass the org.
 */

import type { AxiosError } from 'axios';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { getCurrentUser } from '@/lib/user/user';
import type { ResponseProps } from '@/types/common';
import type { MsTeamsBotInstall } from '@/types/ms-teams-bot/install';
import type { UserOrganization } from '@/types/user';

/**
 * Org roles allowed to bind (claim) a pending MS Teams bot install to
 * the organization. Matches the Owner/Admin gate the Slack workspace
 * install uses — the install is org-config, so admins manage it
 * alongside owners.
 */
const ORG_MANAGER_ROLES = new Set(['Owner', 'Admin']);

/** Whether ``org`` lets the current user bind its MS Teams bot install. */
export function canManageOrgMsTeamsBotInstall(org: UserOrganization | undefined | null): boolean {
  return !!org && ORG_MANAGER_ROLES.has(org.roleName);
}

function errorResponse(error: unknown, fallback: string): ResponseProps {
  const ax = error as AxiosError<{ detail?: string }> | undefined;
  if (ax && typeof ax === 'object' && 'isAxiosError' in ax && ax.isAxiosError) {
    return {
      detail: ax.response?.data?.detail ?? ax.message ?? fallback,
      status: ax.response?.status ?? 500,
    };
  }
  const message = error instanceof Error ? error.message : fallback;
  return { detail: message, status: 500 };
}

/**
 * Confirm the session user may manage the install for ``orgId``.
 *
 * Returns ``null`` on success or a ``ResponseProps`` (with a generic
 * detail) the caller should surface — we deliberately don't leak the
 * specific failure reason to the client.
 */
async function requireOrgManager(orgId: number): Promise<ResponseProps | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { detail: 'Not authenticated.', status: 401 };
  }
  const org = user.organizations?.find((o) => o.id === orgId);
  if (!org) {
    return { detail: 'Organization not found.', status: 404 };
  }
  if (!canManageOrgMsTeamsBotInstall(org)) {
    return {
      detail: 'You must be an organization owner or admin to manage the Teams bot install.',
      status: 403,
    };
  }
  return null;
}

/**
 * Look up the org's current MS Teams bot install (bound, pending, or
 * revoked). Returns ``null`` when the org has no install — distinct from
 * a transport failure which yields a ``ResponseProps``.
 */
export async function getOrgInstallStatusAction(
  orgId: number
): Promise<MsTeamsBotInstall | null | ResponseProps> {
  'use server';
  const denied = await requireOrgManager(orgId);
  if (denied) return denied;
  try {
    const res = await OrchestraAdminClient.get('/ms-teams-bot/install', {
      params: { organizationId: orgId },
    });
    return res.data as MsTeamsBotInstall;
  } catch (e) {
    const ax = e as AxiosError;
    if (ax?.response?.status === 404) return null;
    return errorResponse(e, 'Failed to load Teams bot install.');
  }
}

/**
 * Bind a pending install to the org via its handshake nonce.
 *
 * Resolves the ``bindNonce`` to a pending install id (admin GET), then
 * binds that install to ``orgId`` (admin POST ``/bind``). A blank nonce
 * or one that resolves to no install yields a validation ``ResponseProps``
 * the hook surfaces as a generic toast.
 */
export async function bindInstallAction(
  orgId: number,
  nonce: string
): Promise<MsTeamsBotInstall | ResponseProps> {
  'use server';
  const denied = await requireOrgManager(orgId);
  if (denied) return denied;

  const trimmed = nonce.trim();
  if (!trimmed) {
    return {
      detail: 'Enter the install code you were shown after adding the Teams app.',
      status: 400,
    };
  }

  let installId: number;
  try {
    const res = await OrchestraAdminClient.get('/ms-teams-bot/install', {
      params: { bindNonce: trimmed, includeNonce: false },
    });
    installId = (res.data as MsTeamsBotInstall).id;
  } catch (e) {
    const ax = e as AxiosError;
    if (ax?.response?.status === 404) {
      return {
        detail: 'That install code was not recognized. Check the code and try again.',
        status: 404,
      };
    }
    return errorResponse(e, 'Failed to resolve the Teams bot install code.');
  }

  try {
    const res = await OrchestraAdminClient.post('/ms-teams-bot/bind', {
      installId,
      organizationId: orgId,
    });
    return res.data as MsTeamsBotInstall;
  } catch (e) {
    return errorResponse(e, 'Failed to bind the Teams bot install.');
  }
}
