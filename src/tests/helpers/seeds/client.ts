/**
 * Database & API client primitives for seed scenarios.
 *
 * Provides typed, composable functions for creating test data in a running
 * local Orchestra database and Console API. Follows the same patterns as
 * {@link src/tests/auth/fixtures.ts} (dbExec, apiFetch).
 *
 * Prerequisites:
 *   - Local Orchestra + PostgreSQL running (via scripts/local.sh)
 *   - Docker available (for psql via docker exec)
 */

import { execSync } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import path from 'path';
import type {
  OrgRole,
  SeededUser,
  SeededOrg,
  SeededAssistant,
  SeededSecret,
  SeededTeam,
  SeededUserDesktop,
  SeededMsTeamsBotInstall,
} from './types';
import {
  approvedCharacterVoiceMetadata,
  coordinatorDefaultVoiceId,
} from '../../../constants/assistants/approved_character_voices';
import {
  COORDINATOR_DEFAULT_ABOUT,
  COORDINATOR_DEFAULT_JOB_TITLE,
} from '../../../constants/assistants/coordinator_profile';

// =============================================================================
// Configuration
// =============================================================================

const DB_CONTAINER = process.env.ORCHESTRA_DB_CONTAINER || 'orchestra-local-db';
const CONSOLE_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const ASSISTANT_CONTACT_ID = 42;
const OWNER_CONTACT_ID = 43;

/**
 * Default starting credit balance for seeded billing accounts.
 *
 * Falls back to 10000 but can be overridden by `SEED_CREDITS` (set by
 * `scripts/local.sh --credits N`) so local testers can spin up users with a
 * specific balance — e.g. `--credits 0` to exercise the out-of-credits /
 * subscribe flows. Scenarios that pass an explicit `credits` value still win;
 * this only changes the default used when a caller doesn't specify one.
 */
function defaultSeedCredits(): number {
  const raw = process.env.SEED_CREDITS;
  if (raw == null || raw.trim() === '') return 10000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 10000;
}

/**
 * Whether `SEED_CREDITS` was explicitly provided (via `--credits`).
 *
 * When set, the user creation primitives also *force* the balance on an
 * already-seeded account — their insert blocks are idempotent and skip
 * existing users, so without this a re-run of `local.sh --credits N` on a
 * non-wiped DB would silently keep the old balance.
 */
function seedCreditsOverrideActive(): boolean {
  const raw = process.env.SEED_CREDITS;
  return raw != null && raw.trim() !== '';
}

// Personal Coordinator contact rows mirror Orchestra's
// `contact_membership_service`: every Coordinator's `self` is contact_id=0
// and its `boss` (= the owning user) is contact_id=1. Keeping these in
// sync with `PERSONAL_SELF_CONTACT_ID` / `PERSONAL_BOSS_CONTACT_ID` lets
// seeded Coordinators round-trip through the runtime exactly like
// production-provisioned ones.
const COORDINATOR_SELF_CONTACT_ID = 0;
const COORDINATOR_BOSS_CONTACT_ID = 1;

function sqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Render a value as a SQL literal, preserving SQL NULL for null/undefined.
 *
 * Avoids the trap of `'${value}'` interpolation, which turns `null` into
 * the string literal `'null'` rather than SQL `NULL`. Use this anywhere
 * a column accepts NULL and the seed callers may pass undefined.
 */
function sqlLiteral(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return `'${sqlString(value)}'`;
}

/**
 * Orchestra base URL must be the API **origin** only (no `/v0` suffix).
 * Call sites append paths like `/v0/logs`. Local `scripts/local.sh` exports
 * `UNIFY_BASE_URL=…/v0`; if that is copied into `ORCHESTRA_URL`, naive
 * concatenation becomes `/v0/v0/...` and FastAPI returns 404 `{"detail":"Not Found"}`.
 */
function normalizeOrchestraBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/v0')) {
    base = base.slice(0, -3);
  }
  return base;
}

const ORCHESTRA_BASE_URL = normalizeOrchestraBaseUrl(
  process.env.ORCHESTRA_URL || 'http://127.0.0.1:8000'
);
const API_TIMEOUT = 30_000;

// =============================================================================
// Low-Level DB Access
// =============================================================================

/**
 * Run a SQL query against the local Orchestra DB and return trimmed output.
 * Uses the same `docker exec psql` pattern as {@link src/tests/auth/fixtures.ts}.
 */
export function dbExec(sql: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U orchestra -d orchestra -tAc "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', timeout: 10_000 }
  ).trim();
}

/**
 * Run a multi-statement SQL block (DO $$ ... $$) against the local DB.
 * Returns the raw stdout.
 */
export function dbExecBlock(sql: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U orchestra -d orchestra -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', timeout: 10_000 }
  ).trim();
}

/**
 * Run SQL via stdin pipe to avoid shell escaping issues.
 *
 * Use this when the SQL contains `$` characters (e.g., argon2 hashes)
 * that would be mangled by bash variable expansion in double-quoted strings.
 */
export function dbExecStdin(sql: string): string {
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U orchestra -d orchestra`, {
    input: sql,
    encoding: 'utf-8',
    timeout: 10_000,
  }).trim();
}

// =============================================================================
// Low-Level API Access
// =============================================================================

/**
 * Authenticated fetch against the Console API.
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    return await fetch(`${CONSOLE_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { apiKey } : {}),
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Authenticated fetch against Orchestra directly (bypassing Console).
 */
export async function orchestraFetch(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    return await fetch(`${ORCHESTRA_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(tid);
  }
}

// =============================================================================
// Unique ID Generators
// =============================================================================

/** Generate a unique user ID */
export function uniqueUserId(prefix = 'seed'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/** Generate a unique email */
export function uniqueEmail(prefix = 'seed'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@seed.example.com`;
}

/** Generate a unique API key */
export function uniqueApiKey(prefix = 'seed'): string {
  return `${prefix}-key-${randomUUID().slice(0, 12)}`;
}

// =============================================================================
// User Primitives
// =============================================================================

export interface CreateUserOpts {
  /** User ID (auto-generated if omitted) */
  id?: string;
  email?: string;
  name?: string;
  lastName?: string;
  /** API key (auto-generated if omitted) */
  apiKey?: string;
  /** Initial credits (default: 10000, or `SEED_CREDITS` env override) */
  credits?: number;
  /**
   * Skip auto-provisioning the user's personal Coordinator.
   *
   * Defaults to `false` so every seeded user mirrors the production
   * signup hook (one Coordinator per user, `organization_id IS NULL`).
   * Set to `true` only for scenarios that need to exercise the
   * Orchestra backfill endpoint or assert a pre-Coordinator state.
   */
  skipCoordinator?: boolean;
}

/**
 * Create a user with a billing account and API key.
 *
 * Also auto-provisions the user's personal Coordinator unless
 * `skipCoordinator: true` is passed, so every seeded workspace shows
 * the Coordinator alongside any other seeded assistants — matching the
 * production behaviour where signup always provisions one.
 *
 * Idempotent: skips if user with this ID already exists. The Coordinator
 * creation is also idempotent (it returns the existing row if a
 * personal Coordinator already exists for the user).
 */
export function createUser(opts: CreateUserOpts = {}): SeededUser {
  const id = opts.id ?? uniqueUserId();
  const email = opts.email ?? uniqueEmail();
  const name = opts.name ?? 'Seed';
  const lastName = opts.lastName ?? 'User';
  const apiKey = opts.apiKey ?? uniqueApiKey();
  const credits = opts.credits ?? defaultSeedCredits();

  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
  _default_plan_template_id bigint;
  _assignment_id integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" WHERE id = '${id}') THEN
    INSERT INTO billing_account (credits, account_status)
    VALUES (${credits}, 'ACTIVE')
    RETURNING id INTO _ba_id;

    SELECT id
    INTO _default_plan_template_id
    FROM billing_plan_template
    WHERE name = 'default' AND is_active = true
    ORDER BY id
    LIMIT 1;

    IF _default_plan_template_id IS NULL THEN
      RAISE EXCEPTION 'Missing default billing_plan_template while creating seeded user %', '${id}';
    END IF;

    INSERT INTO billing_plan_assignment (billing_account_id, template_id, change_reason)
    VALUES (_ba_id, _default_plan_template_id, 'seed user bootstrap')
    RETURNING id INTO _assignment_id;

    -- Point the account at its active assignment. Without this the
    -- available-plans endpoint can't resolve a "current" plan (it reads
    -- billing_account.plan_assignment_id), flags no member is_current, and
    -- empties the whole tier list — so the Subscribe picker never renders.
    UPDATE billing_account SET plan_assignment_id = _assignment_id WHERE id = _ba_id;

    INSERT INTO "user" (id, email, name, last_name, billing_account_id, store_prompts)
    VALUES ('${id}', '${email}', '${name}', '${lastName}', _ba_id, true);

    INSERT INTO api_key (user_id, key, name)
    VALUES ('${id}', '${apiKey}', 'Seed Key')
    ON CONFLICT (key) DO NOTHING;
  END IF;
END
\\$\\$;
`);

  // Honour an explicit --credits/SEED_CREDITS override even for an already
  // seeded account (the block above skips existing users). Only when the
  // caller didn't pass an explicit credits value, so scenario-specific
  // balances still win.
  if (opts.credits === undefined && seedCreditsOverrideActive()) {
    dbExec(
      `UPDATE billing_account SET credits = ${credits} ` +
        `WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${id}');`
    );
  }

  const coordinator = opts.skipCoordinator ? null : createPersonalCoordinator(id);

  return { id, email, name, lastName, apiKey, coordinator };
}

