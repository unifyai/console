"use client";

import Tooltip from "@/components/Common/Misc/Tooltip";

import { LogProps, GroupedLogProps } from "@/types/evals/logs";

import { Cell } from "@tanstack/react-table";

import { Badge } from "@/components/UI/badge";
import { useEffect, useState } from "react";

const AggregatedCell = ({cell, metric, getMetric}: {
  cell: Cell<LogProps | GroupedLogProps, unknown>, 
  metric: string,
  getMetric: (key: string) => number | string | undefined
}) => {
    const columnID = cell.column.columnDef.id!;
    const metricTooltip = `${metric} ${["dict", "list", "tuple", "str"].includes(cell.column.columnDef.meta?.dataType!) ? "length" : "value"}`;
    const isNotUtilColumn = cell.column.columnDef.meta?.columnType !== "util";

    // Handle multi-level grouping
    const statistic = getMetric(columnID);

    return (
      <div className="h-[25px] overflow-hidden text-center truncate ...">
        {!cell.getIsPlaceholder() && isNotUtilColumn && statistic &&
          <Tooltip content={metricTooltip}>
            <Badge variant="primary">{`${metric[0].toUpperCase() + metric.slice(1)}:  ${statistic}`}</Badge>
          </Tooltip>
        }
      </div>
    );
  };

export default AggregatedCell;
