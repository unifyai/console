
"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/UI/dialog";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  LabelList,
  Tooltip
} from "recharts";
import { GanttChart } from "lucide-react";
import { unifyTracesForChart, colorPalette } from "./unify";
import { Span } from "@/types/evals/traces";

/**
 * TimelineViewButton renders a button that opens a timeline view (BarChart)
 * for the base trace.
 *
 * The timeline view is built using our helper from the "unify" module
 * and styled to match the original version.
 */
export default function TimelineViewButton({
  baseTrace
}: {
  baseTrace: Span[];
}) {
  const [open, setOpen] = useState(false);

  // Prepare chart data for the base trace.
  const chartData = useMemo(() => {
    const data = unifyTracesForChart([baseTrace]);
    return data;
  }, [baseTrace]);

  // Custom tooltip for the chart.
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border p-2 rounded-md shadow-md">
          <p className="font-medium">{label}</p>
          <p className="text-sm">
            Start: {data["start-0"].toFixed(3)}s
          </p>
          <p className="text-sm">
            Duration: {data["length-0"].toFixed(3)}s
          </p>
          <p className="text-sm">
            End: {(data["start-0"] + data["length-0"]).toFixed(3)}s
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Show Timeline View"
        className="p-1 hover:bg-muted rounded"
      >
        <GanttChart className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-fit h-fit max-w-none max-h-none p-4">
          <DialogHeader>
            <DialogTitle>Timeline View</DialogTitle>
            <DialogDescription>
              Timeline showing execution duration of each span in the trace.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 h-full">
            {chartData.length > 0 ? (
              <BarChart
                width={1200}
                height={Math.max(400, chartData.length * 40)}
                data={chartData}
                layout="vertical"
                barSize={24}
                margin={{ left: 140, right: 60, top: 20, bottom: 20 }}
              >
                <CartesianGrid
                  stroke="#E5E7EB"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={130}
                  tickLine={false}
                  axisLine={false}
                  stroke="#4B5563"
                  fontSize={12}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  stroke="#4B5563"
                  tickFormatter={(val) => `${val.toFixed(2)}s`}
                  domain={[0, "dataMax+0.2"]}
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* For a single (base) trace, we render the hidden offset bar and the duration bar */}
                <>
                  <Bar
                    dataKey="start-0"
                    stackId="range-0"
                    fill="transparent"
                  />
                  <Bar
                    dataKey="length-0"
                    stackId="range-0"
                    fill={colorPalette[0]}
                    radius={[4, 4, 4, 4]}
                  >
                    <LabelList
                      dataKey="length-0"
                      position="right"
                      formatter={(value: number) => `${value.toFixed(3)}s`}
                      fill="#4B5563"
                      style={{ fontSize: "0.75rem" }}
                    />
                  </Bar>
                </>
              </BarChart>
            ) : (
              <div className="text-center text-muted-foreground">
                No timeline data available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}