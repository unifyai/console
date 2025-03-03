"use client";

import { CSSProperties } from "react";
import { Badge } from "@/components/UI/badge";
import { TableCell } from "@/components/UI/table";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";
import { Column } from "@tanstack/react-table";
import { StateProps } from "@/types/dataTable";
import { formatNumber } from "@/utils/formatNumber";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { DraggingColumnsState } from "@/types/evals/columns";

const SummaryCell = ({ column, state, metrics, pending, draggingColumns }: {
	column: Column<any | unknown>,
	state: StateProps,
	metrics: { [key: string]: any },
	pending: boolean,
	draggingColumns: DraggingColumnsState;
}) => {
	const { isDragging, setNodeRef, transform } = useSortable({ id: column.id });

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
		width: `calc(var(--header-${column.id}-size) * 1px)`,
		zIndex: isColumnDragging || isPinned ? 1 : 0,
	};
    const metricTooltip = `${state.metric} ${["dict", "list", "tuple", "str"].includes(column.columnDef.meta?.dataType!) ? "length" : "value"}`;

	let logEntryMetric = sanitizeId(column.id) in metrics ? metrics[sanitizeId(column.id)] : 0;
	logEntryMetric = parseFloat(logEntryMetric) ? formatNumber(parseFloat(logEntryMetric)) : logEntryMetric
	logEntryMetric = logEntryMetric?.toString() ?? ""

	return (
		<>
			{<TableCell style={style} ref={setNodeRef}>
				<Tooltip content={metricTooltip}>
					{logEntryMetric}
				</Tooltip>
			</TableCell>}
		</>
	);
};

export default SummaryCell;
