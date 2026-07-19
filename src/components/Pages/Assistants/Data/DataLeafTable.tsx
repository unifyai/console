'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogGrid } from '@/components/Common/LogGrid';
import { LogCellViewPanel, cellsFromSelection } from '@/components/Common/LogGrid/LogCellViewPanel';
import { useInfiniteLogQuery } from '@/hooks/logs/useInfiniteLogQuery';
import { useLogViewState } from '@/hooks/logs/useLogViewState';
import {
  DEFAULT_LOG_PAGE_SIZE,
  defaultHiddenForFields,
  emptyLogViewState,
  type LogGridRow,
  type SelectionModel,
} from '@/lib/logs';
import {
  coerceFieldDraft,
  draftStringForField,
  isDataFieldEditable,
  type DataField,
  type DataRow,
} from './dataTypes';
import type { DataBrowserMode } from '@/lib/assistants/dataBrowser';
import { isStateManagerMode } from '@/lib/assistants/dataBrowser';
import {
  createEmptyLogRow,
  createLogField,
  deleteLogField,
  renameLogField,
  updateLogEntries,
} from '@/lib/logs/mutations';
import { reconcileColumnOrder, sanitizeId } from '@/lib/logs/columns';
import { toast } from 'sonner';
import { DataColumnNameDialog } from './DataColumnNameDialog';
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

function normalizeBoolFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function fieldsToDataFields(
  fields: Record<
    string,
    {
      dataType?: string;
      fieldType?: string;
      mutable?: string | boolean;
      uiEditable?: string | boolean;
      enumValues?: string[] | null;
      restrict?: boolean;
      [key: string]: unknown;
    }
  >
): Record<string, DataField> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      {
        dataType: value.dataType,
        fieldType: value.fieldType,
        mutable: normalizeBoolFlag(value.mutable),
        uiEditable: normalizeBoolFlag(value.uiEditable),
        enumValues: Array.isArray(value.enumValues) ? (value.enumValues as string[]) : null,
        restrict: typeof value.restrict === 'boolean' ? value.restrict : undefined,
      } satisfies DataField,
    ])
  );
}

function toDataRow(row: LogGridRow): DataRow {
  return { logId: row.logId, entries: row.entries };
}

interface DataLeafTableProps {
  context: string;
  mode: DataBrowserMode;
  selectedRowId: string | null;
  onRowSelect: (row: DataRow | null, options?: { editField?: string }) => void;
  /** Lifted so layout remounts (stacked ↔ desktop) keep the current cell selection. */
  selectedCells: string[];
  onSelectCells: (cells: string[]) => void;
  viewPanelOpen: boolean;
  onViewPanelOpenChange: (open: boolean) => void;
  onMetaChange?: (meta: { count: number; fields: Record<string, DataField> }) => void;
  refreshToken?: number;
  onRowsChange?: (rows: DataRow[]) => void;
  /** Open import-rows dialog (Data mode only). */
  onImportRows?: () => void;
}

/**
 * Data-tab leaf host: session view-state + infinite log query + shared LogGrid
 * with cell-selection viewing panel (Interfaces view-tile style).
 */