// =============================================================================
// Organization Primitives
// =============================================================================

export interface CreateOrgOpts {
  name?: string;
  ownerId: string;
  /** Credits for the org billing account (default: 10000, or `SEED_CREDITS`) */
  credits?: number;
  dataSharingMode?: 'private' | 'shared';
}

/**
 * Create an organization and add the owner as a member with the Owner role.
 *
 * Returns the created org including the owner's org-scoped API key.
 * Idempotent: if an org with the same owner already exists, returns the
 * existing one (looks up the existing org API key from the DB).
 */
/**
 * Ensure the four RBAC system roles (Owner/Admin/Member/Viewer) and their
 * permission grants exist.
 *
 * Production and the pytest suite get these from the platform bootstrap
 * (`orchestra/tests/seeding.sql`), but a fresh `local.sh` database does NOT —
 * `local.sh` only seeds billing defaults + a test user. Without the system
 * roles, `createOrg`/`addMember` resolve a NULL `role_id` and the membership
 * INSERT fails. Mirrors the RBAC section of `seeding.sql`. Idempotent and
 * safe to call repeatedly.
 */
export function ensureSystemRoles(): void {
  const have = dbExec(`SELECT count(*) FROM role WHERE is_system_role = true;`);
  if (parseInt(have, 10) >= 4) return;

  dbExecBlock(`
DO \\$\\$
BEGIN
  INSERT INTO permission (name, description, resource_type, action)
  SELECT v.name, v.description, v.resource_type, v.action
  FROM (VALUES
    ('project:read', 'View project details', 'project', 'read'),
    ('project:write', 'Edit project', 'project', 'write'),
    ('project:delete', 'Delete project', 'project', 'delete'),
    ('org:read', 'View organization details', 'organization', 'read'),
    ('org:write', 'Edit organization settings, billing, and members', 'organization', 'write'),
    ('org:delete', 'Delete organization', 'organization', 'delete'),
    ('billing:read', 'View billing information, credits, and invoices', 'billing', 'read'),
    ('billing:write', 'Update billing settings, autorecharge, and business profile', 'billing', 'write'),
    ('assistant:read', 'View assistant details', 'assistant', 'read'),
    ('assistant:write', 'Create and edit assistants', 'assistant', 'write'),
    ('assistant:delete', 'Delete assistants', 'assistant', 'delete')
  ) AS v(name, description, resource_type, action)
  WHERE NOT EXISTS (SELECT 1 FROM permission p WHERE p.name = v.name);

  INSERT INTO role (name, description, organization_id, is_system_role)
  SELECT v.name, v.description, NULL, true
  FROM (VALUES
    ('Owner', 'Full access to projects and organization'),
    ('Admin', 'Full access except deleting organization'),
    ('Member', 'Read and write projects, view organization details'),
    ('Viewer', 'Read-only access to projects and organization')
  ) AS v(name, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM role r WHERE r.name = v.name AND r.is_system_role = true
  );

  INSERT INTO role_permission (role_id, permission_id)
  SELECT (SELECT id FROM role WHERE name = 'Owner' AND is_system_role = true), p.id
  FROM permission p
  WHERE NOT EXISTS (
    SELECT 1 FROM role_permission rp
    WHERE rp.role_id = (SELECT id FROM role WHERE name = 'Owner' AND is_system_role = true)
      AND rp.permission_id = p.id
  );

  INSERT INTO role_permission (role_id, permission_id)
  SELECT (SELECT id FROM role WHERE name = 'Admin' AND is_system_role = true), p.id
  FROM permission p
  WHERE p.name <> 'org:delete'
    AND NOT EXISTS (
      SELECT 1 FROM role_permission rp
      WHERE rp.role_id = (SELECT id FROM role WHERE name = 'Admin' AND is_system_role = true)
        AND rp.permission_id = p.id
    );

  INSERT INTO role_permission (role_id, permission_id)
  SELECT (SELECT id FROM role WHERE name = 'Member' AND is_system_role = true), p.id
  FROM permission p
  WHERE (
      (p.resource_type = 'project' AND p.action IN ('read', 'write'))
      OR (p.resource_type = 'organization' AND p.action = 'read')
      OR (p.resource_type = 'assistant' AND p.action IN ('read', 'write'))
      OR p.name = 'billing:read'
    )
    AND NOT EXISTS (
      SELECT 1 FROM role_permission rp
      WHERE rp.role_id = (SELECT id FROM role WHERE name = 'Member' AND is_system_role = true)
        AND rp.permission_id = p.id
    );

  INSERT INTO role_permission (role_id, permission_id)
  SELECT (SELECT id FROM role WHERE name = 'Viewer' AND is_system_role = true), p.id
  FROM permission p
  WHERE p.action = 'read'
    AND NOT EXISTS (
      SELECT 1 FROM role_permission rp
      WHERE rp.role_id = (SELECT id FROM role WHERE name = 'Viewer' AND is_system_role = true)
        AND rp.permission_id = p.id
    );
END
\\$\\$;
`);
}

export function createOrg(opts: CreateOrgOpts): SeededOrg {
  const name = opts.name ?? `Seed Org ${Date.now()}`;
  const credits = opts.credits ?? defaultSeedCredits();

  // Check if org already exists for this owner
  const existingId = dbExec(
    `SELECT id FROM organization WHERE owner_id = '${opts.ownerId}' LIMIT 1;`
  );

  if (existingId) {
    const existingKey = dbExec(
      `SELECT key FROM api_key WHERE user_id = '${opts.ownerId}' AND organization_id = ${existingId} LIMIT 1;`
    );
    // Re-apply an explicit --credits/SEED_CREDITS override to the existing
    // org's billing account (see createUser for rationale).
    if (opts.credits === undefined && seedCreditsOverrideActive()) {
      dbExec(
        `UPDATE billing_account SET credits = ${credits} ` +
          `WHERE id = (SELECT billing_account_id FROM organization WHERE id = ${parseInt(existingId, 10)});`
      );
    }
    const existingOrgId = parseInt(existingId, 10);
    const existingCoordinator = createWorkspaceCoordinator(opts.ownerId, existingOrgId);
    if (opts.dataSharingMode === 'shared') {
      syncOrgWideSharingSeedState(existingOrgId, opts.ownerId, true);
    }
    return {
      id: existingOrgId,
      name,
      ownerId: opts.ownerId,
      ownerOrgApiKey: existingKey,
      coordinator: existingCoordinator,
    };
  }

  // A fresh `local.sh` DB has no RBAC system roles (those live in the test
  // seeding.sql, which local.sh doesn't run), so the owner-role lookup below
  // would resolve NULL and the membership INSERT would fail. Self-heal first.
  ensureSystemRoles();

  const ownerOrgKey = uniqueApiKey('org');

  dbExecBlock(`
DO \\$\\$
DECLARE
  _org_id integer;
  _ba_id integer;
  _default_plan_template_id bigint;
  _assignment_id integer;
  _owner_role_id integer;
BEGIN
  INSERT INTO billing_account (credits, account_status)
  VALUES (${credits}, 'ACTIVE')
  RETURNING id INTO _ba_id;

  SELECT id
  INTO _default_plan_template_id
  FROM billing_plan_template
  WHERE name = 'default' AND is_active = true
  ORDER BY id
  LIMIT 1;

  IF _default_plan_template_id IS NULL THEN
    RAISE EXCEPTION 'Missing default billing_plan_template while creating seeded org owner %', '${opts.ownerId}';
  END IF;

  INSERT INTO billing_plan_assignment (billing_account_id, template_id, change_reason)
  VALUES (_ba_id, _default_plan_template_id, 'seed org bootstrap')
  RETURNING id INTO _assignment_id;

  -- Link the account to its active assignment (see createUser): the
  -- available-plans endpoint resolves the current plan via
  -- billing_account.plan_assignment_id, and without it the tier picker
  -- renders empty.
  UPDATE billing_account SET plan_assignment_id = _assignment_id WHERE id = _ba_id;

  INSERT INTO organization (owner_id, name, billing_account_id, verified)
  VALUES ('${opts.ownerId}', '${name.replace(/'/g, "''")}', _ba_id, true)
  RETURNING id INTO _org_id;

  SELECT id INTO _owner_role_id FROM role WHERE name = 'Owner' AND is_system_role = true LIMIT 1;

  INSERT INTO organization_member (organization_id, user_id, role_id)
  VALUES (_org_id, '${opts.ownerId}', _owner_role_id);

  INSERT INTO api_key (user_id, organization_id, key, name)
  VALUES ('${opts.ownerId}', _org_id, '${ownerOrgKey}', 'Org Key');
END
\\$\\$;
`);

  const orgId = dbExec(
    `SELECT id FROM organization WHERE owner_id = '${opts.ownerId}' ORDER BY id DESC LIMIT 1;`
  );
  const parsedOrgId = parseInt(orgId, 10);

  // Orchestra provisions the owner's workspace Coordinator with every org
  // (`_create_organization_with_owner_coordinator`). Personal Coordinators are
  // filtered out of an org-scoped list by `organization_id`, so without this the
  // seeded org carries no coordinator at all and the list emits no pinned group.
  const coordinator = createWorkspaceCoordinator(opts.ownerId, parsedOrgId);

  if (opts.dataSharingMode === 'shared') {
    syncOrgWideSharingSeedState(parsedOrgId, opts.ownerId, true);
  }

  return {
    id: parsedOrgId,
    name,
    ownerId: opts.ownerId,
    ownerOrgApiKey: ownerOrgKey,
    coordinator,
  };
}

