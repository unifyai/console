'use client';

import * as React from 'react';
import { ChevronRight, Database, Folder, RefreshCw, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { Button } from '@/components/UI/button';
import { roots } from '@/lib/assistants/scope';
import { TabFooter } from '../Common/TabFooter';
import type { Assistant } from '@/types/assistants/assistant';

interface DataPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
}

/** Rows fetched per page; the leaf view appends pages via "Load more". */
const PAGE_SIZE = 100;

/**
 * A readable context root the Data browser draws from. Personal data lives
 * under ``{ownerId}/{assistantId}/``; each team the assistant belongs to
 * contributes a ``Teams/{teamId}/`` root, surfaced under its own group node
 * so identically-named tables across roots never collide.
 */
interface DataRoot {
  prefix: string;
  group: string | null;
}

/**
 * Context names that belong to dedicated Brain surfaces — excluded from the Data
 * browser, which shows the remaining ingested data-layer contexts as a directory.
 */
const RESERVED_ROOTS = new Set([
  'Contacts',
  'Transcripts',
  'Knowledge',
  'Functions',
  'Guidance',
  'Tasks',
  'Dashboards',
  'Secrets',
  'Events',
]);

interface TreeNode {
  name: string;
  /** Full Orchestra context path when this node is a selectable table leaf. */
  context: string | null;
  children: Map<string, TreeNode>;
}

interface LeafData {
  rows: Array<Record<string, unknown>>;
  count: number;
  columns: string[];
}

function newNode(name: string): TreeNode {
  return { name, context: null, children: new Map() };
}

