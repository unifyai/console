"use client";

import React, { useState, useMemo, useEffect } from "react";
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
 * TimelineViewButton now supports up to two subtree traces.
 * 
 * - If both baseTrace and targetTrace are provided, it displays them together.
 * - If only one is provided, it displays the single timeline.
 */
export default function TimelineViewButton({
  baseTrace,
  targetTrace
}: {
  baseTrace?: Span[];
  targetTrace?: Span[];
}) {
  const [open, setOpen] = useState(false);
  const [chartWidth, setChartWidth] = useState(1000);
  const [chartHeight, setChartHeight] = useState(600);

  // Update chart dimensions when dialog opens
  useEffect(() => {
    if (open) {
      const updateDimensions = () => {
        setChartWidth(Math.min(1200, window.innerWidth * 0.85));
        setChartHeight(Math.min(800, window.innerHeight * 0.7));
      };
      
      updateDimensions();
      
      // Add resize listener in case user resizes window with dialog open
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [open]);

  // Prepare chart data. We unify either 1 or 2 arrays of spans.
  // If there's no targetTrace, then we unify just `[baseTrace]`.
  // If both exist, we unify [baseTrace, targetTrace].
  const chartData = useMemo(() => {
    if (!baseTrace && !targetTrace) {
      return [];
    }
    const tracesToUnify = [];
    if (baseTrace) tracesToUnify.push(baseTrace);
    if (targetTrace) tracesToUnify.push(targetTrace);
    const data = unifyTracesForChart(tracesToUnify);
    return data;
  }, [baseTrace, targetTrace]);

  // Calculate ideal height based on number of rows
  const idealHeight = useMemo(() => {
    const rowHeight = 40; // Height per row in pixels
    const minHeight = 400; // Minimum height
    const calculatedHeight = Math.max(minHeight, chartData.length * rowHeight);
    return Math.min(calculatedHeight, chartHeight);
  }, [chartData, chartHeight]);

  // Custom tooltip for the chart.
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      // Check for multiple traces. payload can contain bars for
      // e.g. start-0, length-0, start-1, length-1, etc.
      return (
        <div className="bg-background border border-border p-2 rounded-md shadow-md">
          <p className="font-medium">{label}</p>
          {Object.keys(data)
            .filter((key) => key.startsWith("start-"))
            .map((startKey) => {
              const idx = startKey.replace("start-", "");
              const lengthKey = `length-${idx}`;
              const st = data[startKey] ?? 0;
              const ln = data[lengthKey] ?? 0;
              const end = st + ln;
              return (
                <div key={startKey} className="mb-2 border-b border-muted pb-1">
                  <p className="text-sm font-semibold">
                    Trace {Number(idx) + 1}
                  </p>
                  <p className="text-xs">
                    Start: {st.toFixed(3)}s
                  </p>
                  <p className="text-xs">
                    Duration: {ln.toFixed(3)}s
                  </p>
                  <p className="text-xs">
                    End: {end.toFixed(3)}s
                  </p>
                </div>
              );
            })}
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
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-fit h-fit p-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Timeline View</DialogTitle>
            <DialogDescription>
              Timeline showing execution duration.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 h-full overflow-auto">
            {chartData.length > 0 ? (
              <div className="overflow-auto">
                <BarChart
                  width={chartWidth}
                  height={idealHeight}
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
                  {/*
                    If we have 2 traces, i=0 and i=1. If only 1, i=0 only.
                    We'll detect how many "columns" are in chartData by checking
                    up to length-1. In practice, we know we can have up to 2, so:
                  */}
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
                    {/* If second trace is present, add second pair of bars */}
                    <Bar
                      dataKey="start-1"
                      stackId="range-1"
                      fill="transparent"
                    />
                    <Bar
                      dataKey="length-1"
                      stackId="range-1"
                      fill={colorPalette[1]}
                      radius={[4, 4, 4, 4]}
                    >
                      <LabelList
                        dataKey="length-1"
                        position="right"
                        formatter={(value: number) => `${value.toFixed(3)}s`}
                        fill="#4B5563"
                        style={{ fontSize: "0.75rem" }}
                      />
                    </Bar>
                  </>
                </BarChart>
              </div>
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