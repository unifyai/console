/**
 * Types for the modular seed system.
 *
 * Each seed scenario returns a SeededState describing everything it created,
 * giving tests typed access to credentials, IDs, and relationships.
 */

// =============================================================================
// Primitive Types
// =============================================================================

export type OrgRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';

export interface SeededUser {
  /** User ID (UUID string) */
  id: string;
  email: string;
  name: string;
  lastName: string;
  /** API key for authenticating requests */
  apiKey: string;
  /**
   * The user's personal Coordinator assistant. Auto-provisioned by
   * {@link createUser} so every seeded user mirrors the production
   * signup hook — one personal Coordinator per user with
   * `organization_id IS NULL` and `is_coordinator = true`.
   *
   * Will be `null` only when the caller passed `skipCoordinator: true`
   * to {@link createUser} (rare — reserved for scenarios that exercise
   * the backfill path explicitly).
   */
  coordinator: SeededAssistant | null;
}

export interface SeededOrg {
  /** Organization ID (integer) */
  id: number;
  name: string;
  ownerId: string;
  /** Org-scoped API key for the owner */
  ownerOrgApiKey: string;
  /** The owner's workspace Coordinator, provisioned with the org. */
  coordinator: SeededAssistant;
}

export interface SeededAssistant {
  /** agent_id primary key */
  agentId: number;
  firstName: string;
  surname: string;
  /** User who created the assistant */
  userId: string;
  /** Organization ID (null for personal assistants) */
  organizationId: number | null;
  /** Whether the row is the workspace Coordinator */
  isCoordinator: boolean;
  /** Contact row used for assistant-authored messages. */
  selfContactId: number;
  /** Contact row used for owner-authored messages. */
  bossContactId: number;
}

export interface SeededTeam {
  /** team.id primary key */
  teamId: number;
  name: string;
  description: string;
  organizationId: number;
}

export interface SeededSecret {
  name: string;
  description?: string;
  /** Log ID from the context system */
  logId?: number;
}

export interface SeededUserDesktop {
  /** user_desktops.id primary key */
  id: number;
  /** Owner of the registered machine */
  userId: string;
  name: string;
  os: string;
  url: string;
}

export interface SeededMsTeamsBotInstall {
  /** ms_teams_bot_installs.id primary key */
  id: number;
  /** Microsoft tenant id the bot is installed into */
  tenantId: string;
  tenantName: string | null;
  botAppId: string;
  /** Handshake nonce for a pending (unbound) install; null once bound */
  bindNonce: string | null;
  /** Bound org id (null while pending) */
  organizationId: number | null;
}

// =============================================================================
// Credential Bag
// =============================================================================

export interface SeededCredentials {
  email: string;
  /** Password for email-based login (default: testpass123) */
  password: string;
  apiKey: string;
  userId: string;
}

// =============================================================================
// Scenario State (returned by seed functions)
// =============================================================================

/**
 * Complete state returned by a seed scenario.
 *
 * All fields are optional because different scenarios create different things.
 * Each scenario documents which fields it populates.
 */
export interface SeededState {
  /** Named users created by this scenario */
  users: Record<string, SeededUser>;

  /** Organization (if created) */
  org?: SeededOrg;

  /** Assistants created by this scenario */
  assistants: SeededAssistant[];

  /** Secrets created (via Console API, not raw SQL) */
  secrets?: SeededSecret[];

  /** Registered user desktops created by this scenario */
  desktops?: SeededUserDesktop[];

  /**
   * Named credentials for quick access in tests.
   *
   * @example
   * ```ts
   * const state = await seedOrgMultiRole();
   * const res = await secretApi.list(assistantId, 'alice', state.credentials.owner.apiKey);
   * ```
   */
  credentials: Record<string, SeededCredentials>;
}

// =============================================================================
// Scenario Registry
// =============================================================================

/**
 * A seed scenario is an async function that creates DB state and returns
 * a typed description of what was created.
 */
export type SeedScenario = () => Promise<SeededState>;