function syncOrgWideSharingSeedState(
  orgId: number,
  actorUserId: string,
  enableSharing = false
): void {
  const isAlreadyShared =
    dbExec(`SELECT org_wide_sharing_enabled FROM organization WHERE id = ${orgId}`) === 't';
  if (!enableSharing && !isAlreadyShared) return;

  dbExecBlock(`
DO \\$\\$
DECLARE
  _team_id integer;
BEGIN
  SELECT org_wide_sharing_team_id
  INTO _team_id
  FROM organization
  WHERE id = ${orgId};

  IF _team_id IS NULL THEN
    SELECT id
    INTO _team_id
    FROM team
    WHERE organization_id = ${orgId} AND is_org_wide_sharing = true
    ORDER BY id
    LIMIT 1;
  END IF;

  IF _team_id IS NULL THEN
    INSERT INTO team (name, description, organization_id, status, is_org_wide_sharing)
    VALUES (
      (SELECT name FROM organization WHERE id = ${orgId}),
      'Organization-wide shared pool for knowledge, skills, and general know-how.',
      ${orgId},
      'active',
      true
    )
    RETURNING id INTO _team_id;
  END IF;

  UPDATE team
  SET is_org_wide_sharing = true,
      name = (SELECT name FROM organization WHERE id = ${orgId})
  WHERE id = _team_id;

  UPDATE organization
  SET org_wide_sharing_enabled = true,
      org_wide_sharing_team_id = _team_id
  WHERE id = ${orgId};

  INSERT INTO team_member (team_id, user_id)
  SELECT _team_id, om.user_id
  FROM organization_member om
  WHERE om.organization_id = ${orgId}
  ON CONFLICT DO NOTHING;

  -- Coordinators are deliberately excluded from the managed org-wide team
  -- (Orchestra's sync_org_wide_sharing filters is_coordinator).
  INSERT INTO team_assistant_memberships (team_id, assistant_id, added_by)
  SELECT _team_id, a.agent_id, ${sqlLiteral(actorUserId)}
  FROM assistants a
  WHERE a.organization_id = ${orgId}
    AND NOT a.is_coordinator
  ON CONFLICT DO NOTHING;

  INSERT INTO contact_memberships (
    assistant_id,
    authoring_assistant_id,
    contact_id,
    target_scope,
    target_team_id,
    relationship,
    should_respond,
    response_policy,
    can_edit
  )
  SELECT
    a.agent_id,
    a.agent_id,
    COALESCE(self_cm.contact_id, ${COORDINATOR_SELF_CONTACT_ID}),
    'team',
    _team_id,
    'self',
    true,
    '',
    true
  FROM assistants a
  LEFT JOIN contact_memberships self_cm
    ON self_cm.assistant_id = a.agent_id
    AND self_cm.target_scope = 'personal'
    AND self_cm.relationship = 'self'
  WHERE a.organization_id = ${orgId}
  ON CONFLICT DO NOTHING;

  INSERT INTO contact_memberships (
    assistant_id,
    authoring_assistant_id,
    contact_id,
    target_scope,
    target_team_id,
    relationship,
    should_respond,
    response_policy,
    can_edit
  )
  SELECT
    a.agent_id,
    a.agent_id,
    COALESCE(boss_cm.contact_id, ${COORDINATOR_BOSS_CONTACT_ID}),
    'team',
    _team_id,
    'boss',
    true,
    ${sqlLiteral(DEFAULT_BOSS_RESPONSE_POLICY)},
    true
  FROM assistants a
  LEFT JOIN contact_memberships boss_cm
    ON boss_cm.assistant_id = a.agent_id
    AND boss_cm.target_scope = 'personal'
    AND boss_cm.relationship = 'boss'
  WHERE a.organization_id = ${orgId}
  ON CONFLICT DO NOTHING;
END
\\$\\$;
`);
}

// =============================================================================
// Organization Member Primitives
// =============================================================================

export interface AddMemberOpts {
  orgId: number;
  userId: string;
  role: OrgRole;
}

/**
 * Add a user as a member of an organization with a specific role.
 *
 * Also creates an org-scoped API key for the member so they can authenticate
 * in the org context.
 *
 * Idempotent: upserts membership and upgrades role on conflict.
 */
export function addMember(opts: AddMemberOpts): string {
  const orgApiKey = uniqueApiKey('member');

  dbExecBlock(`
DO \\$\\$
DECLARE
  _role_id integer;
BEGIN
  SELECT id INTO _role_id FROM role WHERE name = '${opts.role}' AND is_system_role = true LIMIT 1;

  UPDATE organization_member
  SET role_id = _role_id
  WHERE organization_id = ${opts.orgId} AND user_id = '${opts.userId}';

  IF NOT FOUND THEN
    INSERT INTO organization_member (organization_id, user_id, role_id)
    VALUES (${opts.orgId}, '${opts.userId}', _role_id);
  END IF;

  INSERT INTO api_key (user_id, organization_id, key, name)
  VALUES ('${opts.userId}', ${opts.orgId}, '${orgApiKey}', 'Member Key')
  ON CONFLICT (key) DO NOTHING;
END
\\$\\$;
`);

  syncOrgWideSharingSeedState(opts.orgId, opts.userId);

  return orgApiKey;
}

export interface EnsureUnifyOrgOpts {
  /** User who owns the org when one is created fresh. */
  ownerId?: string;
  /** User to add as a member of an existing or newly created org. */
  memberId?: string;
  /** Role for memberId on an existing org (default Member). */
  memberRole?: OrgRole;
  /** Role for ownerId when joining an existing org owned by someone else (default Admin). */
  existingOrgOwnerRole?: OrgRole;
  credits?: number;
}

/**
 * Find or create the globally unique ``Unify`` org used by admin and
 * interfaces gates. Parallel E2E jobs share one Orchestra DB — never
 * DELETE-and-recreate this org in individual specs.
 */
export function ensureUnifyOrg(opts: EnsureUnifyOrgOpts): SeededOrg {
  ensureSystemRoles();

  const existingId = dbExec(`SELECT id FROM organization WHERE name = 'Unify' LIMIT 1;`);

  if (existingId) {
    const orgId = parseInt(existingId, 10);
    const ownerId = dbExec(`SELECT owner_id FROM organization WHERE id = ${orgId};`);
    const ownerOrgApiKey = dbExec(
      `SELECT key FROM api_key WHERE user_id = '${ownerId}' AND organization_id = ${orgId} LIMIT 1;`
    );

    if (opts.memberId) {
      addMember({ orgId, userId: opts.memberId, role: opts.memberRole ?? 'Member' });
    }
    if (opts.ownerId && opts.ownerId !== ownerId) {
      addMember({
        orgId,
        userId: opts.ownerId,
        role: opts.existingOrgOwnerRole ?? 'Admin',
      });
    }

    return {
      id: orgId,
      name: 'Unify',
      ownerId,
      ownerOrgApiKey,
      coordinator: createWorkspaceCoordinator(ownerId, orgId),
    };
  }

  const ownerId = opts.ownerId ?? opts.memberId;
  if (!ownerId) {
    throw new Error('ensureUnifyOrg: Unify org does not exist and no ownerId was provided');
  }

  return createOrg({
    name: 'Unify',
    ownerId,
    credits: opts.credits,
  });
}