export function DataLeafTable({
  context,
  mode,
  selectedRowId: _selectedRowId,
  onRowSelect: _onRowSelect,
  selectedCells,
  onSelectCells,
  viewPanelOpen,
  onViewPanelOpenChange,
  onMetaChange,
  refreshToken = 0,
  onRowsChange,
  onImportRows,
}: DataLeafTableProps) {
  const queryClient = useQueryClient();
  const [view, setView, replaceView] = useLogViewState(context);
  const [browseRows, setBrowseRows] = React.useState<LogGridRow[]>([]);
  const [rowLabels, setRowLabels] = React.useState<Map<string, string>>(() => new Map());
  const [addColumnOpen, setAddColumnOpen] = React.useState(false);
  const [renameColumn, setRenameColumn] = React.useState<string | null>(null);
  const [deleteColumn, setDeleteColumn] = React.useState<string | null>(null);

  const initializedRef = React.useRef<string | null>(null);

  const {
    rows,
    count,
    fields,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
    spec,
  } = useInfiniteLogQuery({
    projectName: 'Assistants',
    context,
    view,
    enabled: !!context,
  });

  React.useEffect(() => {
    // Keep rowLabels: LogGrid sets them in a child effect, and wiping here
    // afterwards (child effects run first) leaves the view-pane gutter empty.
    setBrowseRows([]);
  }, [context]);

  React.useEffect(() => {
    if (!context || !Object.keys(fields).length) return;
    if (initializedRef.current === context) return;
    initializedRef.current = context;
    const existing = view;
    const fieldNames = Object.keys(fields);
    const defaults = defaultHiddenForFields(fieldNames);
    const needsInit =
      existing.columnOrder.length === 0 ||
      (existing.hiddenColumns.length === 0 && defaults.length > 0);
    if (needsInit) {
      replaceView(
        emptyLogViewState({
          ...existing,
          columnOrder: fieldNames.sort((a, b) => a.localeCompare(b)),
          hiddenColumns: existing.hiddenColumns.length ? existing.hiddenColumns : defaults,
          limit: DEFAULT_LOG_PAGE_SIZE,
          offset: 0,
        })
      );
    } else if (existing.limit !== DEFAULT_LOG_PAGE_SIZE || existing.offset !== 0) {
      setView({ limit: DEFAULT_LOG_PAGE_SIZE, offset: 0 });
    }
  }, [context, fields, view, replaceView, setView]);

  const columns = React.useMemo(() => {
    const set = new Set(Object.keys(fields));
    rows.forEach((row) =>
      Object.keys(row.entries).forEach((key) => {
        if (!key.startsWith('_')) set.add(key);
      })
    );
    browseRows.forEach((row) =>
      Object.keys(row.entries).forEach((key) => {
        if (!key.startsWith('_')) set.add(key);
      })
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fields, rows, browseRows]);

  React.useEffect(() => {
    onMetaChange?.({
      count,
      fields: fieldsToDataFields(fields),
    });
  }, [count, fields, onMetaChange]);

  React.useEffect(() => {
    onRowsChange?.(rows.map(toDataRow));
  }, [rows, onRowsChange]);

  const refetchRef = React.useRef(refetch);
  refetchRef.current = refetch;

  React.useEffect(() => {
    if (refreshToken > 0) refetchRef.current();
  }, [refreshToken]);

  const refreshAll = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['logFields', 'Assistants', context] });
    await queryClient.refetchQueries({ queryKey: ['logFields', 'Assistants', context] });
    await queryClient.invalidateQueries({ queryKey: ['logInfiniteQuery', 'Assistants', context] });
    await queryClient.invalidateQueries({ queryKey: ['logMetrics'] });
    await refetch();
  }, [queryClient, context, refetch]);

  const prevColumnsRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    prevColumnsRef.current = [];
  }, [context]);

  React.useEffect(() => {
    if (!columns.length) return;
    const next = reconcileColumnOrder(view.columnOrder, columns, prevColumnsRef.current);
    prevColumnsRef.current = columns;
    const same =
      next.length === view.columnOrder.length && next.every((id, i) => id === view.columnOrder[i]);
    if (!same) setView({ columnOrder: next });
  }, [columns, view.columnOrder, setView]);

  const selection: SelectionModel = React.useMemo(
    () => ({
      mode: 'cell',
      selectedCells,
      onSelectCells,
    }),
    [selectedCells, onSelectCells]
  );

  const panelRows = React.useMemo(
    () => (browseRows.length ? browseRows : rows),
    [browseRows, rows]
  );

  const cellSelections = React.useMemo(
    () => cellsFromSelection(selectedCells, panelRows, rowLabels),
    [selectedCells, panelRows, rowLabels]
  );

  const showPanel = viewPanelOpen && selectedCells.length > 0;

  React.useEffect(() => {
    if (selectedCells.length === 0) {
      onViewPanelOpenChange(false);
    }
  }, [selectedCells.length, onViewPanelOpenChange]);

  const dataFields = React.useMemo(() => fieldsToDataFields(fields), [fields]);

  const resolveField = React.useCallback(
    (columnId: string): { key: string; field: DataField } => {
      const sanitized = sanitizeId(columnId);
      if (dataFields[sanitized]) return { key: sanitized, field: dataFields[sanitized]! };
      if (dataFields[columnId]) return { key: columnId, field: dataFields[columnId]! };
      const lower = sanitized.toLowerCase();
      const match = Object.entries(dataFields).find(([key]) => key.toLowerCase() === lower);
      if (match) return { key: match[0], field: match[1] };
      return { key: sanitized, field: {} };
    },
    [dataFields]
  );

  const isColumnEditable = React.useCallback(
    (columnId: string) => isDataFieldEditable(resolveField(columnId).field, mode),
    [resolveField, mode]
  );

  const draftForValue = React.useCallback(
    (columnId: string, value: unknown) => draftStringForField(resolveField(columnId).field, value),
    [resolveField]
  );

  const onCommitEdit = React.useCallback(
    async (logIds: number[], columnId: string, draft: string) => {
      if (logIds.length === 0) return true;
      const { key, field } = resolveField(columnId);
      // Value groups only collapse equal cells, so any member's current value
      // is representative for coerce / no-op detection.
      const sampleId = logIds[0]!;
      const row = panelRows.find((r) => r.logId === sampleId);
      const current = row?.entries[key] ?? row?.entries[columnId];
      let nextValue: unknown;
      try {
        nextValue = coerceFieldDraft(field, draft, current);
      } catch (error) {
        console.error('Invalid cell edit draft', error);
        toast.error('Could not save changes. Please try again.');
        return false;
      }
      if (JSON.stringify(nextValue) === JSON.stringify(current)) return true;
      const result = await updateLogEntries({
        projectName: 'Assistants',
        context,
        logIds,
        entries: { [key]: nextValue },
      });
      if (!result.ok) {
        toast.error('Could not save changes. Please try again.');
        return false;
      }
      await refreshAll();
      return true;
    },
    [resolveField, panelRows, context, refreshAll]
  );

  const allowSchemaEdit = mode === 'data';

  const handleAddRow = React.useCallback(async () => {
    const entries: Record<string, unknown> = {};
    for (const [name, meta] of Object.entries(fields)) {
      if (meta.fieldType === 'entry' || !meta.fieldType) {
        entries[name] = null;
      }
    }
    const result = await createEmptyLogRow({
      projectName: 'Assistants',
      context,
      entries: Object.keys(entries).length ? entries : {},
    });
    if (!result.ok) {
      toast.error('Could not add row. Please try again.');
      return;
    }
    await refreshAll();
  }, [fields, context, refreshAll]);

  const handleAddColumn = React.useCallback(
    async (name: string, dataType?: string) => {
      if (!dataType) return;
      const result = await createLogField({
        projectName: 'Assistants',
        context,
        fieldName: name,
        dataType,
      });
      if (!result.ok) {
        toast.error('Could not add column. Please try again.');
        return;
      }
      await refreshAll();
    },
    [context, refreshAll]
  );

  const handleRenameColumn = React.useCallback(
    async (newName: string) => {
      if (!renameColumn) return;
      if (newName === renameColumn) return;
      const result = await renameLogField({
        projectName: 'Assistants',
        context,
        oldFieldName: renameColumn,
        newFieldName: newName,
      });
      if (!result.ok) {
        toast.error('Could not rename column. Please try again.');
        return;
      }
      setView({
        columnOrder: view.columnOrder.map((c) => (c === renameColumn ? newName : c)),
        hiddenColumns: view.hiddenColumns.map((c) => (c === renameColumn ? newName : c)),
      });
      await refreshAll();
    },
    [renameColumn, context, refreshAll, setView, view.columnOrder, view.hiddenColumns]
  );

  const handleDeleteColumn = React.useCallback(async () => {
    if (!deleteColumn) return;
    const column = deleteColumn;
    const prevOrder = view.columnOrder;
    const prevHidden = view.hiddenColumns;
    // Drop from the grid immediately on confirm; refresh catches up the schema.
    setDeleteColumn(null);
    setView({
      columnOrder: prevOrder.filter((c) => c !== column),
      hiddenColumns: prevHidden.filter((c) => c !== column),
    });
    const result = await deleteLogField({
      projectName: 'Assistants',
      context,
      fieldName: column,
    });
    if (!result.ok) {
      console.error('Failed to delete column', result);
      setView({ columnOrder: prevOrder, hiddenColumns: prevHidden });
      toast.error('Could not delete column. Please try again.');
      return;
    }
    await refreshAll();
  }, [deleteColumn, context, refreshAll, setView, view.columnOrder, view.hiddenColumns]);

  return (
    <>
      <LogGrid
        projectName="Assistants"
        context={context}
        rows={rows}
        fields={fields}
        columns={columns}
        totalCount={count}
        view={view}
        onViewChange={setView}
        isLoading={isLoading}
        isFetching={isFetching}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        error={error}
        onRetry={() => void refetch()}
        onBrowseRowsChange={setBrowseRows}
        onRowLabelsChange={setRowLabels}
        selection={selection}
        hasSelection={selectedCells.length > 0}
        viewPanelOpen={viewPanelOpen}
        onToggleViewPanel={() => {
          onViewPanelOpenChange(!viewPanelOpen);
        }}
        onOpenViewPanel={() => {
          onViewPanelOpenChange(true);
        }}
        isColumnEditable={isColumnEditable}
        draftForCell={draftForValue}
        onCommitCellEdit={async (logId, columnId, draft) => onCommitEdit([logId], columnId, draft)}
        filter={spec?.filter}
        onDerivedCreated={() => {
          void refreshAll();
        }}
        onMutated={() => void refreshAll()}
        allowDelete={!isStateManagerMode(mode)}
        onAddRow={allowSchemaEdit ? () => void handleAddRow() : undefined}
        onAddColumn={allowSchemaEdit ? () => setAddColumnOpen(true) : undefined}
        onImportRows={allowSchemaEdit ? onImportRows : undefined}
        onRenameColumn={allowSchemaEdit ? (key) => setRenameColumn(key) : undefined}
        onDeleteColumn={allowSchemaEdit ? (key) => setDeleteColumn(key) : undefined}
        testId="data-leaf-table"
        className="min-h-0 min-w-0 flex-1"
        viewPanel={
          showPanel ? (
            <LogCellViewPanel
              cells={cellSelections}
              onClose={() => {
                onViewPanelOpenChange(false);
              }}
              isColumnEditable={isColumnEditable}
              onCommitEdit={onCommitEdit}
              draftForValue={draftForValue}
            />
          ) : null
        }
      />
      {allowSchemaEdit ? (
        <>
          <DataColumnNameDialog
            open={addColumnOpen}
            onOpenChange={setAddColumnOpen}
            title="Add column"
            submitLabel="Add"
            testId="data-add-column-dialog"
            showDataType
            onSubmit={handleAddColumn}
          />
          <DataColumnNameDialog
            open={renameColumn != null}
            onOpenChange={(open) => {
              if (!open) setRenameColumn(null);
            }}
            title="Rename column"
            initialName={renameColumn ?? ''}
            submitLabel="Rename"
            testId="data-rename-column-dialog"
            onSubmit={handleRenameColumn}
          />
          <AlertDialog
            open={deleteColumn != null}
            onOpenChange={(open) => {
              if (!open) setDeleteColumn(null);
            }}
          >
            <AlertDialogContent data-testid="data-delete-column-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete column?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes “{deleteColumn}” from every row in this table.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleDeleteColumn()}
                  data-testid="data-delete-column-confirm"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </>
  );
}
