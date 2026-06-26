/**
 * Mock simulation mode — the single build-time-safe flag.
 *
 * When `NEXT_PUBLIC_MOCK_SIM === 'true'` the Console boots against hardcoded,
 * in-memory fixtures with no Orchestra/Postgres/auth backend. The flag is read
 * through `process.env` so it inlines at build time on both the server and the
 * client; when it is off (the default, and in every prod/CI build) none of the
 * simulation code paths are reachable.
 *
 * Interception happens at the data boundary (Orchestra clients, fetch helpers,
 * identity resolution) — never inside display components — so views are unaware
 * they are running on mock data.
 */

/** Reads the single simulation flag. Safe on both server and client. */
export function mockSimulationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_SIM === 'true';
}

/** Cookie that selects which scenario fixture set is active. */
export const MOCK_SCENARIO_COOKIE = 'mock_scenario';

/** Cookie that selects which persona (identity/role) is active within a scenario. */
export const MOCK_PERSONA_COOKIE = 'mock_persona';

/**
 * Mock API keys are namespaced so they can never collide with a real key, and
 * they encode the active scenario + workspace. This lets the data-boundary
 * dispatcher resolve everything it needs from the request's `Authorization`
 * header alone — no `next/headers`/cookie read — so the dispatcher stays a pure
 * module safe to keep out of client bundles.
 *
 * Shape: `mock-sim-key:<scenarioId>::<workspaceId>`.
 */
export const MOCK_API_KEY_PREFIX = 'mock-sim-key:';

/** Builds the namespaced mock API key for a scenario/workspace pair. */
export function mockApiKey(scenarioId: string, workspaceId: string): string {
  return `${MOCK_API_KEY_PREFIX}${scenarioId}::${workspaceId}`;
}

/** Whether a given key string is a simulation key. */
export function isMockApiKey(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(MOCK_API_KEY_PREFIX);
}

export interface ParsedMockApiKey {
  scenarioId: string;
  workspaceId: string;
}

/** Parses a mock API key back into its scenario/workspace parts, if valid. */
export function parseMockApiKey(value: string | null | undefined): ParsedMockApiKey | null {
  if (!isMockApiKey(value)) return null;
  const body = (value as string).slice(MOCK_API_KEY_PREFIX.length);
  const [scenarioId, workspaceId] = body.split('::');
  if (!scenarioId || !workspaceId) return null;
  return { scenarioId, workspaceId };
}
