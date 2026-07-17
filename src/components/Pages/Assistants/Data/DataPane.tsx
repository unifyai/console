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
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabSplitSkeleton } from '@/components/Common/Loaders/Skeletons';
import { roots, rootKey, type ContextRoot } from '@/lib/assistants/scope';
import {
  buildDataBrowserTree,
  collectSelectableContexts,
  contextMatchesDataBrowserMode,
  isStateManagerMode,
  STATE_MANAGER_ROOTS,
  treeNeedsFolderView,
  type DataBrowserMode,
  type DataBrowserRoot,
  type DataTreeNode,
} from '@/lib/assistants/dataBrowser';
import { useShellResource } from '@/hooks/Common/useShellResource';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { TabFooter } from '../Common/TabFooter';
import { TabSegmentGroup, TabSegment } from '../Common/TabSegmentGroup';
import { TeamAvatar } from '../OrgChat/TeamAvatar';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { DataLeafTable } from './DataLeafTable';
import { DataRowDetail } from './DataRowDetail';
import { DataScopeDropdown } from './DataScopeDropdown';
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

interface DataScopeSection {
  key: string;
  kind: 'personal' | 'team';
  label: string;
  teamId?: number;
  browserRoot: DataBrowserRoot;
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

function ScopeSectionHeader({ section }: { section: DataScopeSection }) {
  return (
    <div
      className="flex items-center gap-2 px-2 pb-1 pt-2"
      data-testid={`data-scope-section-${section.key}`}
    >
      {section.kind === 'team' ? (
        <TeamAvatar name={section.label} className="h-5 w-5" iconClassName="h-3 w-3" />
      ) : (
        <span
          className="rounded-control flex h-5 w-5 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <UserRound className="h-3 w-3" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-title truncate text-foreground">{section.label}</p>
        {section.kind === 'team' ? (
          <p className="text-caption uppercase tracking-[0.06em] text-muted-foreground">Team</p>
        ) : null}
      </div>
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
    <div className="flex flex-wrap items-center gap-1.5" data-testid="data-browser-mode">
      <TabSegmentGroup>
        <TabSegment
          label="Data"
          active={mode === 'data'}
          onClick={() => onChange('data')}
          testId="data-mode-data"
        />
      </TabSegmentGroup>
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <TabSegmentGroup className="flex-wrap">
        {STATE_MANAGER_ROOTS.map((root) => (
          <TabSegment
            key={root}
            label={root}
            active={mode === root}
            onClick={() => onChange(root)}
            testId={`data-mode-${root}`}
          />
        ))}
      </TabSegmentGroup>
    </div>
  );
}

function buildDataScopeSections(
  assistant: Assistant,
  ownerId: string,
  assistantId: string,
  effectiveRoot: ContextRoot | null
): DataScopeSection[] {
  const teamNamesById = new Map(
    (assistant.teamSummaries ?? []).map((summary) => [summary.teamId, summary.name])
  );

  const toSection = (r: ContextRoot): DataScopeSection => {
    if (r.kind === 'personal') {
      return {
        key: 'personal',
        kind: 'personal',
        label: 'Personal',
        browserRoot: { prefix: `${ownerId}/${assistantId}/`, group: null },
      };
    }
    return {
      key: `team-${r.teamId}`,
      kind: 'team',
      label: teamNamesById.get(r.teamId) ?? `Team ${r.teamId}`,
      teamId: r.teamId,
      browserRoot: { prefix: `Teams/${r.teamId}/`, group: null },
    };
  };

  if (effectiveRoot != null) {
    return [toSection(effectiveRoot)];
  }
  return roots(assistant).map(toSection);
}

export function DataPane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  enabled = true,
}: DataPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root, includeAll: true });
  const scopeSections = React.useMemo(
    () => buildDataScopeSections(assistant, ownerId, assistantId, scope.root),
    [assistant, ownerId, assistantId, scope.root]
  );
  const showScopeHeaders = scope.showFilter && scope.root == null && scopeSections.length > 1;
  const dataRoots = React.useMemo(
    () => scopeSections.map((section) => section.browserRoot),
    [scopeSections]
  );

  const displayPathForContext = React.useCallback(
    (full: string): string => {
      const section = scopeSections.find((s) => full.startsWith(s.browserRoot.prefix));
      if (!section) return full;
      const rel = full.slice(section.browserRoot.prefix.length);
      return showScopeHeaders ? `${section.label} / ${rel}` : rel;
    },
    [scopeSections, showScopeHeaders]
  );

  const [mode, setMode] = React.useState<DataBrowserMode>('data');
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
    isRefreshing: isRefreshingTree,
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

  const handleRefresh = React.useCallback(() => {
    void refreshTree();
    setRefreshToken((t) => t + 1);
  }, [refreshTree]);

  const sectionTrees = React.useMemo(
    () =>
      scopeSections.map((section) => ({
        section,
        tree: buildDataBrowserTree(contextNames ?? [], [section.browserRoot], mode),
      })),
    [scopeSections, contextNames, mode]
  );

  const selectableContexts = React.useMemo(
    () => sectionTrees.flatMap(({ tree: sectionTree }) => collectSelectableContexts(sectionTree)),
    [sectionTrees]
  );
  const showDirectory =
    mode === 'data' ||
    selectableContexts.length > 1 ||
    sectionTrees.some(({ tree: sectionTree }) => treeNeedsFolderView(sectionTree));

  React.useEffect(() => {
    const next = new Set<string>();
    for (const { tree: sectionTree } of sectionTrees) {
      for (const node of sectionTree.children.values()) {
        next.add(node.context ?? `${node.name}0`);
      }
    }
    setExpanded(next);
  }, [sectionTrees]);

  // Ownership scope change resets the open table — contexts are different roots.
  React.useEffect(() => {
    setSelected(null);
    setSelectedRow(null);
    setLeafMeta(null);
  }, [scope.activeKey]);

  // Drop a selection that disappeared after a refresh / mode filter change.
  React.useEffect(() => {
    setSelected((prev) => (prev && !selectableContexts.includes(prev) ? null : prev));
  }, [selectableContexts]);

  // Single-table state-manager modes open the table directly (no folder chrome).
  React.useEffect(() => {
    if (mode === 'data') return;
    if (selectableContexts.length !== 1) return;
    const only = selectableContexts[0];
    setSelected(only);
    setSelectedRow(null);
    setLeafMeta(null);
    if (isStackedLayout) setMobileShowTree(false);
  }, [mode, selectableContexts, isStackedLayout]);

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

  const topNodeCount = sectionTrees.reduce(
    (sum, { tree: sectionTree }) => sum + sectionTree.children.size,
    0
  );

  const selectedDisplayPath = selected ? displayPathForContext(selected) : null;
  const selectedTableName = selectedDisplayPath
    ? (selectedDisplayPath.split('/').pop() ?? selectedDisplayPath)
    : null;
  const selectedPathPrefix =
    selectedDisplayPath && selectedTableName
      ? selectedDisplayPath
          .slice(0, selectedDisplayPath.length - selectedTableName.length)
          .replace(/\/$/, '')
      : null;

  const emptyTreeCopy = mode === 'data' ? 'No ingested data yet.' : `No ${mode} contexts yet.`;
  const emptySelectCopy =
    mode === 'data'
      ? 'Select a table from the directory to browse its rows.'
      : showDirectory
        ? `Select a ${mode} table from the directory to browse its rows.`
        : `No ${mode} table found for this assistant.`;
  const sidebarTitle = mode === 'data' ? 'Data' : mode;

  const treeList = (
    <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="data-tree">
      {topNodeCount === 0 ? (
        <p className="text-caption px-2 py-6 text-center">{emptyTreeCopy}</p>
      ) : (
        sectionTrees.map(({ section, tree: sectionTree }) => {
          const nodes = Array.from(sectionTree.children.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          if (nodes.length === 0 && !showScopeHeaders) return null;
          return (
            <div key={section.key} className={showScopeHeaders ? 'mb-2' : undefined}>
              {showScopeHeaders ? <ScopeSectionHeader section={section} /> : null}
              {nodes.length === 0 ? (
                <p className="text-caption px-2 py-1.5 text-muted-foreground">No tables</p>
              ) : (
                nodes.map((node) => (
                  <TreeRow
                    key={`${section.key}:${node.name}`}
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
        })
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

  const modeToolbar = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <ModeSegments mode={mode} onChange={changeMode} />
      <DataScopeDropdown scope={scope} />
    </div>
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
            onClick={handleRefresh}
            disabled={isRefreshingTree}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Refresh data contexts"
            data-testid="data-refresh"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isRefreshingTree && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
          {!isStackedLayout && showDirectory && (
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
      {modeToolbar}
    </div>
  );

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      data-testid="data-pane"
      data-mode={mode}
      data-scope={scope.activeKey}
    >
      {isLoadingTree ? (
        <TabSplitSkeleton className="min-h-0 flex-1" listRows={8} />
      ) : (
        <>
          {isStateManagerMode(mode) && (
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
              showDirectory && (mobileShowTree || !selected) ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
                  {sidebarHeader}
                  {treeList}
                </div>
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
                    {showDirectory ? (
                      <button
                        type="button"
                        onClick={() => setMobileShowTree(true)}
                        className="text-body-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
                        data-testid="data-mobile-back"
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        {sidebarTitle}
                      </button>
                    ) : (
                      <span className="text-title text-foreground">{sidebarTitle}</span>
                    )}
                    {modeToolbar}
                  </div>
                  {selected ? (
                    leafChrome
                  ) : (
                    <div className="flex h-full items-center justify-center p-8 text-center">
                      <p className="text-body-muted">{emptySelectCopy}</p>
                    </div>
                  )}
                </div>
              )
            ) : (
              <>
                {(sidebarOpen || !showDirectory) && (
                  <div
                    className={cn(
                      'flex shrink-0 flex-col border-r border-border bg-card',
                      showDirectory ? 'w-72' : 'w-72'
                    )}
                  >
                    {sidebarHeader}
                    {showDirectory ? treeList : null}
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  {!sidebarOpen && showDirectory && (
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
                      {modeToolbar}
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
                  ? `${displayPathForContext(selected)} · ${leafMeta.count} ${leafMeta.count === 1 ? 'row' : 'rows'}`
                  : `${topNodeCount} ${topNodeCount === 1 ? 'group' : 'groups'} at this level`}
              </span>
            }
          />
        </>
      )}
    </div>
  );
}
