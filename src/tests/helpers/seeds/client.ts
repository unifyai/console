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
} from './types';

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
}

/**
 * Create an organization and add the owner as a member with the Owner role.
 *
 * Returns the created org including the owner's org-scoped API key.
 * Idempotent: if an org with the same owner already exists, returns the
 * existing one (looks up the existing org API key from the DB).
 */
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
    return {
      id: parseInt(existingId, 10),
      name,
      ownerId: opts.ownerId,
      ownerOrgApiKey: existingKey,
    };
  }

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

  return {
    id: parseInt(orgId, 10),
    name,
    ownerId: opts.ownerId,
    ownerOrgApiKey: ownerOrgKey,
  };
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
 * Idempotent: skips if the member already exists.
 */
export function addMember(opts: AddMemberOpts): string {
  const orgApiKey = uniqueApiKey('member');

  dbExecBlock(`
DO \\$\\$
DECLARE
  _role_id integer;
BEGIN
  SELECT id INTO _role_id FROM role WHERE name = '${opts.role}' AND is_system_role = true LIMIT 1;

  INSERT INTO organization_member (organization_id, user_id, role_id)
  VALUES (${opts.orgId}, '${opts.userId}', _role_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO api_key (user_id, organization_id, key, name)
  VALUES ('${opts.userId}', ${opts.orgId}, '${orgApiKey}', 'Member Key')
  ON CONFLICT (key) DO NOTHING;
END
\\$\\$;
`);

  return orgApiKey;
}

// =============================================================================
// Voice Preset (required FK for assistants)
// =============================================================================

/**
 * Ensure at least one voice preset exists (required FK for assistants).
 */
export function ensureVoicePreset(userId: string): void {
  dbExecBlock(`
INSERT INTO voices (voice_id, user_id, name, description, gender, language, is_preset, provider)
VALUES (
  '9BWtsMINqrJLrRacOk9x',
  '${userId}',
  'English Female Husky 1',
  'A middle-aged female with an African-American accent.',
  'female',
  'en',
  true,
  'elevenlabs'
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
// Personal Coordinator
// =============================================================================

/**
 * Options for {@link createPersonalCoordinator}.
 *
 * The shape intentionally excludes fields that are fixed by Coordinator
 * semantics (org scoping, name, `is_coordinator`, contact IDs). The few
 * remaining knobs are mostly for test variants — e.g. seeding a specific
 * `timezone` or `profilePhoto`.
 */
export type CreatePersonalCoordinatorOpts = Pick<
  CreateAssistantOpts,
  'timezone' | 'profilePhoto' | 'about' | 'desktopMode' | 'nationality'
>;

/**
 * Create the user's personal Coordinator.
 *
 * Mirrors Orchestra's `create_coordinator_assistant`:
 *   - `first_name = 'Unity'`, `surname = NULL`, `job_title = 'Unity'`
 *   - `nationality = 'United States'`, `desktop_mode = 'ubuntu'`
 *   - All numeric/voice fields default to NULL (no weekly limit, no voice yet)
 *   - `is_coordinator = TRUE`, `organization_id = NULL`
 *   - Personal contact memberships pinned to `self=0` / `boss=1`
 *
 * Idempotent — if the user already has a personal Coordinator the
 * existing row is returned without re-inserting (matches the partial
 * unique index on `(user_id) WHERE is_coordinator AND organization_id IS NULL`).
 */
export function createPersonalCoordinator(
  userId: string,
  opts: CreatePersonalCoordinatorOpts = {}
): SeededAssistant {
  const existingId = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = ${sqlLiteral(userId)} AND is_coordinator = TRUE AND organization_id IS NULL LIMIT 1;`
  );
  if (existingId) {
    const parsed = parseInt(existingId, 10);
    if (Number.isFinite(parsed)) {
      return {
        agentId: parsed,
        firstName: 'Unity',
        surname: '',
        userId,
        organizationId: null,
        isCoordinator: true,
        selfContactId: COORDINATOR_SELF_CONTACT_ID,
        bossContactId: COORDINATOR_BOSS_CONTACT_ID,
      };
    }
  }

  return createAssistant({
    userId,
    firstName: 'Unity',
    surname: null,
    jobTitle: 'Unity',
    isCoordinator: true,
    about: opts.about ?? 'Coordinates setup and shared assistant memory.',
    nationality: opts.nationality ?? 'United States',
    timezone: opts.timezone ?? null,
    age: null,
    voiceId: null,
    voiceProvider: null,
    weeklyLimit: null,
    maxParallel: null,
    desktopMode: opts.desktopMode ?? 'ubuntu',
    isLocal: false,
    profilePhoto: opts.profilePhoto,
    selfContactId: COORDINATOR_SELF_CONTACT_ID,
    bossContactId: COORDINATOR_BOSS_CONTACT_ID,
    bossResponsePolicy: null, // Coordinator uses an empty response policy
  });
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
export function createEmailLogin(opts: CreateEmailLoginOpts): void {
  const password = opts.password ?? 'testpass123';

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
