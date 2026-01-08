'use client';

import { CSSProperties } from 'react';
import { Badge } from '@/components/UI/badge';
import { TableCell } from '@/components/UI/table';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { useSortable } from '@dnd-kit/sortable';
import { CSS, Transform } from '@dnd-kit/utilities';
import { Column } from '@tanstack/react-table';
import { StateProps } from '@/types/dataTable';
import { formatNumber } from '@/utils/interfaces/formatNumber';
import { sanitizeId } from '@/utils/interfaces/table/columnOperations';
import { DraggingColumnsState } from '@/types/interfaces/columns';
import { durationToTimeDelta, timeDeltaValueToDuration } from '@/utils/interfaces/format';
import { useTableMetricsQuery } from '@/hooks/Interfaces/Query/useTableDataQuery';
import { useState, useEffect, useRef } from 'react';
import { LogsActions } from '@/types/interfaces/grid';
import { useTileData } from '@/contexts/hooks';

const SummaryCell = ({
  tileId,
  tabId,
  projectId,
  column,
  metric,
  pending,
  draggingColumns,
  entriesProperties,
  paramsProperties,
  filterExpression,
  logsLength,
  logsActions,
  enabled = false,
}: {
  tileId?: string;
  tabId?: string;
  projectId: string | undefined;
  metric: string;
  column: Column<any | unknown>;
  pending: boolean;
  draggingColumns: DraggingColumnsState;
  entriesProperties: string[];
  paramsProperties: string[];
  filterExpression: string | null;
  logsLength: number;
  logsActions: LogsActions;
  enabled?: boolean;
}) => {
  const { isDragging, setNodeRef, transform } = useSortable({ id: column.id });

  const { data: tileDataState } = useTileData(tileId || null, tabId || null);

  // Local loading state to handle metric changes
  const [isMetricChanging, setIsMetricChanging] = useState(false);
  const currentMetricRef = useRef(tileDataState?.metric);

  // Use the metrics query - this will actively fetch metrics
  const columns = logsLength > 0 ? [...entriesProperties, ...paramsProperties] : [];
  const {
    data: queryMetrics,
    isLoading: isMetricsLoading,
    isFetching,
  } = useTableMetricsQuery(
    tileId || null,
    tabId || null,
    !!enabled, // only fetch when metrics row is shown
    logsActions,
    projectId,
    tileDataState?.context,
    tileDataState?.columnContext,
    columns,
    filterExpression,
    tileDataState?.metric || 'mean',
    'SummaryCell' // caller identifier
  );

  // Detect metric changes to show loading state
  useEffect(() => {
    if (currentMetricRef.current !== tileDataState?.metric) {
      setIsMetricChanging(true);
      currentMetricRef.current = tileDataState?.metric;
    }
  }, [tileDataState?.metric]);

  // Reset loading state when new metrics are available
  useEffect(() => {
    if (!isMetricsLoading && !isFetching && queryMetrics) {
      setIsMetricChanging(false);
    }
  }, [isMetricsLoading, isFetching, queryMetrics]);

  const metricTooltip = `${tileDataState?.metric || metric} ${['dict', 'list', 'tuple', 'str'].includes(column.columnDef.meta?.dataType!) ? 'length' : 'value'}`;

  // Show loading if:
  // 1. We're in the process of changing metrics (local state)
  // 2. React Query is loading or fetching
  // 3. We don't have metrics data yet
  const shouldShowLoading = isMetricChanging || isMetricsLoading || isFetching || !queryMetrics;

  let logEntryMetric = queryMetrics?.[sanitizeId(column.id)] ?? (0 as any);
  logEntryMetric = parseFloat(logEntryMetric)
    ? formatNumber(parseFloat(logEntryMetric))
    : logEntryMetric;
  logEntryMetric = logEntryMetric?.toString() ?? '';
  if (
    logEntryMetric &&
    column.columnDef.meta?.dataType === 'timedelta' &&
    tileDataState?.metric != 'count'
  ) {
    try {
      logEntryMetric = durationToTimeDelta(timeDeltaValueToDuration(logEntryMetric));
    } catch (error) {
      console.error('Error formatting timedelta:', error);
    }
  }

  return (
    <Tooltip content={metricTooltip}>
      <div className="text-body-sm w-full overflow-hidden text-ellipsis whitespace-nowrap">
        {shouldShowLoading ? (
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        ) : (
          logEntryMetric
        )}
      </div>
    </Tooltip>
  );
};

export default SummaryCell;
