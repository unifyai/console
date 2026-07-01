'use client';

import * as React from 'react';
import {
  ChevronRight,
  ArrowLeft,
  Database,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Table2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabSplitSkeleton } from '@/components/Common/Loaders/Skeletons';
import { roots } from '@/lib/assistants/scope';
import {
  invalidateTabDataCache,
  readTabDataCache,
  writeTabDataCache,
} from '@/lib/assistants/tabDataCache';
import { TabFooter } from '../Common/TabFooter';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { DataLeafTable } from './DataLeafTable';
import type { Assistant } from '@/types/assistants/assistant';

interface DataPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
}

/** Rows fetched per page; the leaf view appends pages via "Load more". */
const PAGE_SIZE = 50;

/** Strip Orchestra private/metadata fields (leading underscore) from row payloads. */
function stripPrivateFields(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('_')) out[key] = value;
  }
  return out;
}

/** Parse `/api/logs/fields` response into public column names. */
function publicColumnsFromFields(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  return Object.keys(data as Record<string, unknown>)
    .filter((key) => key !== '__contextNotFound' && !key.startsWith('_'))
    .sort((a, b) => a.localeCompare(b));
}

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
    // Only ingest contexts under the assistant's `Data/` tree — not sibling
    // roots like Contacts, Exchanges, FileRecords, etc.
    if (segments[0] !== 'Data' || segments.length < 2) continue;
    segments = segments.slice(1);
    if (segments.length === 0 || RESERVED_ROOTS.has(segments[0])) continue;
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
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const isStackedLayout = useMatchesBelow('tablet');
  const [mobileShowTree, setMobileShowTree] = React.useState(true);

  React.useEffect(() => {
    if (isStackedLayout) {
      setSidebarOpen(false);
    }
  }, [isStackedLayout]);

  const fetchFieldColumns = React.useCallback(async (context: string): Promise<string[]> => {
    const params = new URLSearchParams({
      projectName: 'Assistants',
      context,
    });
    const res = await fetch(`/api/logs/fields?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return publicColumnsFromFields(data);
  }, []);

  const treeCacheKey = `${ownerId}:${assistantId}:data-tree`;

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
      writeTabDataCache(treeCacheKey, built);
      setTree(built);
      // Expand the first level so the directory reads as a populated tree.
      setExpanded(new Set(Array.from(built.children.values()).map((n) => n.context ?? n.name + 1)));
    } catch {
      setTree(newNode('root'));
    } finally {
      setIsLoadingTree(false);
    }
  }, [dataRoots, treeCacheKey]);

  React.useEffect(() => {
    const cached = readTabDataCache<TreeNode>(treeCacheKey);
    if (cached) {
      setTree(cached);
      setExpanded(
        new Set(Array.from(cached.children.values()).map((n) => n.context ?? n.name + 1))
      );
      setIsLoadingTree(false);
      return;
    }
    void loadTree();
  }, [loadTree, treeCacheKey]);

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
        (log: { entries?: Record<string, unknown> }) => stripPrivateFields(log.entries ?? {})
      );
      return { rows, count: data.count ?? rows.length };
    },
    []
  );

  const mergeColumns = React.useCallback(
    (fieldColumns: string[], rows: Record<string, unknown>[]): string[] => {
      const columns = new Set(fieldColumns);
      rows.forEach((row) =>
        Object.keys(row).forEach((key) => {
          if (!key.startsWith('_')) columns.add(key);
        })
      );
      return Array.from(columns).sort((a, b) => a.localeCompare(b));
    },
    []
  );

  const columnsFor = React.useCallback(
    (fieldColumns: string[], rows: Record<string, unknown>[]): string[] =>
      mergeColumns(fieldColumns, rows),
    [mergeColumns]
  );

  const loadLeaf = React.useCallback(
    async (context: string) => {
      setSelected(context);
      setLeaf(null);
      setIsLoadingLeaf(true);
      if (isStackedLayout) {
        setMobileShowTree(false);
      }
      try {
        const [fieldColumns, page] = await Promise.all([
          fetchFieldColumns(context),
          fetchLeafPage(context, 0),
        ]);
        const { rows, count } = page;
        setLeaf({ rows, count, columns: columnsFor(fieldColumns, rows) });
      } catch {
        setLeaf({ rows: [], count: 0, columns: [] });
      } finally {
        setIsLoadingLeaf(false);
      }
    },
    [fetchFieldColumns, fetchLeafPage, columnsFor, isStackedLayout]
  );

  const loadMore = React.useCallback(async () => {
    if (!selected || !leaf) return;
    setIsLoadingMore(true);
    try {
      const { rows, count } = await fetchLeafPage(selected, leaf.rows.length);
      const merged = [...leaf.rows, ...rows];
      setLeaf({
        rows: merged,
        count,
        columns: mergeColumns(leaf.columns, rows),
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [selected, leaf, fetchLeafPage, mergeColumns]);

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

  const selectedDisplayPath = selected ? stripRootPrefix(selected) : null;
  const selectedTableName = selectedDisplayPath
    ? (selectedDisplayPath.split('/').pop() ?? selectedDisplayPath)
    : null;
  const selectedPathPrefix =
    selectedDisplayPath && selectedTableName
      ? selectedDisplayPath
          .slice(0, selectedDisplayPath.length - selectedTableName.length)
          .replace(/\/$/, '')
      : null;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      data-testid="data-pane"
    >
      {isLoadingTree ? (
        <TabSplitSkeleton className="min-h-0 flex-1" listRows={8} />
      ) : (
        <>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {isStackedLayout ? (
              mobileShowTree || !selected ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <div className="text-title flex items-center gap-2 text-foreground">
                      <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Data layer
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        invalidateTabDataCache(treeCacheKey);
                        void loadTree();
                      }}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Refresh data contexts"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="data-tree">
                    {topNodes.length === 0 ? (
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
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="flex shrink-0 items-center border-b border-border bg-card px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setMobileShowTree(true)}
                      className="text-body-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
                      data-testid="data-mobile-back"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Data layer
                    </button>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Table2
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <h3 className="text-title truncate text-foreground">
                          {selectedTableName ?? selectedDisplayPath}
                        </h3>
                      </div>
                      {selectedPathPrefix && (
                        <p className="text-caption mt-0.5 truncate text-muted-foreground">
                          {selectedPathPrefix}
                        </p>
                      )}
                    </div>
                    {leaf && (
                      <dl className="flex shrink-0 flex-wrap gap-x-4 gap-y-1">
                        <div className="flex flex-col">
                          <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                            Rows
                          </dt>
                          <dd className="text-code font-semibold text-foreground">
                            {leaf.count.toLocaleString()}
                          </dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                            Loaded
                          </dt>
                          <dd className="text-code font-semibold text-foreground">
                            {leaf.rows.length.toLocaleString()}
                          </dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                            Columns
                          </dt>
                          <dd className="text-code font-semibold text-foreground">
                            {leaf.columns.length}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                  <DataLeafTable
                    rows={leaf?.rows ?? []}
                    columns={leaf?.columns ?? []}
                    totalCount={leaf?.count ?? 0}
                    isLoading={isLoadingLeaf}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={() => void loadMore()}
                  />
                </div>
              )
            ) : (
              <>
                {sidebarOpen && (
                  <div className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <div className="text-title flex items-center gap-2 text-foreground">
                        <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        Data layer
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            invalidateTabDataCache(treeCacheKey);
                            void loadTree();
                          }}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Refresh data contexts"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSidebarOpen(false)}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Collapse data layer sidebar"
                          data-testid="data-sidebar-collapse"
                        >
                          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="data-tree">
                      {topNodes.length === 0 ? (
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
                )}

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  {!sidebarOpen && (
                    <div className="flex shrink-0 items-center border-b border-border px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                        className="text-body-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
                        data-testid="data-sidebar-expand"
                      >
                        <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        Data layer
                      </button>
                    </div>
                  )}
                  {!selected ? (
                    <div className="flex h-full items-center justify-center p-8 text-center">
                      <div className="max-w-sm">
                        <Table2
                          className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="text-body-muted">
                          Select a table from the directory to browse its rows.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Table2
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <h3 className="text-title truncate text-foreground">
                              {selectedTableName ?? selectedDisplayPath}
                            </h3>
                          </div>
                          {selectedPathPrefix && (
                            <p className="text-caption mt-0.5 truncate text-muted-foreground">
                              {selectedPathPrefix}
                            </p>
                          )}
                        </div>
                        {leaf && (
                          <dl className="flex shrink-0 flex-wrap gap-x-4 gap-y-1">
                            <div className="flex flex-col">
                              <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                                Rows
                              </dt>
                              <dd className="text-code font-semibold text-foreground">
                                {leaf.count.toLocaleString()}
                              </dd>
                            </div>
                            <div className="flex flex-col">
                              <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                                Loaded
                              </dt>
                              <dd className="text-code font-semibold text-foreground">
                                {leaf.rows.length.toLocaleString()}
                              </dd>
                            </div>
                            <div className="flex flex-col">
                              <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                                Columns
                              </dt>
                              <dd className="text-code font-semibold text-foreground">
                                {leaf.columns.length}
                              </dd>
                            </div>
                          </dl>
                        )}
                      </div>
                      <DataLeafTable
                        rows={leaf?.rows ?? []}
                        columns={leaf?.columns ?? []}
                        totalCount={leaf?.count ?? 0}
                        isLoading={isLoadingLeaf}
                        isLoadingMore={isLoadingMore}
                        onLoadMore={() => void loadMore()}
                      />
                    </>
                  )}
                </div>
              </>
            )}
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
        </>
      )}
    </div>
  );
}