function buildTree(contextNames: string[], dataRoots: DataRoot[]): TreeNode {
  const root = newNode('root');
  for (const fullName of contextNames) {
    const match = dataRoots.find((r) => fullName.startsWith(r.prefix));
    if (!match) continue;
    const relative = fullName.slice(match.prefix.length);
    let segments = relative.split('/').filter(Boolean);
    if (segments.length === 0 || RESERVED_ROOTS.has(segments[0])) continue;
    // The data layer lives under a top-level `Data/` context group; surface its
    // children (CRM, Finance, …) directly as the directory roots.
    if (segments[0] === 'Data' && segments.length > 1) segments = segments.slice(1);
    // Team roots are nested under a group node so identically-named tables in
    // different roots stay distinct.
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function TreeRow({
  node,
  depth,
  expanded,
  toggle,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (key: string) => void;
  selected: string | null;
  onSelect: (context: string) => void;
}) {
  const children = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
  const hasChildren = children.length > 0;
  const key = node.context ?? node.name + depth;
  const isOpen = expanded.has(key);
  const isLeaf = node.context !== null && !hasChildren;
  const isSelected = isLeaf && selected === node.context;

  return (
    <div>
      <button
        type="button"
        onClick={() => (isLeaf ? onSelect(node.context!) : toggle(key))}
        data-testid={isLeaf ? 'data-table-node' : 'data-folder-node'}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-muted hover:text-foreground'
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')}
            aria-hidden="true"
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isLeaf ? (
          <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {hasChildren && isOpen && (
        <div>
          {children.map((child) => (
            <TreeRow
              key={child.name}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DataPane({ assistant, ownerId, assistantId }: DataPaneProps) {
  const dataRoots = React.useMemo<DataRoot[]>(
    () =>
      roots(assistant).map((r) =>
        r.kind === 'personal'
          ? { prefix: `${ownerId}/${assistantId}/`, group: null }
          : { prefix: `Teams/${r.teamId}/`, group: `Team ${r.teamId}` }
      ),
    [assistant, ownerId, assistantId]
  );

  const stripRootPrefix = React.useCallback(
    (full: string): string => {
      const match = dataRoots.find((r) => full.startsWith(r.prefix));
      if (!match) return full;
      const rel = full.slice(match.prefix.length);
      return match.group ? `${match.group} / ${rel}` : rel;
    },
    [dataRoots]
  );

  const [tree, setTree] = React.useState<TreeNode | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<string | null>(null);
  const [leaf, setLeaf] = React.useState<LeafData | null>(null);
  const [isLoadingTree, setIsLoadingTree] = React.useState(true);
  const [isLoadingLeaf, setIsLoadingLeaf] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const loadTree = React.useCallback(async () => {
    setIsLoadingTree(true);
    try {
      const res = await fetch('/api/context/Assistants', { cache: 'no-store' });
      const raw: unknown = res.ok ? await res.json() : [];
      const names = Array.isArray(raw)
        ? raw
            .map((c) => (typeof c === 'string' ? c : (c as { name?: string })?.name))
            .filter((name): name is string => Boolean(name))
        : [];
      const built = buildTree(names, dataRoots);
      setTree(built);
      // Expand the first level so the directory reads as a populated tree.
      setExpanded(new Set(Array.from(built.children.values()).map((n) => n.context ?? n.name + 1)));
    } catch {
      setTree(newNode('root'));
    } finally {
      setIsLoadingTree(false);
    }
  }, [dataRoots]);

  React.useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const fetchLeafPage = React.useCallback(
    async (
      context: string,
      offset: number
    ): Promise<{ rows: Record<string, unknown>[]; count: number }> => {
      const params = new URLSearchParams({
        projectName: 'Assistants',
        context,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
      const data = res.ok ? await res.json() : { logs: [], count: 0 };
      const rows: Array<Record<string, unknown>> = (data.logs ?? []).map(
        (log: { entries?: Record<string, unknown> }) => log.entries ?? {}
      );
      return { rows, count: data.count ?? rows.length };
    },
    []
  );

  const columnsFor = React.useCallback((rows: Record<string, unknown>[]): string[] => {
    const columns = new Set<string>();
    rows.forEach((row) =>
      Object.keys(row).forEach((key) => {
        if (!key.startsWith('_')) columns.add(key);
      })
    );
    return Array.from(columns);
  }, []);

  const loadLeaf = React.useCallback(
    async (context: string) => {
      setSelected(context);
      setLeaf(null);
      setIsLoadingLeaf(true);
      try {
        const { rows, count } = await fetchLeafPage(context, 0);
        setLeaf({ rows, count, columns: columnsFor(rows) });
      } catch {
        setLeaf({ rows: [], count: 0, columns: [] });
      } finally {
        setIsLoadingLeaf(false);
      }
    },
    [fetchLeafPage, columnsFor]
  );

  const loadMore = React.useCallback(async () => {
    if (!selected || !leaf) return;
    setIsLoadingMore(true);
    try {
      const { rows, count } = await fetchLeafPage(selected, leaf.rows.length);
      const merged = [...leaf.rows, ...rows];
      setLeaf({ rows: merged, count, columns: columnsFor(merged) });
    } finally {
      setIsLoadingMore(false);
    }
  }, [selected, leaf, fetchLeafPage, columnsFor]);

  const toggle = React.useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const topNodes = tree
    ? Array.from(tree.children.values()).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      data-testid="data-pane"
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="text-title flex items-center gap-2 text-foreground">
              <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Data layer
            </div>
            <button
              type="button"
              onClick={() => void loadTree()}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Refresh data contexts"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="data-tree">
            {isLoadingTree ? (
              <div className="space-y-2 p-2">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : topNodes.length === 0 ? (
              <p className="text-caption px-2 py-6 text-center">No ingested data yet.</p>
            ) : (
              topNodes.map((node) => (
                <TreeRow
                  key={node.name}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  toggle={toggle}
                  selected={selected}
                  onSelect={(context) => void loadLeaf(context)}
                />
              ))
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!selected ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <Table2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-body-muted">
                  Select a table from the directory to browse its rows.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-border px-4 py-3">
                <div className="text-code truncate text-foreground">
                  {stripRootPrefix(selected)}
                </div>
                {leaf && (
                  <div className="text-caption mt-0.5">
                    Showing {leaf.rows.length} of {leaf.count} {leaf.count === 1 ? 'row' : 'rows'} ·{' '}
                    {leaf.columns.length} {leaf.columns.length === 1 ? 'column' : 'columns'}
                  </div>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-auto" data-testid="data-leaf-table">
                {isLoadingLeaf ? (
                  <div className="space-y-2 p-4">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                ) : !leaf || leaf.rows.length === 0 ? (
                  <p className="text-body-muted p-8 text-center">This table has no rows.</p>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr>
                        {leaf.columns.map((col) => (
                          <th
                            key={col}
                            className="border-b border-border px-3 py-2 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaf.rows.map((row, index) => (
                        <tr key={index} className="hover:bg-muted/50">
                          {leaf.columns.map((col) => (
                            <td
                              key={col}
                              className="max-w-[280px] truncate border-b border-border px-3 py-2 text-foreground"
                              title={displayValue(row[col])}
                            >
                              {displayValue(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {leaf && leaf.rows.length < leaf.count && (
                  <div className="flex justify-center p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void loadMore()}
                      disabled={isLoadingMore}
                      data-testid="data-load-more"
                    >
                      {isLoadingMore
                        ? 'Loading…'
                        : `Load more (${leaf.count - leaf.rows.length} remaining)`}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <TabFooter
        testId="data-footer"
        right={
          <span className="text-caption inline-flex items-center gap-1.5">
            <Database className="h-3 w-3" aria-hidden="true" />
            {selected && leaf
              ? `${stripRootPrefix(selected)} · ${leaf.count} ${leaf.count === 1 ? 'row' : 'rows'}`
              : `${topNodes.length} ${topNodes.length === 1 ? 'group' : 'groups'} at this level`}
          </span>
        }
      />
    </div>
  );
}
