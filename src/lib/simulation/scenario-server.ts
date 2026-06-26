/**
 * Server-side active-scenario resolution from cookies.
 *
 * Separated from `scenario.ts` so the pure registry stays client-safe while the
 * cookie read (which pulls in `next/headers`) is confined to the server.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { mockApiKey, MOCK_PERSONA_COOKIE, MOCK_SCENARIO_COOKIE } from './config';
import { getPersona, getScenarioById } from './scenario';
import type { MockPersona, MockScenario } from './types';

export interface ActiveSimulation {
  scenario: MockScenario;
  persona: MockPersona;
  /** Active workspace id: 'personal' or an org id (as string). */
  workspaceId: string;
}

/** Reads the active scenario/persona for the current request. */
export async function getActiveSimulation(): Promise<ActiveSimulation> {
  const store = await cookies();
  const scenario = getScenarioById(store.get(MOCK_SCENARIO_COOKIE)?.value);
  const persona = getPersona(scenario, store.get(MOCK_PERSONA_COOKIE)?.value);
  return { scenario, persona, workspaceId: persona.workspaceId };
}

/** Resolves the active workspace API key (used by the boundary shims). */
export async function getActiveSimulationApiKey(): Promise<string> {
  const { scenario, workspaceId } = await getActiveSimulation();
  return mockApiKey(scenario.id, workspaceId);
}