// =============================================================================
// Voice Preset (required FK for assistants)
// =============================================================================

/**
 * Ensure at least one voice preset exists (required FK for assistants).
 */
export function ensureVoicePreset(userId: string): void {
  const coordinatorVoice = approvedCharacterVoiceMetadata[coordinatorDefaultVoiceId];
  dbExecBlock(`
INSERT INTO voices (voice_id, user_id, name, description, gender, language, is_preset, provider)
VALUES (
  '9BWtsMINqrJLrRacOk9x',
  ${sqlLiteral(userId)},
  'English Female Husky 1',
  'A middle-aged female with an African-American accent.',
  'female',
  'en',
  true,
  'elevenlabs'
),
(
  ${sqlLiteral(coordinatorDefaultVoiceId)},
  ${sqlLiteral(userId)},
  ${sqlLiteral(coordinatorVoice.name)},
  ${sqlLiteral(coordinatorVoice.description)},
  ${sqlLiteral(coordinatorVoice.gender)},
  ${sqlLiteral(coordinatorVoice.language)},
  true,
  ${sqlLiteral(coordinatorVoice.provider)}
) ON CONFLICT DO NOTHING;
`);
}

// =============================================================================
// Assistant Primitives
// =============================================================================

export interface CreateAssistantOpts {
  userId: string;
  orgId?: number;
  firstName?: string;
  /** Surname. Pass `null` to omit (matches Coordinator provisioning). */
  surname?: string | null;
  profilePhoto?: string;
  /** Optional free-text job title / specialization. */
  jobTitle?: string;
  isCoordinator?: boolean;
  // -- Optional overrides for the assistant row. When omitted the
  //    historical seed defaults are used so existing scenarios are
  //    unaffected; Coordinator seeding sets these explicitly to mirror
  //    Orchestra's `create_coordinator_assistant`.
  about?: string | null;
  nationality?: string | null;
  timezone?: string | null;
  age?: number | null;
  voiceId?: string | null;
  voiceProvider?: string | null;
  weeklyLimit?: number | null;
  maxParallel?: number | null;
  desktopMode?: string | null;
  isLocal?: boolean;
  // -- Optional contact_memberships overrides. Coordinators wire
  //    `self=0` / `boss=1` to match production; regular seeded
  //    assistants keep the historical 42 / 43 pair.
  selfContactId?: number;
  bossContactId?: number;
  /**
   * Optional response policy for the boss contact membership. Defaults
   * to the same instruction used for regular seeded assistants; pass
   * `null` to emit an empty string (mirrors Coordinator provisioning).
   */
  bossResponsePolicy?: string | null;
}

const DEFAULT_BOSS_RESPONSE_POLICY =
  'Your immediate manager, please do whatever they ask you to do within reason, and do *not* withhold any information from them.';
const COORDINATOR_LEGACY_ABOUT = 'Coordinates setup and shared assistant memory.';

/**
 * Create an assistant via direct SQL (bypasses billing checks).
 *
 * Ensures a voice preset exists before creating.
 *
 * The defaults reproduce the existing seed shape (Ada Lovelace–style
 * test assistant with elevenlabs voice). Pass overrides via opts to
 * shape a different kind of assistant — see {@link createPersonalCoordinator}
 * for the Coordinator-flavoured invocation.
 */
export function createAssistant(opts: CreateAssistantOpts): SeededAssistant {
  const firstName = opts.firstName ?? 'Seed';
  const surname = opts.surname === undefined ? 'Assistant' : opts.surname;

  ensureVoicePreset(opts.userId);

  const age = opts.age === undefined ? 30 : opts.age;
  const nationality = opts.nationality === undefined ? 'United States' : opts.nationality;
  const timezone = opts.timezone === undefined ? 'America/New_York' : opts.timezone;
  const about =
    opts.about === undefined ? 'Seed test assistant for automated testing.' : opts.about;
  const voiceId = opts.voiceId === undefined ? '9BWtsMINqrJLrRacOk9x' : opts.voiceId;
  const voiceProvider = opts.voiceProvider === undefined ? 'elevenlabs' : opts.voiceProvider;
  const weeklyLimit = opts.weeklyLimit === undefined ? 40 : opts.weeklyLimit;
  const maxParallel = opts.maxParallel === undefined ? 10 : opts.maxParallel;
  const desktopMode = opts.desktopMode === undefined ? null : opts.desktopMode;
  const isLocal = opts.isLocal === undefined ? true : opts.isLocal;
  const selfContactId =
    opts.selfContactId ?? (opts.isCoordinator ? COORDINATOR_SELF_CONTACT_ID : ASSISTANT_CONTACT_ID);
  const bossContactId =
    opts.bossContactId ?? (opts.isCoordinator ? COORDINATOR_BOSS_CONTACT_ID : OWNER_CONTACT_ID);
  const bossResponsePolicy =
    opts.bossResponsePolicy === undefined ? DEFAULT_BOSS_RESPONSE_POLICY : opts.bossResponsePolicy;

  dbExecBlock(`
INSERT INTO assistants (user_id, first_name, surname, age, nationality, timezone, about, voice_id, voice_provider, weekly_limit, max_parallel, organization_id, is_local, profile_photo, job_title, is_coordinator, desktop_mode)
VALUES (
  ${sqlLiteral(opts.userId)},
  ${sqlLiteral(firstName)},
  ${sqlLiteral(surname)},
  ${sqlLiteral(age)},
  ${sqlLiteral(nationality)},
  ${sqlLiteral(timezone)},
  ${sqlLiteral(about)},
  ${sqlLiteral(voiceId)},
  ${sqlLiteral(voiceProvider)},
  ${sqlLiteral(weeklyLimit)},
  ${sqlLiteral(maxParallel)},
  ${sqlLiteral(opts.orgId ?? null)},
  ${sqlLiteral(isLocal)},
  ${sqlLiteral(opts.profilePhoto ?? null)},
  ${sqlLiteral(opts.jobTitle ?? null)},
  ${sqlLiteral(opts.isCoordinator === true)},
  ${sqlLiteral(desktopMode)}
);
`);

  // Resolve the freshly inserted agent_id. Surname is nullable so we
  // distinguish it explicitly to make this work for Coordinator rows.
  const surnamePredicate =
    surname === null ? 'surname IS NULL' : `surname = ${sqlLiteral(surname)}`;
  const agentId = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = ${sqlLiteral(opts.userId)} AND first_name = ${sqlLiteral(firstName)} AND ${surnamePredicate} ORDER BY agent_id DESC LIMIT 1;`
  );
  const parsedAgentId = parseInt(agentId, 10);
  if (!Number.isFinite(parsedAgentId)) {
    throw new Error(
      `Failed to parse seeded assistant id for ${opts.userId}/${firstName} ${surname ?? '(no surname)'}: ${agentId}`
    );
  }

  dbExecBlock(`
INSERT INTO contact_memberships (
  assistant_id,
  contact_id,
  target_scope,
  relationship,
  should_respond,
  response_policy,
  can_edit
)
VALUES
  (${parsedAgentId}, ${selfContactId}, 'personal', 'self', true, '', true),
  (
    ${parsedAgentId},
    ${bossContactId},
    'personal',
    'boss',
    true,
    ${sqlLiteral(bossResponsePolicy ?? '')},
    true
  )
ON CONFLICT DO NOTHING;
`);

  if (opts.orgId !== undefined) {
    syncOrgWideSharingSeedState(opts.orgId, opts.userId);
  }

  return {
    agentId: parsedAgentId,
    firstName,
    surname: surname ?? '',
    userId: opts.userId,
    organizationId: opts.orgId ?? null,
    isCoordinator: opts.isCoordinator === true,
    selfContactId,
    bossContactId,
  };
}

// =============================================================================
// User Desktops (local machines linked to assistants)
// =============================================================================

export interface CreateUserDesktopOpts {
  /** Owner of the registered machine. */
  userId: string;
  name?: string;
  os?: 'ubuntu' | 'windows' | 'macos';
  /** Public tunnel URL. Defaults to a unique seed URL. */
  url?: string;
}

/**
 * Register a user desktop via direct SQL (mirrors the desktop app's
 * registration after it obtains a public tunnel hostname).
 */
export function createUserDesktop(opts: CreateUserDesktopOpts): SeededUserDesktop {
  const name = opts.name ?? 'Seed Desktop';
  const os = opts.os ?? 'macos';
  const url =
    opts.url ?? `https://seed-${Date.now()}-${Math.floor(Math.random() * 1e6)}.tunnel.unify.ai`;

  dbExecBlock(`
INSERT INTO user_desktops (user_id, name, url, os)
VALUES (${sqlLiteral(opts.userId)}, ${sqlLiteral(name)}, ${sqlLiteral(url)}, ${sqlLiteral(os)});
`);

  const idStr = dbExec(
    `SELECT id FROM user_desktops WHERE user_id = ${sqlLiteral(opts.userId)} AND name = ${sqlLiteral(name)} ORDER BY id DESC LIMIT 1;`
  );
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    throw new Error(`Failed to parse seeded desktop id for ${opts.userId}/${name}: ${idStr}`);
  }
  return { id, userId: opts.userId, name, os, url };
}

