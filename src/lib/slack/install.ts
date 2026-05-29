/**
 * Slack workspace install server actions.
 *
 * Slack installs are persisted in Orchestra's ``slack_installs``
 * table via the admin API (``/v0/admin/slack/install``) — the user-
 * facing token-bearer flow does not (and should not) cover this:
 * the install row carries the workspace bot token, which we never
 * want to surface to the browser.
 *
 * Console is the **gatekeeper** for these admin calls. Every action
 * here:
 *
 *   1. Resolves the current user via the session cookie.
 *   2. Verifies the user owns the target org (``org.ownerId ===
 *      user.id``). Owner-only matches the existing destructive
 *      org-admin surface (Delete Organization, MFA enforcement). The
 *      gate can be broadened later via an explicit
 *      ``organization.write`` permission check once we have a
 *      server-side org-perm helper.
 *   3. Forwards the call to Orchestra via ``OrchestraAdminClient``.
 *
 * Token never round-trips through Console after persist: reads pass
 * ``include_token=false`` so the response carries metadata only.
 */

import 'server-only';

import type { AxiosError } from 'axios';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { getCurrentUser } from '@/lib/user/user';
import type { ResponseProps } from '@/types/common';
import type { SlackInstall, SlackInstallOwner } from '@/types/slack/install';
import type { SlackInstallUpsertBody } from '@/lib/slack/exchange';

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
 * * Org installs — the user must own the target organization (matching
 *   the destructive org-admin surface: Delete Organization, MFA).
 * * Personal installs — the user must be that same user.
 *
 * Returns ``null`` on success or a ``ResponseProps`` (with a generic
 * detail) the caller should surface verbatim — we deliberately don't
 * leak the specific failure reason to the client.
 */
async function requireInstallOwner(owner: SlackInstallOwner): Promise<ResponseProps | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { detail: 'Not authenticated.', status: 401 };
  }
  if (owner.kind === 'user') {
    if (String(user.id) !== owner.userId) {
      return {
        detail: 'You can only manage the Slack workspace install for your own account.',
        status: 403,
      };
    }
    return null;
  }
  const org = user.organizations?.find((o) => o.id === owner.orgId);
  if (!org) {
    return { detail: 'Organization not found.', status: 404 };
  }
  if (org.ownerId !== user.id) {
    return {
      detail: 'You must be the organization owner to manage the Slack workspace install.',
      status: 403,
    };
  }
  return null;
}

/** Translate an owner descriptor into the admin GET query selector. */
function ownerQuery(owner: SlackInstallOwner): Record<string, string | number | boolean> {
  return owner.kind === 'org'
    ? { organizationId: owner.orgId, includeToken: false }
    : { userId: owner.userId, includeToken: false };
}

/**
 * Look up the org's Slack install row (without the bot token).
 * Returns ``null`` when no install exists — distinct from a transport
 * failure which yields a ``ResponseProps`` with ``detail``/``status``.
 */
export const getSlackInstallAction = async (_apiKey: string) => {
  return async (owner: SlackInstallOwner): Promise<SlackInstall | null | ResponseProps> => {
    'use server';
    const denied = await requireInstallOwner(owner);
    if (denied) return denied;
    try {
      const res = await OrchestraAdminClient.get('/slack/install', {
        params: ownerQuery(owner),
      });
      return res.data as SlackInstall;
    } catch (e) {
      const ax = e as AxiosError;
      if (ax?.response?.status === 404) return null;
      return errorResponse(e, 'Failed to load Slack install.');
    }
  };
};

/**
 * Internal upsert — called from the OAuth callback route after a
 * successful code exchange. Not exposed via a public ``/api`` route
 * because the body carries the bot token. Permission gate is by
 * **state-token verification** in the callback (the JWT proves the
 * user just completed an authorize-redirect we initiated on their
 * behalf with a verified ``orgId``); we re-confirm ownership here as
 * a defence-in-depth check.
 */
export async function persistSlackInstall(args: {
  body: SlackInstallUpsertBody;
}): Promise<SlackInstall | ResponseProps> {
  const { body } = args;
  const owner: SlackInstallOwner =
    body.organization_id != null
      ? { kind: 'org', orgId: body.organization_id }
      : { kind: 'user', userId: String(body.user_id) };
  const denied = await requireInstallOwner(owner);
  if (denied) return denied;
  try {
    const res = await OrchestraAdminClient.post('/slack/install', body);
    return res.data as SlackInstall;
  } catch (e) {
    return errorResponse(e, 'Failed to persist Slack install.');
  }
}

/**
 * Revoke an install (marks ``revoked_at``, drops thread routes,
 * unbinds channels). The bot token stays in the row for audit but
 * no further inbound or outbound is routed.
 */
export const revokeSlackInstallAction = async (_apiKey: string) => {
  return async (
    owner: SlackInstallOwner,
    installId: number
  ): Promise<{ revoked: true } | ResponseProps> => {
    'use server';
    const denied = await requireInstallOwner(owner);
    if (denied) return denied;
    try {
      await OrchestraAdminClient.delete(`/slack/install/${installId}`);
      return { revoked: true };
    } catch (e) {
      return errorResponse(e, 'Failed to revoke Slack install.');
    }
  };
};
