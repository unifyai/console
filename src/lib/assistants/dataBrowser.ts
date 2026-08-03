/**
 * Assistants Data browser context-tree helpers.
 *
 * The Data pane browses ingested `…/Data/…` contexts — the external data a
 * user connects or uploads. State-manager roots (Contacts, Tasks, …) belong to
 * their own dedicated panes and are deliberately excluded here.
 */

/** Roots owned by dedicated Storage panes — never part of the Data tree. */
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

const RESERVED_ROOT_SET = new Set<string>(RESERVED_CONTEXT_ROOTS);

/** Bookkeeping tables (`Contacts/Meta`, `Data/Meta`, …) — never shown in the Data browser. */
export function isMetaContextPath(relativeSegments: string[]): boolean {
  return relativeSegments.length > 0 && relativeSegments[relativeSegments.length - 1] === 'Meta';
}

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

/** Build a directory tree of ingested `Data/…` tables from Orchestra context names. */
export function buildDataBrowserTree(
  contextNames: string[],
  dataRoots: DataBrowserRoot[]
): DataTreeNode {
  const root = newNode('root');
  for (const fullName of contextNames) {
    const match = dataRoots.find((r) => fullName.startsWith(r.prefix));
    if (!match) continue;
    const relative = fullName.slice(match.prefix.length);
    let segments = relative.split('/').filter(Boolean);
    if (segments.length === 0) continue;
    // Hide */Meta bookkeeping contexts (Contacts/Meta, Data/Meta, …).
    if (isMetaContextPath(segments)) continue;

    // Only ingested contexts under `Data/` — not sibling state-manager roots.
    if (segments[0] !== 'Data' || segments.length < 2) continue;
    segments = segments.slice(1);
    if (segments.length === 0 || RESERVED_ROOT_SET.has(segments[0])) continue;
    if (isMetaContextPath(segments)) continue;

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

/** Collect every selectable context path under a tree node. */
export function collectSelectableContexts(node: DataTreeNode): string[] {
  const out: string[] = [];
  if (node.context) out.push(node.context);
  for (const child of node.children.values()) {
    out.push(...collectSelectableContexts(child));
  }
  return out;
}

/**
 * Whether the directory sidebar is useful: more than one table, or any nested
 * folder structure (e.g. a Sales folder nesting Leads / Accounts).
 */
export function treeNeedsFolderView(root: DataTreeNode): boolean {
  const leaves = collectSelectableContexts(root);
  if (leaves.length > 1) return true;
  for (const child of root.children.values()) {
    if (child.children.size > 0) return true;
  }
  return false;
}

/** Target nest under a scope section's `Data/` root for create / upload. */
export interface DataCwd {
  sectionKey: string;
  /** Path segments under `Data/` (empty = Data root). */
  segments: string[];
}

/**
 * Split a user-entered relative path into segments.
 * Rejects empty segments, `.` / `..`, and trailing slashes with empty parts.
 */
export function parseRelativeTablePath(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const segments = trimmed.split('/').map((s) => s.trim());
  if (segments.some((s) => !s || s === '.' || s === '..')) return null;
  return segments;
}

/**
 * Validate a relative table path under `Data/` (from cwd + name).
 * Rejects Meta leaf, reserved SM roots as the first Data segment, and empty names.
 */
export function validateDataTableSegments(segments: string[]): string | null {
  if (segments.length === 0) return 'Enter a table name.';
  if (isMetaContextPath(segments)) return 'Meta is reserved.';
  if (RESERVED_ROOT_SET.has(segments[0]!)) {
    return `"${segments[0]}" is a reserved system folder.`;
  }
  for (const segment of segments) {
    if (!segment.trim()) return 'Table name cannot contain empty path segments.';
  }
  return null;
}

/**
 * Full Orchestra context for a new table under a scope prefix + cwd + relative name.
 * Example: prefix `u/a/`, cwd `Sales`, name `Leads` → `u/a/Data/Sales/Leads`.
 */
export function resolveDataTableContext(
  scopePrefix: string,
  cwdSegments: string[],
  relativeName: string
): { context: string; segments: string[] } | { error: string } {
  const nameSegments = parseRelativeTablePath(relativeName);
  if (!nameSegments) return { error: 'Enter a valid table name.' };
  const segments = [...cwdSegments, ...nameSegments];
  const error = validateDataTableSegments(segments);
  if (error) return { error };
  const prefix = scopePrefix.endsWith('/') ? scopePrefix : `${scopePrefix}/`;
  return { context: `${prefix}Data/${segments.join('/')}`, segments };
}

/** Default table name from an upload filename (strip extension, keep path-safe chars). */
export function tableNameFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '');
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const cleaned = withoutExt
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
  return cleaned || 'imported';
}
