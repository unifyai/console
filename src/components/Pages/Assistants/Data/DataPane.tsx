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
  childrenAtCwd,
  collectSelectableContexts,
  contextMatchesDataBrowserMode,
  isStateManagerMode,
  STATE_MANAGER_ROOTS,
  treeNeedsFolderView,
  type DataBrowserMode,
  type DataBrowserRoot,
  type DataCwd,
  type DataTreeNode,
} from '@/lib/assistants/dataBrowser';
import { listAssistantsContexts } from '@/lib/assistants/dataContexts';
import { useShellResource } from '@/hooks/Common/useShellResource';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { TabFooter } from '../Common/TabFooter';
import { TabSegment } from '../Common/TabSegmentGroup';
import { TeamAvatar } from '../OrgChat/TeamAvatar';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { DataLeafTable } from './DataLeafTable';
import { DataRowDetail } from './DataRowDetail';
import { DataFolderBrowser } from './DataFolderBrowser';
import { DataCreateTableDialog } from './DataCreateTableDialog';
import { DataImportDialog } from './DataImportDialog';
import type { DataField, DataRow } from './dataTypes';
import type { Assistant } from '@/types/assistants/assistant';
import { resolveManagedTeamDisplayName } from '@/utils/teams/managedTeamDisplay';

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

