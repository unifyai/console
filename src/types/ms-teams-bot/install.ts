/**
 * Types for the Microsoft Teams **bot** install bind handshake.
 *
 * The Teams bot app (an Azure Bot Framework registration) installs
 * org-wide into a customer's Microsoft 365 tenant from the Teams Store.
 * That install arrives at Orchestra *before* we know which Unify owner
 * it belongs to, so it lands as a **pending** row (no owner) carrying a
 * one-time ``bindNonce``. A signed-in Unify org admin claims it by
 * entering that nonce, which binds the pending install to their
 * organization.
 *
 * This is intentionally distinct from the BYOD delegated-Graph "Teams"
 * integration (per-assistant workspace OAuth): the bot is a single
 * shared Azure registration installed once per Microsoft tenant, and
 * every assistant in the bound owner scope becomes reachable through it.
 *
 * The bind + status calls go through Orchestra's admin API
 * (``/v0/admin/ms-teams-bot/...``) via ``OrchestraAdminClient``, which
 * auto-converts the snake_case wire format to the camelCase shape below.
 */

import type { ResponseProps } from '@/types/common';

/**
 * An MS Teams bot install row, as returned by Orchestra's
 * ``GET /v0/admin/ms-teams-bot/install`` (with ``includeNonce=false``).
 *
 * Mirrors the camelCase shape Console code sees after
 * ``OrchestraAdminClient`` converts the snake_case wire body. A pending
 * install has ``pending=true`` and both ``organizationId`` / ``userId``
 * null; a bound org install has ``pending=false`` and a set
 * ``organizationId``.
 */
export interface MsTeamsBotInstall {
  id: number;
  organizationId: number | null;
  userId: string | null;
  tenantId: string;
  tenantName: string | null;
  botAppId: string;
  serviceUrl: string | null;
  pending: boolean;
  revoked: boolean;
  /** Only populated when the caller passed ``includeNonce=true``; the
   *  status/bind reads here never request it, so it is normally null. */
  bindNonce: string | null;
}

/**
 * Server-action bundle for MS Teams bot install management. The page
 * server component builds it once (secret-bearing — it uses the
 * ``ORCHESTRA_ADMIN_KEY``) and hands it down to the client tree. The org
 * id is supplied at call time so a single bundle serves whichever org
 * the active workspace resolves to.
 */
export interface MsTeamsBotInstallActions {
  /** The org's current install (``null`` if none exists). */
  getInstall: (orgId: number) => Promise<MsTeamsBotInstall | null | ResponseProps>;
  /** Resolve a pending install by its ``bindNonce`` and bind it to the
   *  org. Returns the freshly-bound install. */
  bindInstall: (orgId: number, nonce: string) => Promise<MsTeamsBotInstall | ResponseProps>;
}

/** Narrow a settled action result to a concrete install row. */
export function isMsTeamsBotInstall(
  value: MsTeamsBotInstall | null | ResponseProps
): value is MsTeamsBotInstall {
  return !!value && typeof value === 'object' && 'tenantId' in value && !('detail' in value);
}
