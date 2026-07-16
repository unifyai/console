/**
 * Assistants Data browser modes and context-tree helpers.
 *
 * Tables — ingested `…/Data/…` contexts (default, everyday).
 * State — reserved state-manager roots (Contacts, Tasks, …) for advanced editing.
 */

export type DataBrowserMode = 'tables' | 'state';

/** Roots owned by dedicated Storage panes — excluded from Tables mode. */
export const RESERVED_CONTEXT_ROOTS = [
  'Contacts',
  'Transcripts',
  'Knowledge',
  'Functions',
  'Guidance',
  'Tasks',
  'Dashboards',
  'Secrets',
  'Events',
] as const;

/**
 * State-manager roots shown in State mode (editable via LogGrid).
 * Omits Dashboards / Secrets / Events — those are not Storage SM surfaces.
 */
export const STATE_MANAGER_ROOTS = [
  'Contacts',
  'Transcripts',
  'Knowledge',
  'Functions',
  'Guidance',
  'Tasks',
] as const;

const RESERVED_ROOT_SET = new Set<string>(RESERVED_CONTEXT_ROOTS);
const STATE_ROOT_SET = new Set<string>(STATE_MANAGER_ROOTS);

export interface DataBrowserRoot {
  prefix: string;
  group: string | null;
}

export interface DataTreeNode {
  name: string;
  /** Full Orchestra context path when this node is a selectable table leaf. */
  context: string | null;
  children: Map<string, DataTreeNode>;
}

function newNode(name: string): DataTreeNode {
  return { name, context: null, children: new Map() };
}

/**
 * Build a directory tree for the Data browser from Orchestra context names.
 * `mode` controls whether ingested `Data/…` tables or state-manager roots appear.
 */
export function buildDataBrowserTree(
  contextNames: string[],
  dataRoots: DataBrowserRoot[],
  mode: DataBrowserMode
): DataTreeNode {
  const root = newNode('root');
  for (const fullName of contextNames) {
    const match = dataRoots.find((r) => fullName.startsWith(r.prefix));
    if (!match) continue;
    const relative = fullName.slice(match.prefix.length);
    let segments = relative.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    if (mode === 'tables') {
      // Only ingest contexts under `Data/` — not sibling roots.
      if (segments[0] !== 'Data' || segments.length < 2) continue;
      segments = segments.slice(1);
      if (segments.length === 0 || RESERVED_ROOT_SET.has(segments[0])) continue;
    } else if (!STATE_ROOT_SET.has(segments[0])) {
      continue;
    }

    if (match.group) segments = [match.group, ...segments];
    let cursor = root;
    segments.forEach((segment, index) => {
      if (!cursor.children.has(segment)) cursor.children.set(segment, newNode(segment));
      cursor = cursor.children.get(segment)!;
      if (index === segments.length - 1) cursor.context = fullName;
    });
  }
  return root;
}

/** True when `fullContext` belongs in the given browser mode. */
export function contextMatchesDataBrowserMode(
  fullContext: string,
  dataRoots: DataBrowserRoot[],
  mode: DataBrowserMode
): boolean {
  const match = dataRoots.find((r) => fullContext.startsWith(r.prefix));
  if (!match) return false;
  const segments = fullContext.slice(match.prefix.length).split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (mode === 'tables') {
    return segments[0] === 'Data' && segments.length >= 2 && !RESERVED_ROOT_SET.has(segments[1]);
  }
  return STATE_ROOT_SET.has(segments[0]);
}