function ScopeSectionHeader({
  section,
  imageUrl,
  isOrgWideSharing,
}: {
  section: DataScopeSection;
  imageUrl?: string | null;
  isOrgWideSharing?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 pb-1 pt-2"
      data-testid={`data-scope-section-${section.key}`}
    >
      {section.kind === 'team' ? (
        <TeamAvatar
          name={section.label}
          imageUrl={imageUrl}
          isOrgWideSharing={isOrgWideSharing}
          className="h-5 w-5"
          iconClassName="h-3 w-3"
        />
      ) : (
        <span
          className="rounded-control flex h-5 w-5 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <UserRound className="h-3 w-3" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <p className="text-title truncate text-foreground">{section.label}</p>
        {section.kind === 'team' ? (
          <p className="text-caption shrink-0 uppercase tracking-[0.06em] text-muted-foreground">
            Team
          </p>
        ) : null}
      </div>
    </div>
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
    <div
      className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto"
      data-testid="data-browser-mode"
    >
      <TabSegment
        label="Data"
        active={mode === 'data'}
        onClick={() => onChange('data')}
        testId="data-mode-data"
      />
      {STATE_MANAGER_ROOTS.map((root) => (
        <TabSegment
          key={root}
          label={root}
          active={mode === root}
          onClick={() => onChange(root)}
          testId={`data-mode-${root}`}
        />
      ))}
    </div>
  );
}

function buildDataScopeSections(
  assistant: Assistant,
  ownerId: string,
  assistantId: string,
  effectiveRoot: ContextRoot | null,
  orgName: string | null
): DataScopeSection[] {
  const teamSummariesById = new Map(
    (assistant.teamSummaries ?? []).map((summary) => [summary.teamId, summary])
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
    const summary = teamSummariesById.get(r.teamId) ?? {
      teamId: r.teamId,
      name: `Team ${r.teamId}`,
      description: null,
    };
    return {
      key: `team-${r.teamId}`,
      kind: 'team',
      label: resolveManagedTeamDisplayName(summary, orgName),
      teamId: r.teamId,
      browserRoot: { prefix: `Teams/${r.teamId}/`, group: null },
    };
  };

  if (effectiveRoot != null) {
    return [toSection(effectiveRoot)];
  }
  return roots(assistant).map(toSection);
}

function cwdLocationLabel(
  section: DataScopeSection | undefined,
  segments: string[],
  includeSectionLabel: boolean
): string {
  const parts: string[] = [];
  if (includeSectionLabel && section) parts.push(section.label);
  parts.push('Data');
  parts.push(...segments);
  return parts.join(' / ');
}

export function DataPane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  enabled = true,
}: DataPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root, includeAll: true });
  const orgName =
    scope.options.find((option) => option.isOrgWideSharing)?.label ??
    scope.options.find((option) => option.key.startsWith('team-'))?.label ??
    null;
  const scopeSections = React.useMemo(
    () => buildDataScopeSections(assistant, ownerId, assistantId, scope.root, orgName),
    [assistant, ownerId, assistantId, scope.root, orgName]
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
  const [cwd, setCwd] = React.useState<DataCwd | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [leafMeta, setLeafMeta] = React.useState<LeafMeta | null>(null);
  const [selectedRow, setSelectedRow] = React.useState<DataRow | null>(null);
  const [editField, setEditField] = React.useState<string | null>(null);
  const [selectedCells, setSelectedCells] = React.useState<string[]>([]);
  const [viewPanelOpen, setViewPanelOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [appendImportOpen, setAppendImportOpen] = React.useState(false);
  const isStackedLayout = useMatchesBelow('tablet');
  const [mobileShowTree, setMobileShowTree] = React.useState(true);

  // Initialize / reset cwd when sections or mode change.
  React.useEffect(() => {
    if (mode !== 'data') {
      setCwd(null);
      return;
    }
    if (scopeSections.length === 1) {
      setCwd({ sectionKey: scopeSections[0]!.key, segments: [] });
    } else {
      setCwd(null);
    }
  }, [mode, scopeSections]);

  React.useEffect(() => {
    if (!isStackedLayout) return;
    setSidebarOpen(false);
    if (selected) setMobileShowTree(false);
  }, [isStackedLayout, selected]);

  React.useEffect(() => {
    setSelectedCells([]);
    setViewPanelOpen(false);
  }, [selected]);

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
    queryFn: listAssistantsContexts,
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

  React.useEffect(() => {
    setSelected(null);
    setSelectedRow(null);
    setLeafMeta(null);
  }, [scope.activeKey]);

  React.useEffect(() => {
    setSelected((prev) => (prev && !selectableContexts.includes(prev) ? null : prev));
  }, [selectableContexts]);

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

  const cwdSection = (() => {
    const effective =
      cwd ??
      (mode === 'data' && scopeSections.length === 1
        ? { sectionKey: scopeSections[0]!.key, segments: [] as string[] }
        : null);
    if (!effective) return undefined;
    return scopeSections.find((s) => s.key === effective.sectionKey);
  })();
  const effectiveCwd: DataCwd | null =
    cwd ??
    (mode === 'data' && scopeSections.length === 1
      ? { sectionKey: scopeSections[0]!.key, segments: [] }
      : null);
  const cwdTree = cwdSection
    ? sectionTrees.find(({ section }) => section.key === cwdSection.key)?.tree
    : undefined;
  const folderChildren =
    mode === 'data' && effectiveCwd && cwdTree ? childrenAtCwd(cwdTree, effectiveCwd.segments) : [];
  const locationLabel = cwdLocationLabel(
    cwdSection,
    effectiveCwd?.segments ?? [],
    showScopeHeaders || scopeSections.length > 1
  );

  const onTableCreated = React.useCallback(
    async (context: string) => {
      await refreshTree();
      selectLeaf(context);
    },
    [refreshTree, selectLeaf]
  );

  const topNodeCount = sectionTrees.reduce(
    (sum, { tree: sectionTree }) => sum + sectionTree.children.size,
    0
  );

  const selectedDisplayPath = selected ? displayPathForContext(selected) : null;
  const selectedTableName = selectedDisplayPath
    ? (selectedDisplayPath.split('/').pop() ?? selectedDisplayPath)
    : null;
  const emptyTreeCopy = `No ${mode} contexts yet.`;
  const emptySelectCopy =
    mode === 'data'
      ? 'Select a table from the directory to browse its rows.'
      : showDirectory
        ? `Select a ${mode} table from the directory to browse its rows.`
        : `No ${mode} table found for this assistant.`;
  const sidebarTitle = mode === 'data' ? 'Data' : mode;

  const smTreeList = (
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
              {showScopeHeaders ? (
                <ScopeSectionHeader
                  section={section}
                  imageUrl={scope.options.find((option) => option.key === section.key)?.imageUrl}
                  isOrgWideSharing={
                    scope.options.find((option) => option.key === section.key)?.isOrgWideSharing
                  }
                />
              ) : null}
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

  const dataFolderList =
    mode === 'data' ? (
      <DataFolderBrowser
        cwd={effectiveCwd}
        sections={scopeSections.map((section) => ({
          key: section.key,
          kind: section.kind,
          label: section.label,
          imageUrl: scope.options.find((option) => option.key === section.key)?.imageUrl,
          isOrgWideSharing: scope.options.find((option) => option.key === section.key)
            ?.isOrgWideSharing,
        }))}
        showSectionPicker={showScopeHeaders || scopeSections.length > 1}
        entries={folderChildren}
        selectedContext={selected}
        locationLabel={locationLabel}
        onEnterSection={(sectionKey) => setCwd({ sectionKey, segments: [] })}
        onBackToScopes={() => setCwd(null)}
        onNavigate={(segments) => {
          const base = effectiveCwd;
          if (!base) return;
          setCwd({ sectionKey: base.sectionKey, segments });
        }}
        onOpenTable={selectLeaf}
        onNewTable={() => setCreateOpen(true)}
        onUpload={() => setImportOpen(true)}
      />
    ) : (
      smTreeList
    );

  const leafTable = selected ? (
    <DataLeafTable
      context={selected}
      mode={mode}
      selectedRowId={selectedRow ? String(selectedRow.logId) : null}
      onRowSelect={(row, options) => {
        setSelectedRow(row);
        setEditField(options?.editField ?? null);
      }}
      selectedCells={selectedCells}
      onSelectCells={setSelectedCells}
      viewPanelOpen={viewPanelOpen}
      onViewPanelOpenChange={setViewPanelOpen}
      onMetaChange={setLeafMeta}
      refreshToken={refreshToken}
      onImportRows={mode === 'data' ? () => setAppendImportOpen(true) : undefined}
    />
  ) : null;

  const modeToolbar = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <ModeSegments mode={mode} onChange={changeMode} />
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <BrainScopeDropdown scope={scope} ariaLabel="Data ownership scope" />
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
      </div>
    </div>
  );

  const directoryToggle =
    showDirectory && !isStackedLayout ? (
      <button
        type="button"
        onClick={() => setSidebarOpen((open) => !open)}
        className="text-body-muted inline-flex shrink-0 items-center rounded-md p-1.5 transition-colors hover:bg-muted hover:text-foreground"
        aria-label={sidebarOpen ? 'Collapse data directory' : 'Expand data directory'}
        aria-expanded={sidebarOpen}
        data-testid={sidebarOpen ? 'data-sidebar-collapse' : 'data-sidebar-expand'}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    ) : null;

  const topToolbar = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
      {isStackedLayout && showDirectory && selected && !mobileShowTree ? (
        <button
          type="button"
          onClick={() => setMobileShowTree(true)}
          className="text-body-muted inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground"
          data-testid="data-mobile-back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {sidebarTitle}
        </button>
      ) : (
        directoryToggle
      )}
      {modeToolbar}
    </div>
  );

  // Data mode always offers the folder browser (create/upload live there).
  const showTreeSidebar =
    (mode === 'data' || showDirectory) &&
    (isStackedLayout ? mobileShowTree || !selected : sidebarOpen);
  const showLeafPane =
    !isStackedLayout || !(mode === 'data' || showDirectory) || (selected && !mobileShowTree);

  const canCreateInFolder = mode === 'data' && !!effectiveCwd && !!cwdSection;

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

          {topToolbar}

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {showTreeSidebar && (
              <div
                className={cn(
                  'flex min-h-0 flex-col overflow-hidden bg-card',
                  isStackedLayout ? 'min-w-0 flex-1' : 'w-72 shrink-0 border-r border-border'
                )}
              >
                {dataFolderList}
              </div>
            )}

            {showLeafPane && (
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {selected ? (
                  leafTable
                ) : (
                  <div className="flex h-full items-center justify-center p-8 text-center">
                    <div className="max-w-sm">
                      <Table2
                        className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-body-muted">{emptySelectCopy}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DataRowDetail
            row={selectedRow}
            title={selectedTableName ?? selectedDisplayPath ?? 'Data row'}
            description={selectedDisplayPath ?? undefined}
            fields={leafMeta?.fields ?? {}}
            mode={mode}
            initialEditField={editField}
            onSave={saveField}
            onDelete={deleteSelectedRow}
            onClose={() => {
              setSelectedRow(null);
              setEditField(null);
            }}
          />

          {canCreateInFolder && cwdSection && effectiveCwd ? (
            <>
              <DataCreateTableDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                scopePrefix={cwdSection.browserRoot.prefix}
                cwdSegments={effectiveCwd.segments}
                locationLabel={locationLabel}
                onCreated={(context) => void onTableCreated(context)}
              />
              <DataImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                mode="create"
                scopePrefix={cwdSection.browserRoot.prefix}
                cwdSegments={effectiveCwd.segments}
                locationLabel={locationLabel}
                onComplete={(context) => void onTableCreated(context)}
              />
            </>
          ) : null}

          {selected && mode === 'data' ? (
            <DataImportDialog
              open={appendImportOpen}
              onOpenChange={setAppendImportOpen}
              mode="append"
              context={selected}
              onComplete={() => {
                void refreshTree();
                setRefreshToken((t) => t + 1);
              }}
            />
          ) : null}

          <TabFooter
            testId="data-footer"
            right={
              <span className="text-caption inline-flex items-center gap-1.5">
                <Database className="h-3 w-3" aria-hidden="true" />
                {selected && leafMeta
                  ? `${displayPathForContext(selected)} · ${leafMeta.count} ${leafMeta.count === 1 ? 'row' : 'rows'}`
                  : mode === 'data' && effectiveCwd
                    ? locationLabel
                    : `${topNodeCount} ${topNodeCount === 1 ? 'group' : 'groups'} at this level`}
              </span>
            }
          />
        </>
      )}
    </div>
  );
}
