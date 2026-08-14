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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TabSplitSkeleton } from '@/components/Common/Loaders/Skeletons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { Input } from '@/components/UI/input';
import { roots, rootKey, type ContextRoot } from '@/lib/assistants/scope';
import {
  buildDataBrowserTree,
  collectSelectableContexts,
  resolveDataTableContext,
  treeNeedsFolderView,
  type DataBrowserRoot,
  type DataCwd,
  type DataTreeNode,
} from '@/lib/assistants/dataBrowser';
import {
  deleteAssistantsContext,
  listAssistantsContexts,
  renameAssistantsContext,
} from '@/lib/assistants/dataContexts';
import { useShellResource } from '@/hooks/Common/useShellResource';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { TabFooter } from '../Common/TabFooter';
import { TeamAvatar } from '../OrgChat/TeamAvatar';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { DataLeafTable } from './DataLeafTable';
import { DataRowDetail } from './DataRowDetail';
import { DataFolderAddMenu } from './DataFolderAddMenu';
import { DataTableMenu } from './DataTableMenu';
import { DataCreateTableDialog } from './DataCreateTableDialog';
import { DataImportDialog } from './DataImportDialog';
import { friendlyLogUpdateError, type DataField, type DataRow } from './dataTypes';
import type { Assistant } from '@/types/assistants/assistant';
import { resolveManagedTeamDisplayName } from '@/utils/teams/managedTeamDisplay';
import { isImeComposing } from '@/utils/keyboard';

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

