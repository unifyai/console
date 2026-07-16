'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogGrid } from '@/components/Common/LogGrid';
import { LogCellViewPanel, cellsFromSelection } from '@/components/Common/LogGrid/LogCellViewPanel';
import { useLogQuery } from '@/hooks/logs/useLogQuery';
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
 * Data-tab leaf host: session view-state + server log query + shared LogGrid
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
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [browseRows, setBrowseRows] = React.useState<LogGridRow[]>([]);

  const initializedRef = React.useRef<string | null>(null);

  const { rows, groups, count, fields, isLoading, isFetching, error, refetch, spec } = useLogQuery({
    projectName: 'Assistants',
    context,
    view,
    enabled: !!context,
  });

  React.useEffect(() => {
    setSelectedCells([]);
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
          limit: existing.limit || DEFAULT_LOG_PAGE_SIZE,
        })
      );
    }
  }, [context, fields, view, replaceView]);

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
    await queryClient.invalidateQueries({ queryKey: ['logQuery', 'Assistants', context] });
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
      onSelectCells: (ids) => {
        setSelectedCells(ids);
        setPanelOpen(true);
      },
    }),
    [selectedCells]
  );

  const panelRows = React.useMemo(
    () => (browseRows.length ? browseRows : rows),
    [browseRows, rows]
  );

  const cellSelections = React.useMemo(
    () => cellsFromSelection(selectedCells, panelRows),
    [selectedCells, panelRows]
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <LogGrid
        projectName="Assistants"
        context={context}
        rows={rows}
        groups={groups}
        fields={fields}
        columns={columns}
        totalCount={count}
        view={view}
        onViewChange={setView}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        onBrowseRowsChange={setBrowseRows}
        selection={selection}
        filterExpr={spec?.filterExpr}
        onDerivedCreated={() => void refreshAll()}
        onMutated={() => void refreshAll()}
        testId="data-leaf-table"
        className="min-h-0 min-w-0 flex-1"
      />
      {panelOpen && (
        <LogCellViewPanel
          cells={cellSelections}
          onClose={() => setPanelOpen(false)}
          onClear={() => setSelectedCells([])}
          onEditRow={(logId) => {
            const match = panelRows.find((r) => r.logId === logId);
            onRowSelect(match ? toDataRow(match) : null);
          }}
        />
      )}
    </div>
  );
}
