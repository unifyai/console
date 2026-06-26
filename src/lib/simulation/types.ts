/**
 * App-safe fixture shapes for mock simulation mode.
 *
 * These intentionally live in app code (not `src/tests/`) so the simulation
 * runtime never imports test-only helpers. They model the structure used by the
 * seed scenarios in `src/tests/helpers/seeds/types.ts`, kept deliberately small:
 * fixtures only need to carry enough to render the revamped surfaces.
 */

export type MockOrgRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';

export interface MockOrg {
  id: number;
  name: string;
  ownerId: string;
  roleId: number;
  roleName: MockOrgRole;
  apiKey: string;
  image?: string | null;
  freeTrial?: boolean;
}

export interface MockUser {
  id: string;
  name: string;
  lastName: string;
  jobTitle: string;
  bio: string;
  image: string;
  email: string;
  timezone: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  discordId: string | null;
  createdAt: string;
  /** Personal-workspace API key. */
  apiKey: string;
  stripeCustomerId: string;
  organizations: MockOrg[];
}

export interface MockAssistant {
  agentId: number;
  firstName: string;
  surname: string;
  userId: string;
  organizationId: number | null;
  isCoordinator: boolean;
  jobTitle?: string;
  bio?: string;
  photoUrl?: string | null;
  status?: 'active' | 'idle' | 'hiring';
}

export interface MockProject {
  name: string;
  description?: string;
  createdAt: string;
}

/** A single Orchestra-style log row backing the Brain panes (snake_case-free, app-shaped). */
export interface MockBrainEntry {
  id: number;
  /** Brain section the entry belongs to (Contacts/Transcripts/Knowledge/…). */
  section: string;
  /** Arbitrary, surface-specific fields rendered by the table view. */
  fields: Record<string, unknown>;
  createdAt: string;
}

export interface MockBillingState {
  balance: number | null;
  nextPayment: number | null;
  minCutoff: number | null;
  freeTrial: boolean;
  autoReloadEnabled: boolean;
}

export interface MockTransaction {
  id: string;
  category: string;
  amount: number;
  description: string;
  createdAt: string;
  assistantId?: string;
}

/**
 * A persona is one selectable identity within a scenario (e.g. the org owner vs
 * a viewer). The active workspace decides which API key the boundary shims hand
 * back, which in turn drives org-vs-personal data.
 */
export interface MockPersona {
  id: string;
  label: string;
  /** Workspace the persona lands in: 'personal' or an org id (as string). */
  workspaceId: string;
}

export interface MockScenario {
  id: string;
  label: string;
  description: string;
  user: MockUser;
  assistants: MockAssistant[];
  projects: MockProject[];
  brain: MockBrainEntry[];
  billing: MockBillingState;
  transactions: MockTransaction[];
  personas: MockPersona[];
}
