'use client';

import Tooltip from '@/components/Common/Misc/Tooltip';
import { LogFieldsResponseProps } from '@/types/interfaces/logs';
import { Cell, Row } from '@tanstack/react-table';
import { Badge } from '@/components/UI/badge';
import { LogsActions } from '@/types/interfaces/grid';
import { useTableGroupedMetricsQuery } from '@/hooks/Interfaces/Query/useTableDataQuery';
import { formatCellValue } from '@/utils/interfaces/table/table';
import { sanitizeId } from '@/utils/interfaces/table/columnOperations';

interface AggregatedCellProps {
  tileId: string | null;
  tabId: string | null;
  projectId: string | null;
  context: string | null;
  columnContext: string | null;
  columns: string[];
  filteression: string | null;
  groupingExpression: string | null;
  fields: LogFieldsResponseProps;
  logsActions: LogsActions;
  cell: Cell<any, unknown>;
  row: Row<any>;
  metric: string;
  isGroupLoading: boolean;
}

const AggregatedCell = ({
  tileId,
  tabId,
  projectId,
  context,
  columnContext,
  columns,
  filteression,
  groupingExpression,
  fields,
  logsActions,
  cell,
  row,
  metric,
  isGroupLoading,
}: AggregatedCellProps) => {
  const columnID = cell.column.columnDef.id!;
  const metricTooltip = `${metric} ${['dict', 'list', 'tuple', 'str'].includes(cell.column.columnDef.meta?.dataType!) ? 'length' : 'value'}`;
  const isNotUtilColumn = cell.column.columnDef.meta?.columnType !== 'util';

  // Use only the top-level grouped metrics query
  const { data: groupedMetrics, isLoading: isQueryLoading } = useTableGroupedMetricsQuery(
    tileId,
    tabId,
    !!groupingExpression, // Only enabled when there's grouping
    logsActions,
    projectId,
    context,
    columnContext,
    columns,
    filteression,
    groupingExpression,
    metric,
    fields,
    'AggregatedCell'
  );

  // Helper function to get metric value for this cell
  const getMetricValue = (key: string): React.ReactNode => {
    if (!groupedMetrics || !groupingExpression) return undefined;

    const groupingColumnId = row.groupingColumnId;
    const rowId = row.id;
    const slicedRowId = rowId.split('>').slice(0, -1).join('>');

    // Try different keys to find the metrics: groupingColumnId first, then rowId, then slicedRowId
    const relevantMetrics =
      (groupedMetrics && groupingColumnId in groupedMetrics
        ? groupedMetrics[groupingColumnId]
        : groupedMetrics && slicedRowId in groupedMetrics
          ? groupedMetrics[slicedRowId]
          : { [metric]: {} })[metric] || {};

    const newKey = sanitizeId(key);
    const groupingValue = row.getValue(key) as string;
    const value = relevantMetrics[newKey] ? relevantMetrics[newKey][groupingValue] : undefined;

    const excludeNulls = true;
    const excludeUndefined = true;
    const formattedValue = formatCellValue(
      value,
      cell.column.columnDef.meta?.dataType ?? '',
      cell.column.getSize(),
      excludeNulls,
      excludeUndefined
    );
    return formattedValue;
  };

  // Helper function to get shared value for this cell
  const getSharedValueForCell = (key: string): React.ReactNode => {
    if (!groupedMetrics || !groupingExpression) return undefined;

    const groupingColumnId = row.groupingColumnId;
    const rowId = row.id;
    const slicedRowId = rowId.split('>').slice(0, -1).join('>');

    // Try different keys to find the shared values: groupingColumnId first, then rowId, then slicedRowId
    const relevantSharedValues =
      (groupedMetrics && groupingColumnId in groupedMetrics
        ? groupedMetrics[groupingColumnId]
        : groupedMetrics && slicedRowId in groupedMetrics
          ? groupedMetrics[slicedRowId]
          : { sharedValue: {} })['sharedValue'] || {};

    const newKey = sanitizeId(key);
    const groupingValue = row.getValue(key) as string;
    const value = relevantSharedValues[newKey]
      ? relevantSharedValues[newKey][groupingValue]
      : undefined;

    const excludeNulls = true;
    const excludeUndefined = true;
    const formattedValue = formatCellValue(
      value,
      cell.column.columnDef.meta?.dataType ?? '',
      cell.column.getSize(),
      excludeNulls,
      excludeUndefined
    );
    return formattedValue;
  };

  // Calculate the statistic and shared value
  const statistic = getMetricValue(columnID);
  const sharedValue = getSharedValueForCell(columnID);

  // Show loading state if either the parent is loading or the query is loading
  const shouldShowLoading = isGroupLoading || isQueryLoading;

  return (
    <div className="text-body-sm h-[25px] overflow-hidden truncate text-center ...">
      {!cell.getIsPlaceholder() && isNotUtilColumn ? (
        shouldShowLoading ? (
          <div className="mt-1 h-4 animate-pulse rounded bg-muted" />
        ) : statistic ? (
          <Tooltip content={metricTooltip}>
            <Badge variant="primary">{statistic}</Badge>
          </Tooltip>
        ) : sharedValue ? (
          <Tooltip content={'Shared Value'}>
            <Badge variant="secondary">{sharedValue}</Badge>
          </Tooltip>
        ) : null
      ) : null}
    </div>
  );
};

export default AggregatedCell;