export interface LinkUserDesktopOpts {
  assistantId: number;
  desktopId: number;
  /** User who owns the desktop being linked. */
  ownerUserId: string;
  filesysSync?: boolean;
}

/**
 * Link a registered user desktop to an assistant for a specific owner,
 * mirroring `POST /v0/desktop/link`. One machine may be linked to several
 * of the owner's assistants.
 */
export function linkUserDesktop(opts: LinkUserDesktopOpts): void {
  dbExecBlock(`
INSERT INTO assistant_user_desktops (assistant_id, user_desktop_id, owner_user_id, filesys_sync)
VALUES (
  ${opts.assistantId},
  ${opts.desktopId},
  ${sqlLiteral(opts.ownerUserId)},
  ${sqlLiteral(opts.filesysSync ?? false)}
)
ON CONFLICT DO NOTHING;
`);
}

// =============================================================================
// MS Teams bot installs (Teams Store bot; org bind handshake)
// =============================================================================

export interface CreateMsTeamsBotInstallOpts {
  /** Microsoft tenant id. Defaults to a unique seed value. */
  tenantId?: string;
  tenantName?: string;
  /** Azure bot registration app id. Defaults to a fixed seed value. */
  botAppId?: string;
  serviceUrl?: string;
  /** Handshake nonce for the pending row. Defaults to a unique value. */
  bindNonce?: string;
  /**
   * Bind the install to an org up front (skips the pending state).
   * Leave undefined to seed a *pending* install that a bind flow claims.
   */
  organizationId?: number;
}

/**
 * Seed an MS Teams bot install row, mirroring what Orchestra's
 * ``ensure_pending_install`` writes when the bot is first added to a
 * Microsoft tenant. Defaults to a **pending** row (no owner) carrying a
 * ``bind_nonce`` so the tenant→org bind handshake is reachable.
 *
 * Idempotent on the tenant: an existing active (non-revoked) row for the
 * same tenant is returned unchanged, respecting the partial unique index
 * ``ux_ms_teams_bot_install_active_tenant``.
 */
export function createMsTeamsBotInstall(
  opts: CreateMsTeamsBotInstallOpts = {}
): SeededMsTeamsBotInstall {
  const tenantId = opts.tenantId ?? `seed-tenant-${randomUUID().slice(0, 12)}`;
  const tenantName = opts.tenantName ?? 'Seed Microsoft Tenant';
  const botAppId = opts.botAppId ?? 'seed-teams-bot-app-id';
  const serviceUrl = opts.serviceUrl ?? 'https://smba.trafficmanager.net/seed/';
  const bindNonce = opts.organizationId != null ? null : (opts.bindNonce ?? randomUUID());
  const orgId = opts.organizationId ?? null;

  const existing = dbExec(
    `SELECT id, COALESCE(bind_nonce, ''), COALESCE(organization_id::text, '') FROM ms_teams_bot_installs WHERE tenant_id = ${sqlLiteral(tenantId)} AND revoked_at IS NULL LIMIT 1;`
  );
  if (existing) {
    const [idRaw, nonceRaw, orgRaw] = existing.split('|');
    return {
      id: parseInt(idRaw, 10),
      tenantId,
      tenantName,
      botAppId,
      bindNonce: nonceRaw === '' ? null : nonceRaw,
      organizationId: orgRaw === '' ? null : parseInt(orgRaw, 10),
    };
  }

  dbExecBlock(`
INSERT INTO ms_teams_bot_installs (organization_id, tenant_id, tenant_name, bot_app_id, service_url, bind_nonce, bound_at)
VALUES (
  ${sqlLiteral(orgId)},
  ${sqlLiteral(tenantId)},
  ${sqlLiteral(tenantName)},
  ${sqlLiteral(botAppId)},
  ${sqlLiteral(serviceUrl)},
  ${sqlLiteral(bindNonce)},
  ${orgId != null ? 'NOW()' : 'NULL'}
);
`);

  const idStr = dbExec(
    `SELECT id FROM ms_teams_bot_installs WHERE tenant_id = ${sqlLiteral(tenantId)} ORDER BY id DESC LIMIT 1;`
  );
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    throw new Error(
      `Failed to parse seeded MS Teams bot install id for tenant ${tenantId}: ${idStr}`
    );
  }

  return { id, tenantId, tenantName, botAppId, bindNonce, organizationId: orgId };
}

/** Read an MS Teams bot install's owner + pending/revoked state (for assertions). */
export function getMsTeamsBotInstallState(installId: number): {
  organizationId: number | null;
  pending: boolean;
  revoked: boolean;
} | null {
  const row = dbExec(
    `SELECT COALESCE(organization_id::text, ''), (organization_id IS NULL AND user_id IS NULL), (revoked_at IS NOT NULL) FROM ms_teams_bot_installs WHERE id = ${installId};`
  );
  if (!row) return null;
  const [orgRaw, pendingRaw, revokedRaw] = row.split('|');
  return {
    organizationId: orgRaw === '' ? null : parseInt(orgRaw, 10),
    pending: pendingRaw === 't',
    revoked: revokedRaw === 't',
  };
}

/** Delete an MS Teams bot install (cleanup). */
export function deleteMsTeamsBotInstall(installId: number): void {
  try {
    dbExec(`DELETE FROM ms_teams_bot_installs WHERE id = ${installId};`);
  } catch {
    /* best effort */
  }
}

// =============================================================================
// Workspace Coordinator
// =============================================================================

/**
 * Options for {@link createWorkspaceCoordinator}.
 *
 * The shape intentionally excludes fields that are fixed by Coordinator
 * semantics (name, `is_coordinator`, contact IDs); the workspace is its own
 * parameter. The few remaining knobs are mostly for test variants — e.g.
 * seeding a specific `timezone` or `profilePhoto`.
 */
export type CreateWorkspaceCoordinatorOpts = Pick<
  CreateAssistantOpts,
  'timezone' | 'profilePhoto' | 'about' | 'desktopMode' | 'nationality'
>;

/**
 * Create the user's Coordinator for one workspace.
 *
 * Mirrors Orchestra's `create_workspace_coordinator`:
 *   - `first_name = 'T-W1N'`, `job_title = 'Your digital twin'`
 *   - `nationality = 'United States'`, `desktop_mode = 'ubuntu'`
 *   - Numeric limits default to NULL; voice uses the coordinator's fixed ElevenLabs profile
 *   - `is_coordinator = TRUE`, scoped to `organizationId` (`null` for personal)
 *   - Personal contact memberships pinned to `self=0` / `boss=1`
 *
 * Idempotent — an existing Coordinator for the workspace is returned
 * without re-inserting, matching the partial unique indexes
 * `(user_id) WHERE is_coordinator AND organization_id IS NULL` and
 * `(user_id, organization_id) WHERE is_coordinator AND organization_id IS NOT NULL`.
 *
 * The row alone leaves `Coordinator/State` unwritten, so the assistants
 * page reads onboarding as active (the snapshot defaults `onboardingActive`
 * to `true` when the field is absent). Tests that drive the standard shell
 * pause it first — see `deferCoordinatorForUser`.
 */
