import Tooltip from "@/components/Common/Misc/Tooltip";

import { columnStatistic } from "@/utils/evals/table";

import { LogItemProps, LogProps, GroupedLogProps } from "@/types/evals/logs";

import { Cell, Row } from "@tanstack/react-table";

import { extractParamsValues } from "@/utils/evals/table";

import { Badge } from "@/components/UI/badge";

const AggregatedCell = ({cell, row, params, metric}: {
  cell: Cell<LogProps | GroupedLogProps, unknown>, 
  row: Row<LogProps | GroupedLogProps>,
  params: LogItemProps,
  metric: string,
}) => {
    const columnID = cell.column.columnDef.id!;
    const metricTooltip = `${metric} ${["dict", "list", "tuple", "str"].includes(cell.column.columnDef.meta?.dataType!) ? "length" : "value"}`;

    // Handle multi-level grouping
    let leafRows;
    if (row.subRows.some(subRow => subRow.getLeafRows().length > 0))
      leafRows = row.subRows.map(subRow => subRow.getLeafRows()).flat()
    else
      leafRows = row.subRows

    const data = leafRows.map((leafRow) => {
      const parent = cell.column.columnDef.meta?.columnType;
      const original = leafRow.original as LogProps; // We know leaf rows are always LogProps
      return parent === "params" 
        ? extractParamsValues(original.params, params) 
        : original.entries;
    }) as LogItemProps[];

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
