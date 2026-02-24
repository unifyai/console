/**
 * Excluded Managers Configuration
 *
 * Single source of truth for managers hidden from the Actions panel.
 * Events from these managers are:
 *
 * 1. Filtered at the Orchestra query level — prevents large payloads
 *    (e.g. full transcripts) from ever crossing the wire on pulls.
 * 2. Dropped server-side before SSE delivery — prevents Pub/Sub
 *    messages from bloating the event stream to the client.
 *
 * To hide a new manager, add its exact name to EXCLUDED_MANAGERS.
 */

/**
 * Manager names to exclude from every surface in the Actions panel.
 *
 * Currently excludes MemoryManager because its payloads carry entire
 * conversation transcripts, which choke Orchestra bandwidth.
 */
export const EXCLUDED_MANAGERS: readonly string[] = ['MemoryManager'];

const excludedSet = new Set<string>(EXCLUDED_MANAGERS);

/**
 * Returns true if a manager should be hidden from the Actions panel.
 * O(1) lookup via Set — safe for hot paths like the SSE pull loop.
 */
export function isManagerExcluded(managerName: string | null | undefined): boolean {
  return !!managerName && excludedSet.has(managerName);
}

/**
 * Builds Orchestra filter clauses that exclude every manager in the list.
 *
 * Returns an array of strings like `manager != "MemoryManager"`,
 * intended to be spread into a filters array before `combineFilters()`.
 */
export function buildExcludedManagerFilters(): string[] {
  return EXCLUDED_MANAGERS.map((m) => `manager != "${m}"`);
}
