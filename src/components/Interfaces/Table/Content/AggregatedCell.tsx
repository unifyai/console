import Tooltip from "@/components/Common/Misc/Tooltip";

import { columnStatistic } from "@/utils/evals/table";

import { LogItemProps, LogProps, GroupedLogProps } from "@/types/evals/logs";

import { Cell, Row } from "@tanstack/react-table";

import { extractParamsValues } from "@/utils/evals/table";

import { Badge } from "@/components/UI/badge";

import { getLeafRows } from "@/utils/evals/common";

const AggregatedCell = ({cell, row, params, metric}: {
  cell: Cell<LogProps | GroupedLogProps, unknown>, 
  row: Row<LogProps | GroupedLogProps>,
  params: LogItemProps,
  metric: string,
}) => {
    const columnID = cell.column.columnDef.id!;
    const metricTooltip = `${metric} ${["dict", "list", "tuple", "str"].includes(cell.column.columnDef.meta?.dataType!) ? "length" : "value"}`;
    const isNotUtilColumn = cell.column.columnDef.meta?.columnType !== "util";

    // Handle multi-level grouping
    const leafRows = getLeafRows(row);
    if (leafRows.length === 0) {
      return null;
    }

    const data = leafRows.map((leafRow) => {
      const parent = cell.column.columnDef.meta?.columnType
      const original = leafRow.original as LogProps;
      return parent === "params" ? extractParamsValues(original.params, params) : original.entries
    }) as LogItemProps[];
    const statistic = columnStatistic(columnID, metric, data);
    return (
      <div className="h-[25px] overflow-hidden text-center truncate ...">
        {!cell.getIsPlaceholder() && isNotUtilColumn && 
          <Tooltip content={metricTooltip}>
            <Badge variant="primary">{`${metric[0].toUpperCase() + metric.slice(1)}:  ${statistic}`}</Badge>
          </Tooltip>
        }
      </div>
    );
  };

export default AggregatedCell;