export function createWorkspaceCoordinator(
  userId: string,
  organizationId: number | null,
  opts: CreateWorkspaceCoordinatorOpts = {}
): SeededAssistant {
  const workspaceScope =
    organizationId === null ? 'organization_id IS NULL' : `organization_id = ${organizationId}`;
  const existingId = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = ${sqlLiteral(userId)} AND is_coordinator = TRUE AND ${workspaceScope} LIMIT 1;`
  );
  if (existingId) {
    const parsed = parseInt(existingId, 10);
    if (Number.isFinite(parsed)) {
      ensureVoicePreset(userId);
      // Fill the default voice only when absent so a selected Coordinator voice
      // survives a re-seed/heal (the voice is selectable like any other droid).
      dbExec(
        `UPDATE assistants SET first_name = 'T-W1N', surname = NULL, voice_id = COALESCE(voice_id, ${sqlLiteral(coordinatorDefaultVoiceId)}), voice_provider = COALESCE(voice_provider, ${sqlLiteral(approvedCharacterVoiceMetadata[coordinatorDefaultVoiceId].provider)}), job_title = ${sqlLiteral(COORDINATOR_DEFAULT_JOB_TITLE)}, about = CASE WHEN about IS NULL OR about = ${sqlLiteral(COORDINATOR_LEGACY_ABOUT)} THEN ${sqlLiteral(COORDINATOR_DEFAULT_ABOUT)} ELSE about END WHERE agent_id = ${parsed};`
      );
      return {
        agentId: parsed,
        firstName: 'T-W1N',
        surname: '',
        userId,
        organizationId,
        isCoordinator: true,
        selfContactId: COORDINATOR_SELF_CONTACT_ID,
        bossContactId: COORDINATOR_BOSS_CONTACT_ID,
      };
    }
  }

  return createAssistant({
    userId,
    ...(organizationId === null ? {} : { orgId: organizationId }),
    firstName: 'T-W1N',
    surname: null,
    jobTitle: COORDINATOR_DEFAULT_JOB_TITLE,
    isCoordinator: true,
    about: opts.about ?? COORDINATOR_DEFAULT_ABOUT,
    nationality: opts.nationality ?? 'United States',
    timezone: opts.timezone ?? null,
    age: null,
    weeklyLimit: null,
    maxParallel: null,
    desktopMode: opts.desktopMode ?? 'ubuntu',
    isLocal: false,
    profilePhoto: opts.profilePhoto,
    voiceId: coordinatorDefaultVoiceId,
    voiceProvider: approvedCharacterVoiceMetadata[coordinatorDefaultVoiceId].provider,
    selfContactId: COORDINATOR_SELF_CONTACT_ID,
    bossContactId: COORDINATOR_BOSS_CONTACT_ID,
    bossResponsePolicy: null, // Coordinator uses an empty response policy
  });
}

/** Create the user's personal (non-org) Coordinator. */
export function createPersonalCoordinator(
  userId: string,
  opts: CreateWorkspaceCoordinatorOpts = {}
): SeededAssistant {
  return createWorkspaceCoordinator(userId, null, opts);
}

// =============================================================================
// Workspace (BYOD email) connection
// =============================================================================

export interface ConnectWorkspaceEmailOpts {
  assistantId: number;
  /** BYOD mailbox address. Defaults to a unique seed address. */
  email?: string;
  provider?: 'google_workspace' | 'microsoft_365';
}

/**
 * Connect an assistant to a user-provisioned (BYOD) workspace mailbox,
 * mirroring the contact row the workspace OAuth callback writes
 * (`provisioned_by = 'user'`). Orchestra derives the Coordinator
 * onboarding `workspace` step as complete from exactly this row, so
 * seeding it reproduces "the user connected their workspace in an
 * earlier session" without any OAuth flow.
 */
export function connectWorkspaceEmail(opts: ConnectWorkspaceEmailOpts): string {
  const email = opts.email ?? `seed-workspace-${Date.now()}@example.com`;
  const provider = opts.provider ?? 'google_workspace';
  // Only one active row may exist per (assistant_id, contact_type) —
  // retire any platform-provisioned mailbox first, exactly like the
  // OAuth callback path does before writing the BYOD row.
  dbExecBlock(`
UPDATE assistant_contacts SET status = 'deleted', deleted_at = NOW()
WHERE assistant_id = ${opts.assistantId} AND contact_type = 'email' AND status != 'deleted';
INSERT INTO assistant_contacts (assistant_id, contact_type, contact_value, provider, provisioned_by, status)
VALUES (${opts.assistantId}, 'email', ${sqlLiteral(email)}, ${sqlLiteral(provider)}, 'user', 'active');
`);
  return email;
}

export interface CreateTeamForAssistantOpts {
  name?: string;
  description?: string;
  selfContactId?: number;
  bossContactId?: number;
}

function seedAssistantTeamMembership(
  targetAssistant: SeededAssistant,
  teamId: number,
  addedBy: string,
  opts: Pick<CreateTeamForAssistantOpts, 'selfContactId' | 'bossContactId'> = {}
): void {
  const selfContactId = opts.selfContactId ?? targetAssistant.selfContactId;
  const bossContactId = opts.bossContactId ?? targetAssistant.bossContactId;

  dbExecBlock(`
INSERT INTO team_assistant_memberships (team_id, assistant_id, added_by)
VALUES (${teamId}, ${targetAssistant.agentId}, '${addedBy}')
ON CONFLICT DO NOTHING;

INSERT INTO contact_memberships (
  assistant_id,
  contact_id,
  target_scope,
  target_team_id,
  relationship,
  should_respond,
  response_policy,
  can_edit
)
VALUES
  (${targetAssistant.agentId}, ${selfContactId}, 'team', ${teamId}, 'self', true, '', true),
  (${targetAssistant.agentId}, ${bossContactId}, 'team', ${teamId}, 'boss', true, '', true)
ON CONFLICT DO NOTHING;
`);
}

export function createTeamForAssistant(
  targetAssistant: SeededAssistant,
  opts: CreateTeamForAssistantOpts = {}
): SeededTeam {
  if (targetAssistant.organizationId === null) {
    throw new Error('createTeamForAssistant requires an org-scoped assistant');
  }

  const suffix = Date.now();
  const name = opts.name ?? `Assistant Team ${suffix}`;
  const description =
    opts.description ?? 'Shared organization team seeded for assistant browser coverage.';
  const rawTeamId = dbExec(`
INSERT INTO team (name, description, organization_id, status)
VALUES (
  '${sqlString(name)}',
  '${sqlString(description)}',
  ${targetAssistant.organizationId},
  'active'
)
RETURNING id;
`);
  const teamId = Number(rawTeamId.match(/^\d+$/m)?.[0]);
  if (!Number.isInteger(teamId)) {
    throw new Error(`Failed to parse seeded team id from psql output: ${rawTeamId}`);
  }

  seedAssistantTeamMembership(targetAssistant, teamId, targetAssistant.userId, opts);

  return {
    teamId,
    name,
    description,
    organizationId: targetAssistant.organizationId,
  };
}

export function addAssistantToTeam(
  targetAssistant: SeededAssistant,
  team: SeededTeam,
  opts: Pick<CreateTeamForAssistantOpts, 'selfContactId' | 'bossContactId'> = {}
): void {
  seedAssistantTeamMembership(targetAssistant, team.teamId, targetAssistant.userId, opts);
}

export interface SeededChatGroup {
  groupId: number;
  name: string;
  organizationId: number;
  createdByUserId: string;
}

export interface CreateChatGroupOpts {
  organizationId: number;
  name: string;
  createdByUserId: string;
  /** Human members (creator should be included). */
  userIds: string[];
  /** Assistant members (agent_id). */
  assistantIds?: number[];
}

/**
 * Insert a lightweight org chat group (humans + assistants) for seeds / E2E.
 * Mirrors Orchestra `chat_group` / `chat_group_member` — not a Team.
 */
export function createChatGroup(opts: CreateChatGroupOpts): SeededChatGroup {
  const { organizationId, name, createdByUserId, userIds, assistantIds = [] } = opts;
  const rawGroupId = dbExec(`
INSERT INTO chat_group (organization_id, name, created_by_user_id, status)
VALUES (
  ${organizationId},
  '${sqlString(name)}',
  '${sqlString(createdByUserId)}',
  'active'
)
RETURNING id;
`);
  const groupId = Number(rawGroupId.match(/^\d+$/m)?.[0]);
  if (!Number.isInteger(groupId)) {
    throw new Error(`Failed to parse seeded chat group id from psql output: ${rawGroupId}`);
  }

  const uniqueUserIds = [...new Set(userIds)];
  for (const userId of uniqueUserIds) {
    dbExec(`
INSERT INTO chat_group_member (group_id, user_id, assistant_id, role)
VALUES (${groupId}, '${sqlString(userId)}', NULL, 'member')
ON CONFLICT DO NOTHING;
`);
  }
  for (const assistantId of assistantIds) {
    dbExec(`
INSERT INTO chat_group_member (group_id, user_id, assistant_id, role)
VALUES (${groupId}, NULL, ${assistantId}, 'member')
ON CONFLICT DO NOTHING;
`);
  }

  return {
    groupId,
    name,
    organizationId,
    createdByUserId,
  };
}

// =============================================================================
// Project Primitives (required before creating secrets)
// =============================================================================

/**
 * Ensure a project exists in Orchestra. Creates it if missing (409 = already exists = OK).
 *
 * Secrets are stored as logs under the "Assistants" project, so this must be
 * called before {@link createSecret}.
 */
export async function ensureProject(apiKey: string, projectName = 'Assistants'): Promise<void> {
  const res = await orchestraFetch(
    '/v0/project',
    {
      method: 'POST',
      body: JSON.stringify({ name: projectName }),
    },
    apiKey
  );

  // 200 = created, 400 = already exists — both are fine
  if (!res.ok && res.status !== 400) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to ensure project '${projectName}': ${res.status} ${text}`);
  }
}

