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
import type { DataField, DataRow } from './dataTypes';

function fieldsToDataFields(
  fields: Record<
    string,
    {
      dataType?: string;
      fieldType?: string;
      mutable?: string | boolean;
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
        mutable:
          typeof value.mutable === 'boolean'
            ? value.mutable
            : value.mutable === 'true'
              ? true
              : value.mutable === 'false'
                ? false
                : undefined,
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
  selectedRowId: string | null;
  onRowSelect: (row: DataRow | null) => void;
  onMetaChange?: (meta: {
    count: number;
    loaded: number;
    columns: number;
    fields: Record<string, DataField>;
  }) => void;
  refreshToken?: number;
  onRowsChange?: (rows: DataRow[]) => void;
}

/**
 * Data-tab leaf host: session view-state + infinite log query + shared LogGrid
 * with cell-selection viewing panel (Interfaces view-tile style).
 */
export function DataLeafTable({
  context,
  selectedRowId: _selectedRowId,
  onRowSelect,
  onMetaChange,
  refreshToken = 0,
  onRowsChange,
}: DataLeafTableProps) {
  const queryClient = useQueryClient();
  const [view, setView, replaceView] = useLogViewState(context);
  const [selectedCells, setSelectedCells] = React.useState<string[]>([]);
  const [browseRows, setBrowseRows] = React.useState<LogGridRow[]>([]);
  const [viewPanelOpen, setViewPanelOpen] = React.useState(false);

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
    setSelectedCells([]);
    setBrowseRows([]);
    setViewPanelOpen(false);
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
      loaded: Math.max(rows.length, browseRows.length),
      columns: columns.length,
      fields: fieldsToDataFields(fields),
    });
  }, [count, rows.length, browseRows.length, columns.length, fields, onMetaChange]);

  React.useEffect(() => {
    onRowsChange?.(rows.map(toDataRow));
  }, [rows, onRowsChange]);

  React.useEffect(() => {
    if (refreshToken > 0) refetch();
  }, [refreshToken, refetch]);

  const refreshAll = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['logFields', 'Assistants', context] });
    await queryClient.refetchQueries({ queryKey: ['logFields', 'Assistants', context] });
    await queryClient.invalidateQueries({ queryKey: ['logInfiniteQuery', 'Assistants', context] });
    await queryClient.invalidateQueries({ queryKey: ['logMetrics'] });
    await refetch();
  }, [queryClient, context, refetch]);

  React.useEffect(() => {
    if (!columns.length) return;
    const missing = columns.filter((id) => !view.columnOrder.includes(id));
    if (missing.length === 0) return;
    setView({
      columnOrder: view.columnOrder.length ? [...view.columnOrder, ...missing] : columns,
    });
  }, [columns, view.columnOrder, setView]);

  const selection: SelectionModel = React.useMemo(
    () => ({
      mode: 'cell',
      selectedCells,
      onSelectCells: setSelectedCells,
    }),
    [selectedCells]
  );

  const panelRows = React.useMemo(
    () => (browseRows.length ? browseRows : rows),
    [browseRows, rows]
  );

  const cellSelections = React.useMemo(
    () => cellsFromSelection(selectedCells, panelRows, view.offset),
    [selectedCells, panelRows, view.offset]
  );

  const showPanel = viewPanelOpen && selectedCells.length > 0;
  const clearSelection = React.useCallback(() => {
    setSelectedCells([]);
    setViewPanelOpen(false);
  }, []);

  React.useEffect(() => {
    if (selectedCells.length === 0) setViewPanelOpen(false);
  }, [selectedCells.length]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
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
        selection={selection}
        hasSelection={selectedCells.length > 0}
        viewPanelOpen={viewPanelOpen}
        onToggleViewPanel={() => setViewPanelOpen((open) => !open)}
        filterExpr={spec?.filterExpr}
        onDerivedCreated={() => {
          void refreshAll();
        }}
        onMutated={() => void refreshAll()}
        testId="data-leaf-table"
        className="min-h-0 min-w-0 flex-1"
      />
      {showPanel && (
        <LogCellViewPanel
          cells={cellSelections}
          onClose={() => setViewPanelOpen(false)}
          onClear={clearSelection}
          onEditRow={(logId) => {
            const match = panelRows.find((r) => r.logId === logId);
            onRowSelect(match ? toDataRow(match) : null);
          }}
        />
      )}
    </div>
  );
}
