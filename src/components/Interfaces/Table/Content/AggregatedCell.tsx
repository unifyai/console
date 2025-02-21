"use client";

import { useEffect, useState } from "react";

import Tooltip from "@/components/Common/Misc/Tooltip";

import { LogProps, GroupedLogProps } from "@/types/evals/logs";

import { Cell } from "@tanstack/react-table";

import { Badge } from "@/components/UI/badge";

const AggregatedCell = ({cell, metric, getMetric}: {
  cell: Cell<LogProps | GroupedLogProps, unknown>, 
  metric: string,
  getMetric: (key: string, metric: string) => Promise<number | string>
}) => {
    const [statistic, setStatistic] = useState<number | string>("");
    const columnID = cell.column.columnDef.id!;
    const metricTooltip = `${metric} ${["dict", "list", "tuple", "str"].includes(cell.column.columnDef.meta?.dataType!) ? "length" : "value"}`;
    const isNotUtilColumn = cell.column.columnDef.meta?.columnType !== "util";

    // Handle multi-level grouping
    useEffect(() => {
      getMetric(columnID, metric).then((value) => {
        setStatistic(typeof value === "number" ? value.toFixed(2) : value.toString());
      });
    }, [metric]);

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