/**
 * Synchronous version of {@link ensureProject} using curl + execSync.
 * Safe to call at module scope or in synchronous setup code.
 */
export function ensureProjectSync(apiKey: string, projectName = 'Assistants'): void {
  try {
    execSync(
      `curl -s -o /dev/null -w "%{http_code}" -X POST ` +
        `-H "Authorization: Bearer ${apiKey}" ` +
        `-H "Content-Type: application/json" ` +
        `-d '{"name":"${projectName}"}' ` +
        `"${ORCHESTRA_BASE_URL}/v0/project"`,
      { encoding: 'utf-8', timeout: 10_000 }
    );
  } catch {
    // Best effort — project may already exist
  }
}

/**
 * Grant all members of an organization explicit `resource_access` to a project.
 *
 * Orchestra requires explicit ResourceAccess grants for org project access —
 * org membership alone is NOT sufficient. The project creation API only grants
 * access to the creator. This function fills the gap by granting access to
 * every org member based on their role.
 *
 * Call this AFTER `ensureProject` and `addMember` so the project and members exist.
 */
export function grantProjectAccessForOrg(orgId: number, projectName = 'Assistants'): void {
  dbExecBlock(`
DO \\$\\$
DECLARE
  _project_id integer;
  _member RECORD;
BEGIN
  SELECT p.id INTO _project_id
    FROM project p
   WHERE p.name = '${projectName}' AND p.organization_id = ${orgId}
   LIMIT 1;

  IF _project_id IS NULL THEN
    RAISE NOTICE 'Project ${projectName} not found for org %', ${orgId};
    RETURN;
  END IF;

  FOR _member IN
    SELECT om.user_id, om.role_id
      FROM organization_member om
     WHERE om.organization_id = ${orgId}
  LOOP
    INSERT INTO resource_access (resource_type, resource_id, role_id, grantee_type, grantee_id)
    VALUES ('project', _project_id, _member.role_id, 'user', _member.user_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END
\\$\\$;
`);
}

// =============================================================================
// Secret Primitives (via Console API / Logs system)
// =============================================================================

export interface CreateSecretOpts {
  /** API key of the user creating the secret */
  apiKey: string;
  /** User ID of the secret creator */
  userId: string;
  /** Assistant agent_id */
  assistantId: number;
  /** Secret name */
  name: string;
  /** Secret value */
  value: string;
  /** Optional description */
  description?: string;
}

/**
 * Create a secret via the Console API (logs/context system).
 *
 * This mirrors how the actual `createSecret` server action works — posting
 * a log entry to the Assistants project with the per-assistant context.
 *
 * Automatically ensures the "Assistants" project exists first.
 * Requires Console + Orchestra to be running.
 */
export async function createSecret(opts: CreateSecretOpts): Promise<SeededSecret> {
  await ensureProject(opts.apiKey, 'Assistants');

  const context = `${opts.userId}/${opts.assistantId}/Secrets`;
  const entries = {
    name: opts.name,
    value: opts.value,
    ...(opts.description ? { description: opts.description } : {}),
    _user: opts.userId,
    _user_id: opts.userId,
    _assistant: String(opts.assistantId),
    _assistant_id: String(opts.assistantId),
  };

  const body = {
    projectName: 'Assistants',
    context,
    entries: [entries],
  };

  const res = await apiFetch(
    '/api/logs',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    opts.apiKey
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to create secret '${opts.name}': ${res.status} ${text}`);
  }

  const data = await res.json();
  const logIds: number[] | undefined = data?.logEventIds;

  return {
    name: opts.name,
    description: opts.description,
    logId: logIds?.[0],
  };
}

// =============================================================================
// Secret Seeding (direct to Orchestra, works before Console starts)
// =============================================================================

export interface SeedSecretEntry {
  name: string;
  value: string;
  description?: string;
}

export interface SeedSecretsOpts {
  apiKey: string;
  userId: string;
  assistantId: number;
  secrets: SeedSecretEntry[];
}

/**
 * Seed secrets directly via Orchestra's logs API (no Console needed).
 *
 * Unlike {@link createSecret} which goes through Console's `/api/logs`,
 * this function talks to Orchestra directly so it works during the seed
 * phase before Console is running.
 */
export async function seedSecretsViaOrchestra(opts: SeedSecretsOpts): Promise<SeededSecret[]> {
  await ensureProject(opts.apiKey, 'Assistants');

  const allEntries = opts.secrets.map((s) => ({
    name: s.name,
    value: s.value,
    ...(s.description ? { description: s.description } : {}),
    _user: opts.userId,
    _user_id: opts.userId,
    _assistant: String(opts.assistantId),
    _assistant_id: String(opts.assistantId),
  }));

  const context = `${opts.userId}/${opts.assistantId}/Secrets`;

  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context,
        entries: allEntries,
      }),
    },
    opts.apiKey
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to seed secrets in context '${context}': ${res.status} ${text}`);
  }

  const data = await res.json();
  const logIds: number[] | undefined = data?.logEventIds;

  return opts.secrets.map((s, i) => ({
    name: s.name,
    description: s.description,
    logId: logIds?.[i],
  }));
}

// =============================================================================
// Chat Infrastructure (Contacts + Transcripts contexts for assistant chat)
// =============================================================================

export interface SeedChatOpts {
  apiKey: string;
  userId: string;
  assistantId: number;
  email: string;
  /**
   * Optional contact id to write into the seeded `Contacts` row.
   *
   * Defaults to the regular seeded-assistant owner contact (43). For
   * Coordinators pass `1` so the Contacts row matches the contact
   * membership wired by `createPersonalCoordinator`. The
   * {@link seedAssistantChatInfrastructure} helper picks this up
   * automatically from `SeededAssistant.bossContactId`.
   */
  bossContactId?: number;
}

/**
 * Seed the Orchestra project/context infrastructure required for assistant chat.
 *
 * Creates:
 *   - "Assistants" project (idempotent)
 *   - "{userId}/{assistantId}/Contacts" context with a contact log entry
 *     for the owning user (contactId defaults to 43; pass `bossContactId: 1`
 *     for Coordinators to match production's PERSONAL_BOSS_CONTACT_ID)
 *
 * Without this, the chat panel shows "Chat unavailable" because
 * getContactIdByEmail can't find the contact record.
 */
