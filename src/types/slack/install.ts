/**
 * Types for the Slack workspace install flow.
 *
 * Slack installs are **owner-scoped** — one active install per Slack
 * workspace, owned by exactly one of an organization or a personal
 * user (``organization_id`` XOR ``user_id``) — and persisted in
 * Orchestra (``slack_installs`` table). Console owns the OAuth dance
 * and the management UI; the actual install row is written via the
 * Orchestra admin API after Console exchanges the Slack OAuth code for
 * a bot token.
 *
 * The install is **shared across every assistant in the same owner
 * scope**: once any assistant in an org (or a user's personal
 * workspace) connects Slack, the rest are reachable without a second
 * OAuth. Assistants are addressed in-workspace via ``@app <token>``
 * where ``<token>`` is the assistant's agent id, first name, or full
 * name.
 *
 * The bot token itself never leaves Orchestra after persist. Console
 * reads the install row for status/list views via the admin GET, but
 * passes ``include_token=false`` (never `true`) so the token does not
 * transit through the browser.
 */

import type { ResponseProps } from '@/types/common';

/**
 * Discriminated owner of a Slack install. An install belongs to either
 * an organization or a single personal user — never both — mirroring
 * Orchestra's ``ck_slack_install_one_owner`` constraint.
 */
export type SlackInstallOwner = { kind: 'org'; orgId: number } | { kind: 'user'; userId: string };

/**
 * Per-workspace Slack install row, as returned by Orchestra's
 * ``GET /v0/admin/slack/install`` (with ``include_token=false``).
 *
 * Mirrors the camelCase shape Console code expects after the
 * `OrchestraAdminClient` auto-converts the snake_case wire format.
 * Exactly one of ``organizationId`` / ``userId`` is set.
 */
export interface SlackInstall {
  id: number;
  organizationId: number | null;
  userId: string | null;
  slackTeamId: string;
  slackTeamName: string | null;
  slackAppId: string;
  enterpriseId: string | null;
  botUserId: string;
  installerUserId: string | null;
  scopes: string | null;
  revoked: boolean;
}

/**
 * Response from Console's ``POST /api/slack/oauth/start`` route.
 *
 * The browser navigates to ``authorizeUrl``; Slack handles the
 * approve-app screen and redirects back to
 * ``/oauth/slack/callback?code=...&state=...``.
 */
export interface SlackOAuthStartResponse {
  authorizeUrl: string;
}

/**
 * Server-action bundle for Slack workspace management. The page server
 * component builds it once and hands it down to the client tree; the
 * owner descriptor is supplied at call time so a single bundle serves
 * both org and personal contexts.
 */
export interface SlackInstallActions {
  /** Look up the owner's current install (returns null if none). */
  getInstall: (owner: SlackInstallOwner) => Promise<SlackInstall | null | ResponseProps>;
  /** Revoke + drop routing state for the given install id. */
  revokeInstall: (
    owner: SlackInstallOwner,
    installId: number
  ) => Promise<{ revoked: true } | ResponseProps>;
}

export function isSlackInstall(value: SlackInstall | null | ResponseProps): value is SlackInstall {
  return !!value && typeof value === 'object' && 'slackTeamId' in value && !('detail' in value);
}