function formatCreateLocationLabel(
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

interface DataTableTarget {
  context: string;
  name: string;
  sectionKey: string;
  /** Path segments under Data/ including the leaf name. */
  segments: string[];
}

function TreeRow({
  node,
  depth,
  segments,
  sectionKey,
  expanded,
  toggle,
  selected,
  onSelect,
  onAddInFolder,
  renamingContext,
  renameDraft,
  onRenameDraftChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
}: {
  node: DataTreeNode;
  depth: number;
  /** Path segments under Data/ to this node (includes `node.name`). */
  segments: string[];
  sectionKey: string;
  expanded: Set<string>;
  toggle: (key: string) => void;
  selected: string | null;
  onSelect: (context: string) => void;
  onAddInFolder?: (target: DataCwd) => { onNewTable: () => void; onUpload: () => void };
  renamingContext: string | null;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onStartRename?: (target: DataTableTarget) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onRequestDelete?: (target: DataTableTarget) => void;
}) {
  const children = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
  const hasChildren = children.length > 0;
  const canSelect = node.context !== null;
  const key = node.context ?? `${node.name}${depth}`;
  const isOpen = expanded.has(key);
  const isSelected = canSelect && selected === node.context;
  const isFolderNest = hasChildren;
  const isLeafTable = canSelect && !hasChildren;
  const isRenaming = isLeafTable && renamingContext === node.context;
  const addActions = isFolderNest && onAddInFolder ? onAddInFolder({ sectionKey, segments }) : null;
  const tableTarget: DataTableTarget | null =
    isLeafTable && node.context
      ? { context: node.context, name: node.name, sectionKey, segments }
      : null;

  return (
    <div>
      <div
        className={cn(
          'group flex w-full items-center gap-0.5 rounded-md text-sm transition-colors',
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
        {isRenaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 pr-1">
            <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              value={renameDraft}
              onChange={(e) => onRenameDraftChange(e.target.value)}
              autoFocus
              className="h-7 min-w-0 flex-1 px-1.5 py-0 text-sm"
              data-testid="data-table-rename-input"
              aria-label={`Rename ${node.name}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (isImeComposing(e)) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  onCommitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelRename();
                }
              }}
              onBlur={() => onCommitRename()}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => (canSelect ? onSelect(node.context!) : toggle(key))}
            data-testid={isLeafTable ? 'data-table-node' : 'data-folder-node'}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-1 text-left"
          >
            {isLeafTable ? (
              <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
        )}
        {addActions ? (
          <DataFolderAddMenu
            folderLabel={node.name}
            pathKey={segments.join('/')}
            onNewTable={addActions.onNewTable}
            onUpload={addActions.onUpload}
            className="mr-1"
          />
        ) : null}
        {tableTarget && onStartRename && onRequestDelete && !isRenaming ? (
          <DataTableMenu
            tableLabel={node.name}
            pathKey={segments.join('/')}
            onRename={() => onStartRename(tableTarget)}
            onDelete={() => onRequestDelete(tableTarget)}
            className="mr-1"
          />
        ) : null}
      </div>
      {hasChildren && isOpen && (
        <div>
          {children.map((child) => (
            <TreeRow
              key={child.name}
              node={child}
              depth={depth + 1}
              segments={[...segments, child.name]}
              sectionKey={sectionKey}
              expanded={expanded}
              toggle={toggle}
              selected={selected}
              onSelect={onSelect}
              onAddInFolder={onAddInFolder}
              renamingContext={renamingContext}
              renameDraft={renameDraft}
              onRenameDraftChange={onRenameDraftChange}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onRequestDelete={onRequestDelete}
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
  addActions,
}: {
  section: DataScopeSection;
  imageUrl?: string | null;
  isOrgWideSharing?: boolean;
  addActions?: { onNewTable: () => void; onUpload: () => void } | null;
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
      {addActions ? (
        <DataFolderAddMenu
          folderLabel={`${section.label} Data`}
          pathKey=""
          onNewTable={addActions.onNewTable}
          onUpload={addActions.onUpload}
        />
      ) : null}
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
  const displayPathForContext = React.useCallback(
    (full: string): string => {
      const section = scopeSections.find((s) => full.startsWith(s.browserRoot.prefix));
      if (!section) return full;
      const rel = full.slice(section.browserRoot.prefix.length);
      return showScopeHeaders ? `${section.label} / ${rel}` : rel;
    },
    [scopeSections, showScopeHeaders]
  );

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [createTarget, setCreateTarget] = React.useState<DataCwd | null>(null);
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
  const [renamingTarget, setRenamingTarget] = React.useState<DataTableTarget | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const [renameSaving, setRenameSaving] = React.useState(false);
  const renameCancelledRef = React.useRef(false);
  const renameInFlightRef = React.useRef(false);
  const [deleteTarget, setDeleteTarget] = React.useState<DataTableTarget | null>(null);
  const [deleteSaving, setDeleteSaving] = React.useState(false);
  const isStackedLayout = useMatchesBelow('tablet');
  const [mobileShowTree, setMobileShowTree] = React.useState(true);

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
        tree: buildDataBrowserTree(contextNames ?? [], [section.browserRoot]),
      })),
    [scopeSections, contextNames]
  );

  const selectableContexts = React.useMemo(
    () => sectionTrees.flatMap(({ tree: sectionTree }) => collectSelectableContexts(sectionTree)),
    [sectionTrees]
  );
  const showDirectory =
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

  const openCreateInFolder = React.useCallback((target: DataCwd) => {
    setCreateTarget(target);
    setCreateOpen(true);
  }, []);

  const openUploadInFolder = React.useCallback((target: DataCwd) => {
    setCreateTarget(target);
    setImportOpen(true);
  }, []);

  const addActionsForFolder = React.useCallback(
    (target: DataCwd) => ({
      onNewTable: () => openCreateInFolder(target),
      onUpload: () => openUploadInFolder(target),
    }),
    [openCreateInFolder, openUploadInFolder]
  );

  const startRenameTable = React.useCallback((target: DataTableTarget) => {
    renameCancelledRef.current = false;
    setRenamingTarget(target);
    setRenameDraft(target.name);
  }, []);

  const cancelRenameTable = React.useCallback(() => {
    if (renameSaving) return;
    renameCancelledRef.current = true;
    setRenamingTarget(null);
    setRenameDraft('');
  }, [renameSaving]);

  const commitRenameTable = React.useCallback(async () => {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }
    if (!renamingTarget || renameInFlightRef.current) return;
    const draft = renameDraft.trim();
    if (!draft || draft === renamingTarget.name) {
      setRenamingTarget(null);
      setRenameDraft('');
      return;
    }
    if (draft.includes('/')) {
      toast.error('Table name cannot contain /.');
      return;
    }
    const section = scopeSections.find((s) => s.key === renamingTarget.sectionKey);
    if (!section) {
      toast.error('Could not rename table. Please try again.');
      return;
    }
    const parentSegments = renamingTarget.segments.slice(0, -1);
    const resolved = resolveDataTableContext(section.browserRoot.prefix, parentSegments, draft);
    if ('error' in resolved) {
      toast.error(resolved.error);
      return;
    }
    if (resolved.context === renamingTarget.context) {
      setRenamingTarget(null);
      setRenameDraft('');
      return;
    }

    renameInFlightRef.current = true;
    setRenameSaving(true);
    try {
      const result = await renameAssistantsContext(renamingTarget.context, resolved.context);
      if (!result.ok) {
        toast.error('Could not rename table. Please try again.');
        return;
      }
      const previous = renamingTarget.context;
      setRenamingTarget(null);
      setRenameDraft('');
      await refreshTree();
      if (selected === previous) {
        selectLeaf(resolved.context);
      }
    } finally {
      renameInFlightRef.current = false;
      setRenameSaving(false);
    }
  }, [renamingTarget, renameDraft, scopeSections, refreshTree, selected, selectLeaf]);

  const confirmDeleteTable = React.useCallback(async () => {
    if (!deleteTarget || deleteSaving) return;
    setDeleteSaving(true);
    try {
      const result = await deleteAssistantsContext(deleteTarget.context);
      if (!result.ok) {
        toast.error('Could not delete table. Please try again.');
        return;
      }
      const removed = deleteTarget.context;
      setDeleteTarget(null);
      if (selected === removed) {
        setSelected(null);
        setSelectedRow(null);
        setLeafMeta(null);
      }
      await refreshTree();
    } finally {
      setDeleteSaving(false);
    }
  }, [deleteTarget, deleteSaving, selected, refreshTree]);

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
        const body: unknown = await res.json().catch(() => null);
        const detail =
          body && typeof body === 'object' && 'detail' in body
            ? String((body as { detail: unknown }).detail)
            : undefined;
        console.error('Failed to save data row field', detail ?? res.status);
        throw new Error(friendlyLogUpdateError(detail));
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
  const emptySelectCopy = 'Select a table from the directory to browse its rows.';

  const createTargetSection = createTarget
    ? scopeSections.find((s) => s.key === createTarget.sectionKey)
    : undefined;
  const createLocationLabel = formatCreateLocationLabel(
    createTargetSection,
    createTarget?.segments ?? [],
    showScopeHeaders || scopeSections.length > 1
  );

  const treeList = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="data-folder-browser">
      {!showScopeHeaders && scopeSections[0] ? (
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1.5"
          data-testid="data-tree-root-chrome"
        >
          <p className="text-caption truncate text-muted-foreground">Data</p>
          <DataFolderAddMenu
            folderLabel="Data"
            pathKey=""
            {...addActionsForFolder({ sectionKey: scopeSections[0].key, segments: [] })}
          />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="data-tree">
        {topNodeCount === 0 ? (
          <div className="px-2 py-6 text-center" data-testid="data-folder-empty">
            <p className="text-caption text-muted-foreground">No tables yet.</p>
            <p className="text-caption mt-1 text-muted-foreground">
              Use + to create a table or upload a file.
            </p>
          </div>
        ) : (
          sectionTrees.map(({ section, tree: sectionTree }) => {
            const nodes = Array.from(sectionTree.children.values()).sort((a, b) =>
              a.name.localeCompare(b.name)
            );
            const sectionAdd = showScopeHeaders
              ? addActionsForFolder({ sectionKey: section.key, segments: [] })
              : null;
            return (
              <div key={section.key} className={showScopeHeaders ? 'mb-2' : undefined}>
                {showScopeHeaders ? (
                  <ScopeSectionHeader
                    section={section}
                    imageUrl={scope.options.find((option) => option.key === section.key)?.imageUrl}
                    isOrgWideSharing={
                      scope.options.find((option) => option.key === section.key)?.isOrgWideSharing
                    }
                    addActions={sectionAdd}
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
                      segments={[node.name]}
                      sectionKey={section.key}
                      expanded={expanded}
                      toggle={toggle}
                      selected={selected}
                      onSelect={selectLeaf}
                      onAddInFolder={addActionsForFolder}
                      renamingContext={renamingTarget?.context ?? null}
                      renameDraft={renameDraft}
                      onRenameDraftChange={setRenameDraft}
                      onStartRename={startRenameTable}
                      onCommitRename={() => void commitRenameTable()}
                      onCancelRename={cancelRenameTable}
                      onRequestDelete={setDeleteTarget}
                    />
                  ))
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const leafTable = selected ? (
    <DataLeafTable
      context={selected}
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
      onImportRows={() => setAppendImportOpen(true)}
    />
  ) : null;

  const scopeToolbar = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
          Data
        </button>
      ) : (
        directoryToggle
      )}
      {scopeToolbar}
    </div>
  );

  const showTreeSidebar = isStackedLayout ? mobileShowTree || !selected : sidebarOpen;
  const showLeafPane = !isStackedLayout || (selected && !mobileShowTree);

  const canCreateInFolder = !!createTarget && !!createTargetSection;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      data-testid="data-pane"
      data-scope={scope.activeKey}
    >
      {isLoadingTree ? (
        <TabSplitSkeleton className="min-h-0 flex-1" listRows={8} />
      ) : (
        <>
          {topToolbar}

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {showTreeSidebar && (
              <div
                className={cn(
                  'flex min-h-0 flex-col overflow-hidden bg-card',
                  isStackedLayout ? 'min-w-0 flex-1' : 'w-72 shrink-0 border-r border-border'
                )}
              >
                {treeList}
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
            initialEditField={editField}
            onSave={saveField}
            onDelete={deleteSelectedRow}
            onClose={() => {
              setSelectedRow(null);
              setEditField(null);
            }}
          />

          {canCreateInFolder && createTargetSection && createTarget ? (
            <>
              <DataCreateTableDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                scopePrefix={createTargetSection.browserRoot.prefix}
                cwdSegments={createTarget.segments}
                locationLabel={createLocationLabel}
                onCreated={(context) => void onTableCreated(context)}
              />
              <DataImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                mode="create"
                scopePrefix={createTargetSection.browserRoot.prefix}
                cwdSegments={createTarget.segments}
                locationLabel={createLocationLabel}
                onComplete={(context) => void onTableCreated(context)}
              />
            </>
          ) : null}

          {selected ? (
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

          <AlertDialog
            open={deleteTarget != null}
            onOpenChange={(open) => {
              if (!open && !deleteSaving) setDeleteTarget(null);
            }}
          >
            <AlertDialogContent data-testid="data-delete-table-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete table?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes “{deleteTarget?.name}” and all of its rows. This cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteSaving}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void confirmDeleteTable();
                  }}
                  disabled={deleteSaving}
                  data-testid="data-delete-table-confirm"
                >
                  {deleteSaving ? 'Deleting…' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
