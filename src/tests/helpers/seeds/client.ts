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
import type { OrgRole, SeededUser, SeededOrg, SeededAssistant, SeededSecret } from './types';

// =============================================================================
// Configuration
// =============================================================================

const DB_CONTAINER = process.env.ORCHESTRA_DB_CONTAINER || 'orchestra-local-db';
const CONSOLE_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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
  /** Initial credits (default: 10000) */
  credits?: number;
}

/**
 * Create a user with a billing account and API key.
 *
 * Idempotent: skips if user with this ID already exists.
 */
export function createUser(opts: CreateUserOpts = {}): SeededUser {
  const id = opts.id ?? uniqueUserId();
  const email = opts.email ?? uniqueEmail();
  const name = opts.name ?? 'Seed';
  const lastName = opts.lastName ?? 'User';
  const apiKey = opts.apiKey ?? uniqueApiKey();
  const credits = opts.credits ?? 10000;

  dbExecBlock(`
DO \\$\\$
DECLARE
  _ba_id integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" WHERE id = '${id}') THEN
    INSERT INTO billing_account (credits, autorecharge, autorecharge_threshold, autorecharge_qty, account_status, tier)
    VALUES (${credits}, false, 0, 25, 'ACTIVE', 'developer')
    RETURNING id INTO _ba_id;

    INSERT INTO "user" (id, email, name, last_name, billing_account_id, store_prompts)
    VALUES ('${id}', '${email}', '${name}', '${lastName}', _ba_id, true);

    INSERT INTO api_key (user_id, key, name)
    VALUES ('${id}', '${apiKey}', 'Seed Key')
    ON CONFLICT (key) DO NOTHING;
  END IF;
END
\\$\\$;
`);

  return { id, email, name, lastName, apiKey };
}

// =============================================================================
// Organization Primitives
// =============================================================================

export interface CreateOrgOpts {
  name?: string;
  ownerId: string;
  /** Credits for the org billing account (default: 10000) */
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
  const credits = opts.credits ?? 10000;

  // Check if org already exists for this owner
  const existingId = dbExec(
    `SELECT id FROM organization WHERE owner_id = '${opts.ownerId}' LIMIT 1;`
  );

  if (existingId) {
    const existingKey = dbExec(
      `SELECT key FROM api_key WHERE user_id = '${opts.ownerId}' AND organization_id = ${existingId} LIMIT 1;`
    );
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
  _owner_role_id integer;
BEGIN
  INSERT INTO billing_account (credits, autorecharge, autorecharge_threshold, autorecharge_qty, account_status, tier)
  VALUES (${credits}, false, 0, 25, 'ACTIVE', 'developer')
  RETURNING id INTO _ba_id;

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
  surname?: string;
  profilePhoto?: string;
}

/**
 * Create an assistant via direct SQL (bypasses billing checks).
 *
 * Ensures a voice preset exists before creating.
 */
export function createAssistant(opts: CreateAssistantOpts): SeededAssistant {
  const firstName = opts.firstName ?? 'Seed';
  const surname = opts.surname ?? 'Assistant';

  ensureVoicePreset(opts.userId);

  const orgClause = opts.orgId != null ? `${opts.orgId}` : 'NULL';
  const photoClause = opts.profilePhoto ? `'${opts.profilePhoto}'` : 'NULL';

  dbExecBlock(`
INSERT INTO assistants (user_id, first_name, surname, age, nationality, timezone, about, voice_id, voice_provider, weekly_limit, max_parallel, organization_id, is_local, profile_photo)
VALUES (
  '${opts.userId}',
  '${firstName}',
  '${surname}',
  30,
  'United States',
  'America/New_York',
  'Seed test assistant for automated testing.',
  '9BWtsMINqrJLrRacOk9x',
  'elevenlabs',
  40,
  10,
  ${orgClause},
  true,
  ${photoClause}
);
`);

  const agentId = dbExec(
    `SELECT agent_id FROM assistants WHERE user_id = '${opts.userId}' AND first_name = '${firstName}' AND surname = '${surname}' ORDER BY agent_id DESC LIMIT 1;`
  );

  return {
    agentId: parseInt(agentId, 10),
    firstName,
    surname,
    userId: opts.userId,
    organizationId: opts.orgId ?? null,
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
}

/**
 * Seed the Orchestra project/context infrastructure required for assistant chat.
 *
 * Creates:
 *   - "Assistants" project (idempotent)
 *   - "{userId}/{assistantId}/Contacts" context with a contact log entry (contactId=1 for owner)
 *
 * Without this, the chat panel shows "Chat unavailable" because
 * getContactIdByEmail can't find the contact record.
 */
export async function seedChatInfrastructure(opts: SeedChatOpts): Promise<void> {
  await ensureProject(opts.apiKey, 'Assistants');

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
            contactId: 1,
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
 * Requires the Orchestra Python venv to have argon2-cffi installed.
 *
 * Uses `dbExecStdin` (pipe via stdin) instead of `dbExecBlock` because
 * argon2 hashes contain `$` characters that bash would interpret as
 * variable expansions in double-quoted `-c` arguments.
 */
export function createEmailLogin(opts: CreateEmailLoginOpts): void {
  const password = opts.password ?? 'testpass123';

  const orchestraPath =
    process.env.ORCHESTRA_REPO_PATH || path.resolve(__dirname, '../../../../..', 'orchestra');
  let pwHash: string;

  try {
    pwHash = execSync(
      `"${orchestraPath}/.venv/bin/python" -c "from argon2 import PasswordHasher; print(PasswordHasher().hash('${password}'))"`,
      { encoding: 'utf-8', timeout: 10_000 }
    ).trim();
  } catch {
    // Fallback: skip email login creation if Python is unavailable
    console.warn('[seed] Could not generate password hash — skipping email login');
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
