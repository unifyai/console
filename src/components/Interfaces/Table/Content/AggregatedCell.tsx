"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";

import { LogProps, GroupedLogProps } from "@/types/evals/logs";

import { Cell } from "@tanstack/react-table";

import { Badge } from "@/components/UI/badge";

const AggregatedCell = ({isGroupLoading, cell, metric, getMetric, getSharedValue}: {
  isGroupLoading: boolean,
  cell: Cell<LogProps | GroupedLogProps, unknown>, 
  metric: string,
  getMetric: (key: string) => React.ReactNode,
  getSharedValue: (key: string) => React.ReactNode
}) => {
    const columnID = cell.column.columnDef.id!;
    const metricTooltip = `${metric} ${["dict", "list", "tuple", "str"].includes(cell.column.columnDef.meta?.dataType!) ? "length" : "value"}`;
    const isNotUtilColumn = cell.column.columnDef.meta?.columnType !== "util";

    // Handle multi-level grouping
    const statistic = getMetric(columnID);
    const sharedValue = getSharedValue(columnID);

    return (
      <div className="h-[25px] overflow-hidden text-center truncate ...">
        {!cell.getIsPlaceholder() && isNotUtilColumn ?
          isGroupLoading 
          ? <div className="h-4 bg-muted rounded animate-pulse mt-1"/>
          : statistic ?
            <Tooltip content={metricTooltip}>
              <Badge variant="primary">{statistic}</Badge>
            </Tooltip>
          : sharedValue ?
            <Tooltip content={"Shared Value"}>
              <Badge variant="secondary">{sharedValue}</Badge>
            </Tooltip>
          : null
        : null}
      </div>
    );
  };

export default AggregatedCell;
