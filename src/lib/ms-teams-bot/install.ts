import 'server-only';

/**
 * MS Teams **bot** install bind-handshake server actions.
 *
 * A Teams Store install lands in Orchestra's ``ms_teams_bot_installs``
 * table as a **pending** row (no owner) carrying a one-time
 * ``bind_nonce``. Someone signed into Console claims it by binding the
 * pending install to their Unify **owner scope** — an organization or
 * their personal account — that is the whole job of this module.
 *
 * These are admin-API calls (``/v0/admin/ms-teams-bot/...``) that carry
 * the ``ORCHESTRA_ADMIN_KEY``, so — exactly like the Slack install path
 * — Console is the **gatekeeper**. Every action here:
 *
 *   1. Resolves the current user via the session cookie.
 *   2. Verifies the user may manage the target owner scope (org
 *      owner/admin, or the personal-account owner themselves).
 *   3. Forwards the call to Orchestra via ``OrchestraAdminClient``.
 *
 * The bind is owner-scoped: Orchestra's ``/bind`` endpoint takes exactly
 * one of ``organization_id`` / ``user_id`` and we pass whichever the
 * owner descriptor carries.
 */

import type { AxiosError } from 'axios';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { getCurrentUser } from '@/lib/user/user';
import type { ResponseProps } from '@/types/common';
import type { MsTeamsBotInstall, MsTeamsBotInstallOwner } from '@/types/ms-teams-bot/install';
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
 * Confirm the session user may manage the install for ``owner``.
 *
 * * Org installs — the user must be an owner or admin of the target
 *   organization.
 * * Personal installs — the user must be that same user.
 *
 * Returns ``null`` on success or a ``ResponseProps`` (with a generic
 * detail) the caller should surface — we deliberately don't leak the
 * specific failure reason to the client.
 */
async function requireInstallOwner(owner: MsTeamsBotInstallOwner): Promise<ResponseProps | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { detail: 'Not authenticated.', status: 401 };
  }
  if (owner.kind === 'user') {
    if (String(user.id) !== owner.userId) {
      return {
        detail: 'You can only manage the Teams bot install for your own account.',
        status: 403,
      };
    }
    return null;
  }
  const org = user.organizations?.find((o) => o.id === owner.orgId);
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

/** Translate an owner descriptor into the admin GET query selector. */
function ownerQuery(owner: MsTeamsBotInstallOwner): Record<string, string | number | boolean> {
  return owner.kind === 'org' ? { organizationId: owner.orgId } : { userId: owner.userId };
}

/** Translate an owner descriptor into the ``/bind`` request body selector. */
function ownerBindSelector(owner: MsTeamsBotInstallOwner): Record<string, string | number> {
  return owner.kind === 'org' ? { organizationId: owner.orgId } : { userId: owner.userId };
}

/**
 * Look up the owner's current MS Teams bot install (bound, pending, or
 * revoked). Returns ``null`` when the owner has no install — distinct
 * from a transport failure which yields a ``ResponseProps``.
 */
export async function getInstallStatusAction(
  owner: MsTeamsBotInstallOwner
): Promise<MsTeamsBotInstall | null | ResponseProps> {
  'use server';
  const denied = await requireInstallOwner(owner);
  if (denied) return denied;
  try {
    const res = await OrchestraAdminClient.get('/ms-teams-bot/install', {
      params: ownerQuery(owner),
    });
    return res.data as MsTeamsBotInstall;
  } catch (e) {
    const ax = e as AxiosError;
    if (ax?.response?.status === 404) return null;
    return errorResponse(e, 'Failed to load Teams bot install.');
  }
}

/**
 * Bind a pending install to the owner via its handshake nonce.
 *
 * Resolves the ``bindNonce`` to a pending install id (admin GET), then
 * binds that install to ``owner`` (admin POST ``/bind``). A blank nonce
 * or one that resolves to no install yields a validation ``ResponseProps``
 * the hook surfaces as a generic toast.
 */
export async function bindInstallAction(
  owner: MsTeamsBotInstallOwner,
  nonce: string
): Promise<MsTeamsBotInstall | ResponseProps> {
  'use server';
  const denied = await requireInstallOwner(owner);
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
      ...ownerBindSelector(owner),
    });
    return res.data as MsTeamsBotInstall;
  } catch (e) {
    return errorResponse(e, 'Failed to bind the Teams bot install.');
  }
}

/**
 * Revoke an install (marks ``revoked_at``, drops channel bindings and
 * conversation routes). This stops all inbound routing to every assistant
 * in the owner scope, but — unlike the app removal a tenant admin performs
 * inside Teams — it cannot uninstall the app from the customer's Microsoft
 * tenant, because Console holds no per-tenant Microsoft token.
 */
export async function revokeInstallAction(
  owner: MsTeamsBotInstallOwner,
  installId: number
): Promise<{ revoked: true } | ResponseProps> {
  'use server';
  const denied = await requireInstallOwner(owner);
  if (denied) return denied;
  try {
    await OrchestraAdminClient.delete(`/ms-teams-bot/install/${installId}`);
    return { revoked: true };
  } catch (e) {
    return errorResponse(e, 'Failed to revoke the Teams bot install.');
  }
}
