import Tooltip from "@/components/Common/Misc/Tooltip";

import { columnStatistic } from "@/utils/projects/table";

import { LogProps } from "@/types/projects/logs";

import { Cell, Row } from "@tanstack/react-table";

const AggregatedCell = ({cell, row, metric}: {
  cell: Cell<LogProps, unknown>, 
  row: Row<LogProps>
  metric: string,
}) => {
    const columnID = cell.column.columnDef.id!;
    const metricTooltip = `${metric} ${cell.column.columnDef.meta?.dataType() === "string" ? "length" : "value"}`;
    const data = row.subRows.map((subRow) => subRow.original.entries) ?? [];
    const statistic = columnStatistic(columnID, metric, data);
    return (
      <div className="h-[21px] overflow-hidden truncate ...">
        {!cell.getIsPlaceholder() && cell.column.columnDef.meta?.columnType != "util" && <Tooltip content={metricTooltip}>{statistic}</Tooltip>}
      </div>
    );
  };

export default AggregatedCell;
