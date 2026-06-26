/**
 * In-memory mutable session store for mock simulation mode.
 *
 * Mutations (create/edit/delete) update a per-process clone of a scenario's
 * fixtures so interactions feel real within a session, then reset on reload /
 * server restart (the module is re-imported with fresh fixtures). Nothing is
 * ever written to Orchestra.
 */

import { getScenarioById } from './scenario';
import type { MockBrainEntry, MockScenario } from './types';

type MutableScenario = {
  assistants: MockScenario['assistants'];
  projects: MockScenario['projects'];
  brain: MockBrainEntry[];
  billing: MockScenario['billing'];
  transactions: MockScenario['transactions'];
};

const sessions = new Map<string, MutableScenario>();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Returns the mutable working copy for a scenario, cloning fixtures on first use. */
export function getSession(scenarioId: string): MutableScenario {
  const existing = sessions.get(scenarioId);
  if (existing) return existing;

  const scenario = getScenarioById(scenarioId);
  const working: MutableScenario = {
    assistants: clone(scenario.assistants),
    projects: clone(scenario.projects),
    brain: clone(scenario.brain),
    billing: clone(scenario.billing),
    transactions: clone(scenario.transactions),
  };
  sessions.set(scenarioId, working);
  return working;
}

let nextBrainId = 50_000;

export function addBrainEntry(
  scenarioId: string,
  section: string,
  fields: Record<string, unknown>
): MockBrainEntry {
  const session = getSession(scenarioId);
  const entry: MockBrainEntry = {
    id: ++nextBrainId,
    section,
    fields,
    createdAt: new Date().toISOString(),
  };
  session.brain.unshift(entry);
  return entry;
}

export function deleteBrainEntry(scenarioId: string, id: number): boolean {
  const session = getSession(scenarioId);
  const before = session.brain.length;
  session.brain = session.brain.filter((e) => e.id !== id);
  return session.brain.length < before;
}

/** Clears all session state (used by the entry route when switching scenarios). */
export function resetSession(scenarioId: string): void {
  sessions.delete(scenarioId);
}
