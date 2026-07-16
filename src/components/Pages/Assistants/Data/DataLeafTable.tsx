'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogGrid } from '@/components/Common/LogGrid';
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
  fields: Record<string, { dataType?: string; fieldType?: string; mutable?: string | boolean }>
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
  /** Bump to force a refetch (e.g. after derived column create / row mutate). */
  refreshToken?: number;
  onRowsChange?: (rows: DataRow[]) => void;
}

/**
 * Data-tab leaf host: session view-state + server log query + shared LogGrid.
 */
export function DataLeafTable({
  context,
  selectedRowId,
  onRowSelect,
  onMetaChange,
  refreshToken = 0,
  onRowsChange,
}: DataLeafTableProps) {
  const queryClient = useQueryClient();
  const [view, setView, replaceView] = useLogViewState(context);

  const initializedRef = React.useRef<string | null>(null);

  const { rows, count, fields, isLoading, isFetching, refetch } = useLogQuery({
    projectName: 'Assistants',
    context,
    view,
    enabled: !!context,
  });

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
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [fields, rows]);

  React.useEffect(() => {
    onMetaChange?.({
      count,
      loaded: rows.length,
      columns: columns.length,
      fields: fieldsToDataFields(fields),
    });
  }, [count, rows.length, columns.length, fields, onMetaChange]);

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
    await refetch();
  }, [queryClient, context, refetch]);

  const selection: SelectionModel = React.useMemo(
    () => ({
      mode: 'row',
      selectedRowId,
      onSelectRow: (id) => {
        if (!id) {
          onRowSelect(null);
          return;
        }
        const match = rows.find((r) => String(r.logId) === id);
        onRowSelect(match ? toDataRow(match) : null);
      },
    }),
    [selectedRowId, rows, onRowSelect]
  );

  // When new fields appear (e.g. derived columns), append them to columnOrder.
  React.useEffect(() => {
    if (!columns.length) return;
    const missing = columns.filter((id) => !view.columnOrder.includes(id));
    if (missing.length === 0) return;
    setView({
      columnOrder: view.columnOrder.length ? [...view.columnOrder, ...missing] : columns,
    });
  }, [columns, view.columnOrder, setView]);

  return (
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
      selection={selection}
      onRowActivate={(row) => onRowSelect(toDataRow(row))}
      onDerivedCreated={refreshAll}
      testId="data-leaf-table"
      className="min-h-0 flex-1"
    />
  );
}
