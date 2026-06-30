'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MOCK_PERSONA_COOKIE, MOCK_SCENARIO_COOKIE } from '@/lib/simulation/config';
import { getPersona, getScenarioById } from '@/lib/simulation/scenario';
import { resetSession } from '@/lib/simulation/store';

/**
 * Establishes the active mock scenario/persona and drops the user into the real
 * shell. Resets the in-memory store so a freshly chosen scenario starts from its
 * pristine fixtures.
 */
export async function enterScenario(formData: FormData): Promise<void> {
  const scenarioId = String(formData.get('scenarioId') ?? '');
  const personaId = String(formData.get('personaId') ?? '');

  const scenario = getScenarioById(scenarioId);
  const persona = getPersona(scenario, personaId);

  const store = await cookies();
  store.set(MOCK_SCENARIO_COOKIE, scenario.id, { path: '/' });
  store.set(MOCK_PERSONA_COOKIE, persona.id, { path: '/' });

  resetSession(scenario.id);
  redirect('/assistants');
}
