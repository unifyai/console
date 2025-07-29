"use client";

import { CSSProperties } from "react";
import { Badge } from "@/components/UI/badge";
import { TableCell } from "@/components/UI/table";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";
import { Column } from "@tanstack/react-table";
import { StateProps } from "@/types/dataTable";
import { formatNumber } from "@/utils/interfaces/formatNumber";
import { sanitizeId } from "@/utils/interfaces/table/columnOperations";
import { DraggingColumnsState } from "@/types/interfaces/columns";
import { durationToTimeDelta, timeDeltaValueToDuration } from "@/utils/interfaces/format";
import { useTableMetricsQuery } from "@/hooks/Interfaces/Query/useTableDataQuery";
import { useState, useEffect, useRef } from "react";
import { LogsActions } from "@/types/interfaces/grid";
import { useTileData } from "@/contexts/hooks";

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
	logsActions
}: {
	tileId?: string;
	tabId?: string;
	projectId: string | undefined;
    metric: string, 
	column: Column<any | unknown>,
	pending: boolean,
	draggingColumns: DraggingColumnsState;
	entriesProperties: string[];
	paramsProperties: string[];
	filterExpression: string | null;
	logsLength: number;
	logsActions: LogsActions;
}) => {
	const { isDragging, setNodeRef, transform } = useSortable({ id: column.id });

	const { data: tileDataState } = useTileData(tileId || null, tabId || null);

	// Local loading state to handle metric changes
	const [isMetricChanging, setIsMetricChanging] = useState(false);
	const currentMetricRef = useRef(tileDataState?.metric);

	// Use the metrics query - this will actively fetch metrics
	const columns = logsLength > 0 ? [...entriesProperties, ...paramsProperties] : [];
	const { data: queryMetrics, isLoading: isMetricsLoading, isFetching } = useTableMetricsQuery(
		tileId || null,
		tabId || null,
		true, // enabled - this will trigger the query
		logsActions,
		projectId,
		tileDataState?.context,
		tileDataState?.column_context,
		columns,
		filterExpression,
		tileDataState?.metric || "mean",
		"SummaryCell" // caller identifier
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

	// Pre-calculate checks for active and over states
	const isInActiveGroup = draggingColumns.active.ids?.includes(column.id);
	const isInOverGroup = draggingColumns.over.ids?.includes(column.id);
  
	// Consolidate into a single flag for overall dragging state
	const isPartOfDraggingState = isInActiveGroup || isInOverGroup;
  
	// For dragging columns that are parents, use the transform/transition from the parent dragging state
	const isColumnDragging = isDragging || isPartOfDraggingState;
	const isParentColumn = column.columnDef.meta?.isParent;

	// Determine the applied transform
	const appliedTransform: Transform | null = isDragging
		? transform : isInActiveGroup ? draggingColumns.active.transform ?? null : isInOverGroup
		? draggingColumns.over.transform ?? null : isParentColumn ? null : transform;

	const appliedTransition = "width transform 0.2s ease-in-out";

	const isPinned = column.getIsPinned();
	const style: CSSProperties = {
		cursor: "default",
		opacity: isColumnDragging ? 0.8 : 1,
		position: isPinned ? "sticky" : "relative",
		left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
		right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
		transform: CSS.Translate.toString(appliedTransform), // translate instead of transform to avoid squishing
		transition: appliedTransition,
		width: `${Math.round(column.getSize())}px`,
		zIndex: isColumnDragging || isPinned ? 1 : 0,
	};
    const metricTooltip = `${tileDataState?.metric || metric} ${["dict", "list", "tuple", "str"].includes(column.columnDef.meta?.dataType!) ? "length" : "value"}`;

	// Show loading if:
	// 1. We're in the process of changing metrics (local state)
	// 2. React Query is loading or fetching
	// 3. We don't have metrics data yet
	const shouldShowLoading = isMetricChanging || isMetricsLoading || isFetching || !queryMetrics;

	let logEntryMetric = queryMetrics?.[sanitizeId(column.id)] ?? 0 as any;
	logEntryMetric = parseFloat(logEntryMetric) ? formatNumber(parseFloat(logEntryMetric)) : logEntryMetric
	logEntryMetric = logEntryMetric?.toString() ?? ""
    if (logEntryMetric && column.columnDef.meta?.dataType === "timedelta" && tileDataState?.metric != "count"){
		try {
			logEntryMetric = durationToTimeDelta(timeDeltaValueToDuration(logEntryMetric));
		} 
		catch (error) {
			console.error("Error formatting timedelta:", error);
		}
	}

	return (
		<>
			<TableCell style={style} ref={setNodeRef}>
				<Tooltip content={metricTooltip}>
					{shouldShowLoading ? (
						<div className="h-4 w-16 bg-muted rounded animate-pulse" />
					) : (
						logEntryMetric
					)}
				</Tooltip>
			</TableCell>
		</>
	);
};

export default SummaryCell;
