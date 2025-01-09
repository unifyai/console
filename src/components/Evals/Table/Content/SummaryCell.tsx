"use client";

import { CSSProperties } from "react";
import { Badge } from "@/components/UI/badge";
import { TableCell } from "@/components/UI/table";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Column } from "@tanstack/react-table";
import { StateProps } from "@/types/dataTable";
import { formatNumber } from "@/utils/formatNumber";

const SummaryCell = ({ column, state, metrics, pending }: {
	column: Column<any | unknown>,
	state: StateProps,
	metrics: { [key: string]: any }
	pending: boolean
}) => {
	const { isDragging, setNodeRef, transform } = useSortable({ id: column.id });
	const isPinned = column.getIsPinned();
	const style: CSSProperties = {
		cursor: "default",
		opacity: isDragging ? 0.8 : 1,
		position: isPinned ? "sticky" : "relative",
		left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
		right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
		transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
		transition: "width transform 0.2s ease-in-out",
		width: `calc(var(--header-${column.id}-size) * 1px)`,
		zIndex: isDragging || isPinned ? 1 : 0,
	};
	const metricTooltip = `${state.metric} ${column.columnDef.meta?.dataType() === "string" ? "length" : "value"}`;
	let logEntryMetric = column.id in metrics ? metrics[column.id] : 0;
	logEntryMetric = parseFloat(logEntryMetric) ?? logEntryMetric
	return (
		<>
			{<TableCell style={style} ref={setNodeRef}>
				<Tooltip content={metricTooltip}>
					{formatNumber(logEntryMetric) ?? 0}
				</Tooltip>
			</TableCell>}
		</>
	);
};

export default SummaryCell;
