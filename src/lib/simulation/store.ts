/**
 * In-memory mutable session store for mock simulation mode.
 *
 * Mutations (create/edit/delete) update a per-process clone of a scenario's
 * fixtures so interactions feel real within a session, then reset on reload /
 * server restart (the module is re-imported with fresh fixtures). Nothing is
 * ever written to Orchestra.
 *
 * Tables are keyed by the context path *relative* to the assistant/team prefix
 * (e.g. `Contacts`, `Tasks/Executions`, `Knowledge`). The dispatcher resolves
 * the prefix and looks up rows by this relative path.
 */

import { getScenarioById } from './scenario';
import { buildTables } from './fixtures/tables';
import type { MockRow, MockScenario, MockTables } from './types';

export interface MockFavourite {
  id: number;
  projectName: string;
  icon: string;
  position: number;
}

type MutableScenario = {
  assistants: MockScenario['assistants'];
  projects: MockScenario['projects'];
  tables: MockTables;
  billing: MockScenario['billing'];
  transactions: MockScenario['transactions'];
  /** Pinned project favourites for the favourites surface. */
  favourites: MockFavourite[];
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
    tables: clone(buildTables(scenario.dataset)),
    billing: clone(scenario.billing),
    transactions: clone(scenario.transactions),
    favourites: [],
  };
  sessions.set(scenarioId, working);
  return working;
}

/** Returns the rows for a table path, creating the bucket on demand. */
export function getTable(scenarioId: string, tablePath: string): MockRow[] {
  const session = getSession(scenarioId);
  if (!session.tables[tablePath]) {
    session.tables[tablePath] = [];
  }
  return session.tables[tablePath];
}

let nextRowId = 50_000;

/** Assigns a stable synthetic log id to a row position within a table. */
export function rowLogId(tablePath: string, index: number, row: MockRow): number {
  const explicit =
    (row.contactId as number) ??
    (row.taskId as number) ??
    (row.messageId as number) ??
    (row.knowledgeId as number) ??
    (row.functionId as number) ??
    (row.guidanceId as number);
  if (typeof explicit === 'number') return explicit;
  // Deterministic fallback so deletes target a stable id within a session.
  return 100_000 + hashPath(tablePath) + index;
}

function hashPath(path: string): number {
  let h = 0;
  for (let i = 0; i < path.length; i += 1) {
    h = (h * 31 + path.charCodeAt(i)) % 10_000;
  }
  return h * 1_000;
}

export function addRow(scenarioId: string, tablePath: string, fields: MockRow): MockRow {
  const table = getTable(scenarioId, tablePath);
  const row: MockRow = { ...fields };
  if (typeof row.contactId !== 'number' && typeof row.taskId !== 'number') {
    row.__id = ++nextRowId;
  }
  table.unshift(row);
  return row;
}

export function updateRow(
  scenarioId: string,
  tablePath: string,
  logId: number,
  fields: MockRow
): boolean {
  const table = getTable(scenarioId, tablePath);
  const index = table.findIndex((row, i) => rowLogId(tablePath, i, row) === logId);
  if (index < 0) return false;
  table[index] = { ...table[index], ...fields };
  return true;
}

export function deleteRow(scenarioId: string, tablePath: string, logId: number): boolean {
  const session = getSession(scenarioId);
  const table = session.tables[tablePath];
  if (!table) return false;
  const before = table.length;
  session.tables[tablePath] = table.filter((row, i) => rowLogId(tablePath, i, row) !== logId);
  return session.tables[tablePath].length < before;
}

let nextFavouriteId = 7_000;

export function listFavourites(scenarioId: string): MockFavourite[] {
  return getSession(scenarioId).favourites;
}

export function addFavourite(
  scenarioId: string,
  projectName: string,
  icon: string,
  position: number
): MockFavourite {
  const session = getSession(scenarioId);
  const favourite: MockFavourite = { id: ++nextFavouriteId, projectName, icon, position };
  session.favourites.push(favourite);
  return favourite;
}

export function updateFavouriteById(
  scenarioId: string,
  id: number,
  updates: { icon?: string; position?: number }
): MockFavourite | null {
  const session = getSession(scenarioId);
  const favourite = session.favourites.find((f) => f.id === id);
  if (!favourite) return null;
  if (updates.icon !== undefined) favourite.icon = updates.icon;
  if (updates.position !== undefined) favourite.position = updates.position;
  return favourite;
}

export function deleteFavouriteById(scenarioId: string, id: number): boolean {
  const session = getSession(scenarioId);
  const before = session.favourites.length;
  session.favourites = session.favourites.filter((f) => f.id !== id);
  return session.favourites.length < before;
}

/** Updates the first row across all tables whose synthetic log id matches. */
export function updateRowByLogId(scenarioId: string, logId: number, fields: MockRow): boolean {
  const session = getSession(scenarioId);
  for (const [tablePath, table] of Object.entries(session.tables)) {
    const index = table.findIndex((row, i) => rowLogId(tablePath, i, row) === logId);
    if (index >= 0) {
      table[index] = { ...table[index], ...fields };
      return true;
    }
  }
  return false;
}

/** Clears all session state (used by the entry route when switching scenarios). */
export function resetSession(scenarioId: string): void {
  sessions.delete(scenarioId);
}