export async function seedChatInfrastructure(opts: SeedChatOpts): Promise<void> {
  await ensureProject(opts.apiKey, 'Assistants');

  const bossContactId = opts.bossContactId ?? OWNER_CONTACT_ID;

  const contactRes = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${opts.userId}/${opts.assistantId}/Contacts`,
        entries: [
          {
            email_address: opts.email,
            contactId: bossContactId,
          },
        ],
      }),
    },
    opts.apiKey
  );

  if (!contactRes.ok) {
    const text = await contactRes.text().catch(() => '');
    throw new Error(`Failed to seed contact: ${contactRes.status} ${text}`);
  }
}

/**
 * Seed chat infrastructure for a {@link SeededAssistant}, auto-selecting
 * the right `bossContactId` (0/1 for Coordinators, 42/43 for regular
 * seeded assistants).
 *
 * Convenience wrapper so scenarios can wire chat for both a primary
 * assistant and the user's Coordinator without repeating the
 * `bossContactId` switch in every call site.
 */
export async function seedAssistantChatInfrastructure(opts: {
  apiKey: string;
  user: { id: string; email: string };
  assistant: SeededAssistant;
}): Promise<void> {
  await seedChatInfrastructure({
    apiKey: opts.apiKey,
    userId: opts.user.id,
    assistantId: opts.assistant.agentId,
    email: opts.user.email,
    bossContactId: opts.assistant.bossContactId,
  });
}

/**
 * Seed chat infrastructure for every passed user's personal Coordinator
 * in sequence.
 *
 * Each user is keyed by their personal API key + email so the
 * `/v0/logs` write is attributed correctly. Users created with
 * `skipCoordinator: true` (no `coordinator` row) are silently skipped.
 *
 * This is the one-liner that lets scenarios make every seeded
 * workspace's Coordinator chat-ready:
 *
 * ```ts
 * const owner = createUser(...);
 * const member = createUser(...);
 * await seedCoordinatorChatForUsers([owner, member]);
 * ```
 */
export async function seedCoordinatorChatForUsers(users: SeededUser[]): Promise<void> {
  for (const user of users) {
    if (!user.coordinator) continue;
    await seedAssistantChatInfrastructure({
      apiKey: user.apiKey,
      user,
      assistant: user.coordinator,
    });
  }
}

// =============================================================================
// Action Events (ManagerMethod + ToolLoop for Live Actions panel)
// =============================================================================

export interface SeedActionEventsOpts {
  apiKey: string;
  userId: string;
  assistantId: number;
}

/**
 * Seed ManagerMethod events directly via Orchestra's logs API.
 *
 * These log entries populate the Live Actions panel's action tree.
 * Each entry represents one phase (incoming or outgoing) of a manager
 * method invocation. The console reads them from the context
 * `{userId}/{assistantId}/Events/ManagerMethod`.
 *
 * Entries must use **snake_case** keys (Orchestra stores them as JSONB;
 * the console converts to camelCase at read time).
 */
export async function seedManagerMethodEvents(
  opts: SeedActionEventsOpts,
  entries: Record<string, unknown>[]
): Promise<void> {
  await ensureProject(opts.apiKey, 'Assistants');

  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${opts.userId}/${opts.assistantId}/Events/ManagerMethod`,
        entries,
      }),
    },
    opts.apiKey
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to seed ManagerMethod events: ${res.status} ${text}`);
  }
}

/**
 * Seed ToolLoop events directly via Orchestra's logs API.
 *
 * These log entries populate the tool-loop detail view inside each
 * action node (LLM messages, tool calls, tool results). The console
 * reads them from `{userId}/{assistantId}/Events/ToolLoop`.
 *
 * Entries must use **snake_case** keys.
 */
export async function seedToolLoopEvents(
  opts: SeedActionEventsOpts,
  entries: Record<string, unknown>[]
): Promise<void> {
  await ensureProject(opts.apiKey, 'Assistants');

  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${opts.userId}/${opts.assistantId}/Events/ToolLoop`,
        entries,
      }),
    },
    opts.apiKey
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to seed ToolLoop events: ${res.status} ${text}`);
  }
}

// =============================================================================
// Email Login (password-based authentication)
// =============================================================================

export interface CreateEmailLoginOpts {
  userId: string;
  password?: string;
}

/**
 * Create an email-based login for a user (argon2 password hash).
 *
 * Resolves a Python with `argon2-cffi` available, in this order:
 *   1. `ORCHESTRA_PYTHON` env override (explicit path to a python binary).
 *   2. In-project venv at `$ORCHESTRA_REPO_PATH/.venv/bin/python`, if present.
 *      (Orchestra's `local.sh` only creates this when the user opts in;
 *      Poetry's default config uses a global cache instead.)
 *   3. `poetry run python` from the orchestra repo — works whether Poetry
 *      uses an in-project venv or a managed one in its cache.
 *
 * We deliberately don't ship a bare side-venv at `$ORCHESTRA_REPO_PATH/.venv`
 * just for argon2: Orchestra's `local.sh` and Poetry will both adopt that
 * venv on next start and break migrations (alembic missing).
 *
 * Uses `dbExecStdin` (pipe via stdin) instead of `dbExecBlock` because
 * argon2 hashes contain `$` characters that bash would interpret as
 * variable expansions in double-quoted `-c` arguments.
 */
const passwordHashCache = new Map<string, string>();

export function createEmailLogin(opts: CreateEmailLoginOpts): void {
  const password = opts.password ?? 'testpass123';

  // argon2 hashes are salted, so a single hash per password verifies for every
  // user that shares it. Generating one is a Python subprocess spawn; caching by
  // password collapses hundreds of spawns across a suite into one.
  const cachedHash = passwordHashCache.get(password);
  if (cachedHash) {
    dbExecStdin(
      `INSERT INTO email_account (user_id, password_hash, email_verified)
       VALUES ('${opts.userId}', '${cachedHash}', true)
       ON CONFLICT (user_id) DO NOTHING;`
    );
    return;
  }

  const orchestraPath =
    process.env.ORCHESTRA_REPO_PATH || path.resolve(__dirname, '../../../../..', 'orchestra');

  const hashScript = `from argon2 import PasswordHasher; print(PasswordHasher().hash('${password}'))`;
  const candidates: { cmd: string; cwd?: string }[] = [];
  if (process.env.ORCHESTRA_PYTHON) {
    candidates.push({
      cmd: `"${process.env.ORCHESTRA_PYTHON}" -c "${hashScript}"`,
    });
  }
  candidates.push({
    cmd: `"${orchestraPath}/.venv/bin/python" -c "${hashScript}"`,
  });
  // Discover Poetry's actual venv path (works whether it's in-project or in
  // ~/.cache/pypoetry). Done lazily — only invoked if earlier candidates fail.
  try {
    const poetryVenv = execSync(`poetry env info -p`, {
      encoding: 'utf-8',
      timeout: 10_000,
      cwd: orchestraPath,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (poetryVenv) {
      candidates.push({
        cmd: `"${poetryVenv}/bin/python" -c "${hashScript}"`,
      });
    }
  } catch {
    // Poetry may be unavailable; fall through to `poetry run` as a last resort.
  }
  candidates.push({
    cmd: `poetry run python -c "${hashScript}"`,
    cwd: orchestraPath,
  });

  let pwHash: string | undefined;
  let lastErr: unknown;
  for (const { cmd, cwd } of candidates) {
    try {
      pwHash = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 10_000,
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      if (pwHash) break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!pwHash) {
    console.warn(
      '[seed] Could not generate password hash — skipping email login',
      lastErr instanceof Error ? lastErr.message : lastErr
    );
    return;
  }

  passwordHashCache.set(password, pwHash);

  // Use stdin piping to avoid bash $-expansion mangling the argon2 hash
  dbExecStdin(
    `INSERT INTO email_account (user_id, password_hash, email_verified)
     VALUES ('${opts.userId}', '${pwHash}', true)
     ON CONFLICT (user_id) DO NOTHING;`
  );
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Delete a user and all related data (cascading).
 * Useful in afterAll() to clean up seed data.
 */
export function deleteUser(userId: string): void {
  dbExec(`DELETE FROM "user" WHERE id = '${userId}';`);
}

/**
 * Delete an organization and all related data (cascading).
 */
export function deleteOrg(orgId: number): void {
  dbExec(`DELETE FROM organization WHERE id = ${orgId};`);
}

// =============================================================================
// Real Test Helpers (shared by all integration tests)
// =============================================================================

/**
 * Check if the Console dev server is reachable.
 */
export async function isServerReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(CONSOLE_BASE_URL, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok || response.status === 307;
  } catch {
    return false;
  }
}

/**
 * Skip the test suite if the Console dev server is not reachable.
 * Call in `beforeAll` for integration tests.
 */
export async function skipIfServerNotReachable(): Promise<void> {
  const reachable = await isServerReachable();
  if (!reachable) {
    throw new Error(
      `Server at ${CONSOLE_BASE_URL} is not reachable. ` +
        'Start the dev server with `npm run dev` before running @real tests.'
    );
  }
}

/**
 * API error with status code and response body.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
    message?: string
  ) {
    super(message || `API error ${status}: ${JSON.stringify(body)}`);
    this.name = 'ApiError';
  }
}

/**
 * Authenticated fetch + JSON parse, throwing ApiError on non-2xx.
 */
export async function apiJson<T>(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<T> {
  const res = await apiFetch(endpoint, options, apiKey);
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/** Common test options for real API tests (disables MSW, 30s timeout). */
export const realTestOptions = {
  meta: { mock: false },
  timeout: 30_000,
} as const;

/** Extended test options for slower operations (60s timeout). */
export const realTestOptionsExtended = {
  meta: { mock: false },
  timeout: 60_000,
} as const;
