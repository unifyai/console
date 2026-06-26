/**
 * Scenario registry for mock simulation mode.
 *
 * A scenario bundles a mock identity, its workspaces, and the fixture data that
 * backs every revamped surface. Scenarios mirror the real seed catalogue
 * (personal vs org, rich vs empty, billing edge states) so the mock catalogue
 * doubles as a visual smoke checklist.
 *
 * This module is pure (no `next/headers`) so it is safe to import on the client
 * for the scenario switcher. Cookie-based active-scenario resolution lives in
 * `scenario-server.ts`.
 */

import type { MockScenario } from './types';
import { orgOwnerUser, personalUser, orgPersonas, soloPersonas } from './fixtures/users';
import { orgAssistants, personalAssistants } from './fixtures/assistants';
import { brainEntries, emptyBrainEntries } from './fixtures/brain';
import {
  freeTrialBilling,
  healthyBilling,
  lowBalanceBilling,
  projects,
  transactions,
} from './fixtures/billing';

const personalWorkspace: MockScenario = {
  id: 'personal-workspace',
  label: 'Personal workspace',
  description: 'Single user, personal coordinator, a couple of assistants.',
  user: personalUser,
  assistants: personalAssistants,
  projects,
  brain: brainEntries,
  billing: healthyBilling,
  transactions,
  personas: soloPersonas,
};

const orgMultiRole: MockScenario = {
  id: 'org-multi-role',
  label: 'Organization (owner)',
  description: 'Org workspace with several assistants and a populated brain.',
  user: orgOwnerUser,
  assistants: orgAssistants,
  projects,
  brain: brainEntries,
  billing: healthyBilling,
  transactions,
  personas: orgPersonas,
};

const emptyState: MockScenario = {
  id: 'empty-state',
  label: 'Empty workspace',
  description: 'Fresh account — empty states across every surface.',
  user: { ...personalUser, jobTitle: '' },
  assistants: personalAssistants.filter((a) => a.isCoordinator),
  projects: projects.slice(0, 1),
  brain: emptyBrainEntries,
  billing: freeTrialBilling,
  transactions: [],
  personas: soloPersonas,
};

const billingBanner: MockScenario = {
  id: 'billing-banner',
  label: 'Billing — low balance',
  description: 'Exercises the low-balance / auto-reload-off banner states.',
  user: personalUser,
  assistants: personalAssistants,
  projects,
  brain: brainEntries,
  billing: lowBalanceBilling,
  transactions,
  personas: soloPersonas,
};

const SCENARIOS: MockScenario[] = [personalWorkspace, orgMultiRole, emptyState, billingBanner];

export const DEFAULT_SCENARIO_ID = personalWorkspace.id;

export function listScenarios(): MockScenario[] {
  return SCENARIOS;
}

export function getScenarioById(id: string | null | undefined): MockScenario {
  return SCENARIOS.find((s) => s.id === id) ?? personalWorkspace;
}

/** Resolves the persona within a scenario, defaulting to the first one. */
export function getPersona(scenario: MockScenario, personaId: string | null | undefined) {
  return scenario.personas.find((p) => p.id === personaId) ?? scenario.personas[0];
}
