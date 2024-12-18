import Tooltip from "@/components/Common/Misc/Tooltip";

import { columnStatistic } from "@/utils/evals/table";

import { LogItemProps, LogProps } from "@/types/evals/logs";

import { Cell, Row } from "@tanstack/react-table";

import { extractParamsValues } from "@/utils/evals/table";

import { Badge } from "@/components/UI/badge";

const AggregatedCell = ({cell, row, params, metric}: {
  cell: Cell<LogProps, unknown>, 
  row: Row<LogProps>,
  params: LogItemProps,
  metric: string,
}) => {
    const columnID = cell.column.columnDef.id!;
    const metricTooltip = `${metric} ${cell.column.columnDef.meta?.dataType() === "number" ? "value" : "length"}`;
    const data = row.subRows.map((subRow) => {
      const parent = cell.column.columnDef.meta?.columnType
      const original = subRow.original;
      return parent === "params" ? extractParamsValues(original.params, params) : original.entries
    }) ?? [];
    const statistic = columnStatistic(columnID, metric, data);
    return (
      <div className="h-[25px] overflow-hidden text-center truncate ...">
        {!cell.getIsPlaceholder() && cell.column.columnDef.meta?.columnType != "util" && 
          <Tooltip content={metricTooltip}>
            <Badge variant="primary">{`${metric[0].toUpperCase() + metric.slice(1)}:  ${statistic}`}</Badge>
          </Tooltip>
        }
      </div>
    );
  };

export default AggregatedCell;
