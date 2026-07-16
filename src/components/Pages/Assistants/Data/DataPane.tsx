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
import { roots, rootKey, type ContextRoot } from '@/lib/assistants/scope';
import {
  buildDataBrowserTree,
  contextMatchesDataBrowserMode,
  type DataBrowserMode,
  type DataBrowserRoot,
  type DataTreeNode,
} from '@/lib/assistants/dataBrowser';
import { useShellResource } from '@/hooks/Common/useShellResource';
import { TabFooter } from '../Common/TabFooter';
import { TabSegmentGroup, TabSegment } from '../Common/TabSegmentGroup';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { DataLeafTable } from './DataLeafTable';
import { DataRowDetail } from './DataRowDetail';
import type { DataField, DataRow } from './dataTypes';
import type { Assistant } from '@/types/assistants/assistant';

interface DataPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root browses only `Teams/{id}/…` (ungrouped)
   *  instead of the assistant's personal + team roots. */
  root?: ContextRoot | null;
  enabled?: boolean;
}

interface LeafMeta {
  count: number;
  loaded: number;
  columns: number;
  fields: Record<string, DataField>;
}

function TreeRow({
  node,
  depth,
  expanded,
  toggle,
  selected,
  onSelect,
}: {
  node: DataTreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (key: string) => void;
  selected: string | null;
  onSelect: (context: string) => void;
}) {
  const children = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
  const hasChildren = children.length > 0;
  const canSelect = node.context !== null;
  const key = node.context ?? `${node.name}${depth}`;
  const isOpen = expanded.has(key);
  const isSelected = canSelect && selected === node.context;

  return (
    <div>
      <div
        className={cn(
          'flex w-full items-center gap-0.5 rounded-md text-sm transition-colors',
          isSelected
            ? 'bg-primary-tint-10 text-primary'
            : 'text-foreground hover:bg-muted hover:text-foreground'
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(key)}
            className="grid h-7 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            data-testid="data-folder-toggle"
          >
            <ChevronRight
              className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => (canSelect ? onSelect(node.context!) : toggle(key))}
          data-testid={canSelect ? 'data-table-node' : 'data-folder-node'}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-2 text-left"
        >
          {canSelect ? (
            <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
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

function LeafHeaderStats({ meta }: { meta: LeafMeta | null }) {
  if (!meta) return null;
  return (
    <dl className="flex shrink-0 flex-wrap gap-x-4 gap-y-1">
      <div className="flex flex-col">
        <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Rows</dt>
        <dd className="text-code font-semibold text-foreground">{meta.count.toLocaleString()}</dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Loaded</dt>
        <dd className="text-code font-semibold text-foreground">{meta.loaded.toLocaleString()}</dd>
      </div>
      <div className="flex flex-col">
        <dt className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Columns</dt>
        <dd className="text-code font-semibold text-foreground">{meta.columns}</dd>
      </div>
    </dl>
  );
}

function ModeSegments({
  mode,
  onChange,
}: {
  mode: DataBrowserMode;
  onChange: (mode: DataBrowserMode) => void;
}) {
  return (
    <TabSegmentGroup testId="data-browser-mode">
      <TabSegment
        label="Tables"
        active={mode === 'tables'}
        onClick={() => onChange('tables')}
        testId="data-mode-tables"
      />
      <TabSegment
        label="State"
        active={mode === 'state'}
        onClick={() => onChange('state')}
        testId="data-mode-state"
      />
    </TabSegmentGroup>
  );
}

export function DataPane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  enabled = true,
}: DataPaneProps) {
  const dataRoots = React.useMemo<DataBrowserRoot[]>(() => {
    if (root?.kind === 'team') {
      return [{ prefix: `Teams/${root.teamId}/`, group: null }];
    }
    return roots(assistant).map((r) =>
      r.kind === 'personal'
        ? { prefix: `${ownerId}/${assistantId}/`, group: null }
        : { prefix: `Teams/${r.teamId}/`, group: `Team ${r.teamId}` }
    );
  }, [assistant, ownerId, assistantId, root]);

  const stripRootPrefix = React.useCallback(
    (full: string): string => {
      const match = dataRoots.find((r) => full.startsWith(r.prefix));
      if (!match) return full;
      const rel = full.slice(match.prefix.length);
      return match.group ? `${match.group} / ${rel}` : rel;
    },
    [dataRoots]
  );

  const [mode, setMode] = React.useState<DataBrowserMode>('tables');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<string | null>(null);
  const [leafMeta, setLeafMeta] = React.useState<LeafMeta | null>(null);
  const [selectedRow, setSelectedRow] = React.useState<DataRow | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const isStackedLayout = useMatchesBelow('tablet');
  const [mobileShowTree, setMobileShowTree] = React.useState(true);

  React.useEffect(() => {
    if (isStackedLayout) {
      setSidebarOpen(false);
    }
  }, [isStackedLayout]);

  const loadContextNames = React.useCallback(async (): Promise<string[]> => {
    const res = await fetch('/api/context/Assistants', { cache: 'no-store' });
    const raw: unknown = res.ok ? await res.json() : [];
    return Array.isArray(raw)
      ? raw
          .map((c) => (typeof c === 'string' ? c : (c as { name?: string })?.name))
          .filter((name): name is string => Boolean(name))
      : [];
  }, []);

  const {
    data: contextNames,
    isInitialLoading: isLoadingTree,
    refresh: refreshTree,
  } = useShellResource<string[]>({
    queryKey: [
      'assistant-data-contexts',
      ownerId,
      assistantId,
      rootKey(root ?? { kind: 'personal' }),
    ],
    queryFn: loadContextNames,
    enabled: enabled && !!ownerId && !!assistantId,
  });

  const tree = React.useMemo(
    () => buildDataBrowserTree(contextNames ?? [], dataRoots, mode),
    [contextNames, dataRoots, mode]
  );

  React.useEffect(() => {
    setExpanded(new Set(Array.from(tree.children.values()).map((n) => n.context ?? `${n.name}0`)));
  }, [tree]);

  const changeMode = React.useCallback(
    (next: DataBrowserMode) => {
      setMode(next);
      setSelected((prev) =>
        prev && contextMatchesDataBrowserMode(prev, dataRoots, next) ? prev : null
      );
      setSelectedRow(null);
      setLeafMeta(null);
      if (isStackedLayout) setMobileShowTree(true);
    },
    [dataRoots, isStackedLayout]
  );

  const selectLeaf = React.useCallback(
    (context: string) => {
      setSelected(context);
      setSelectedRow(null);
      setLeafMeta(null);
      if (isStackedLayout) {
        setMobileShowTree(false);
      }
    },
    [isStackedLayout]
  );

  const toggle = React.useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const saveField = React.useCallback(
    async (updates: Record<string, unknown>) => {
      if (!selected || !selectedRow?.logId) throw new Error('This row cannot be updated.');

      const res = await fetch('/api/logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: [selectedRow.logId],
          projectName: 'Assistants',
          context: selected,
          entries: updates,
          overwrite: true,
        }),
      });

      if (!res.ok) {
        console.error('Failed to save data row field', await res.text().catch(() => res.status));
        throw new Error('Unable to save this field.');
      }

      const updatedRow: DataRow = {
        ...selectedRow,
        entries: { ...selectedRow.entries, ...updates },
      };
      setSelectedRow(updatedRow);
      setRefreshToken((t) => t + 1);
    },
    [selected, selectedRow]
  );

  const deleteSelectedRow = React.useCallback(async () => {
    if (!selected || !selectedRow?.logId) throw new Error('This row cannot be deleted.');

    const res = await fetch('/api/logs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: 'Assistants',
        context: selected,
        idsAndFields: [[selectedRow.logId, null]],
      }),
    });

    if (!res.ok) {
      console.error('Failed to delete data row', await res.text().catch(() => res.status));
      throw new Error('Unable to delete this row.');
    }

    setSelectedRow(null);
    setRefreshToken((t) => t + 1);
  }, [selected, selectedRow]);

  const topNodes = Array.from(tree.children.values()).sort((a, b) => a.name.localeCompare(b.name));

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

  const emptyTreeCopy =
    mode === 'tables' ? 'No ingested data yet.' : 'No state-manager contexts yet.';
  const emptySelectCopy =
    mode === 'tables'
      ? 'Select a table from the directory to browse its rows.'
      : 'Select a state-manager context to browse and edit its rows.';
  const sidebarTitle = mode === 'tables' ? 'Tables' : 'State';

  const treeList = (
    <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="data-tree">
      {topNodes.length === 0 ? (
        <p className="text-caption px-2 py-6 text-center">{emptyTreeCopy}</p>
      ) : (
        topNodes.map((node) => (
          <TreeRow
            key={node.name}
            node={node}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            selected={selected}
            onSelect={selectLeaf}
          />
        ))
      )}
    </div>
  );

  const leafTable = selected ? (
    <DataLeafTable
      context={selected}
      selectedRowId={selectedRow ? String(selectedRow.logId) : null}
      onRowSelect={setSelectedRow}
      onMetaChange={setLeafMeta}
      refreshToken={refreshToken}
    />
  ) : null;

  const leafChrome = (
    <>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
        <LeafHeaderStats meta={leafMeta} />
      </div>
      {leafTable}
    </>
  );

  const sidebarHeader = (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-title flex min-w-0 items-center gap-2 text-foreground">
          <Database className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{sidebarTitle}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              void refreshTree({ blocking: true });
            }}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Refresh data contexts"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {!isStackedLayout && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Collapse data layer sidebar"
              data-testid="data-sidebar-collapse"
            >
              <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <ModeSegments mode={mode} onChange={changeMode} />
    </div>
  );

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      data-testid="data-pane"
      data-mode={mode}
    >
      {isLoadingTree ? (
        <TabSplitSkeleton className="min-h-0 flex-1" listRows={8} />
      ) : (
        <>
          {mode === 'state' && (
            <div
              className="bg-muted/40 shrink-0 border-b border-border px-4 py-2.5"
              data-testid="data-state-banner"
              role="status"
            >
              <p className="text-caption text-muted-foreground">
                These are live assistant state tables. Edits can change behaviour — prefer the
                dedicated Storage tabs for everyday browsing.
              </p>
            </div>
          )}

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {isStackedLayout ? (
              mobileShowTree || !selected ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
                  {sidebarHeader}
                  {treeList}
                </div>
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setMobileShowTree(true)}
                      className="text-body-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
                      data-testid="data-mobile-back"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      {sidebarTitle}
                    </button>
                    <ModeSegments mode={mode} onChange={changeMode} />
                  </div>
                  {leafChrome}
                </div>
              )
            ) : (
              <>
                {sidebarOpen && (
                  <div className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
                    {sidebarHeader}
                    {treeList}
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  {!sidebarOpen && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                        className="text-body-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
                        data-testid="data-sidebar-expand"
                      >
                        <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        {sidebarTitle}
                      </button>
                      <ModeSegments mode={mode} onChange={changeMode} />
                    </div>
                  )}
                  {!selected ? (
                    <div className="flex h-full items-center justify-center p-8 text-center">
                      <div className="max-w-sm">
                        <Table2
                          className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="text-body-muted">{emptySelectCopy}</p>
                      </div>
                    </div>
                  ) : (
                    leafChrome
                  )}
                </div>
              </>
            )}
          </div>

          <DataRowDetail
            row={selectedRow}
            title={selectedTableName ?? selectedDisplayPath ?? 'Data row'}
            description={selectedDisplayPath ?? undefined}
            fields={leafMeta?.fields ?? {}}
            onSave={saveField}
            onDelete={deleteSelectedRow}
            onClose={() => setSelectedRow(null)}
          />

          <TabFooter
            testId="data-footer"
            right={
              <span className="text-caption inline-flex items-center gap-1.5">
                <Database className="h-3 w-3" aria-hidden="true" />
                {selected && leafMeta
                  ? `${stripRootPrefix(selected)} · ${leafMeta.count} ${leafMeta.count === 1 ? 'row' : 'rows'}`
                  : `${topNodes.length} ${topNodes.length === 1 ? 'group' : 'groups'} at this level`}
              </span>
            }
          />
        </>
      )}
    </div>
  );
}
