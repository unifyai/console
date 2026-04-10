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
}

export interface SeededOrg {
  /** Organization ID (integer) */
  id: number;
  name: string;
  ownerId: string;
  /** Org-scoped API key for the owner */
  ownerOrgApiKey: string;
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
}

export interface SeededSecret {
  name: string;
  description?: string;
  /** Log ID from the context system */
  logId?: number;
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
