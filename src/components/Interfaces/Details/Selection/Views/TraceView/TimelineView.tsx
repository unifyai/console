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
  Tooltip,
  Cell
} from "recharts";
import { GanttChart, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [zoomFactor, setZoomFactor] = useState(1); // Default zoom factor
  const [panOffset, setPanOffset] = useState(0); // Pan offset for navigating when zoomed in
  const [domainMin, setDomainMin] = useState(0); // Minimum value of the domain
  const [domainMax, setDomainMax] = useState<number | string>("dataMax+0.2");
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Store trace names for better identification in tooltips
  const traceNames = useMemo(() => {
    const names: string[] = [];
    if (baseTrace?.length) {
      names[0] = "Base Trace";
    }
    if (targetTrace?.length) {
      names[names.length] = "Target Trace";
    }
    return names;
  }, [baseTrace, targetTrace]);

  // Update chart dimensions when dialog opens
  useEffect(() => {
    if (open) {
      const updateDimensions = () => {
        const baseWidth = Math.min(1200, window.innerWidth * 0.85);
        setChartWidth(baseWidth);
        setChartHeight(Math.min(800, window.innerHeight * 0.7));
      };
      
      updateDimensions();
      
      // Add resize listener in case user resizes window with dialog open
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [open]);

  // Calculate the effective width for the chart, accounting for margins
  const effectiveChartWidth = useMemo(() => {
    const margins = 140 + 60; // left margin (140px) + right margin (60px)
    // Return a width that ensures the chart fits in the container without horizontal scrollbar
    return chartWidth - margins - 5; // Additional 5px buffer
  }, [chartWidth]);

  // Calculate zoomed chart width
  const scaledChartWidth = useMemo(() => {
    // Account for margins to ensure we don't overflow at 100% zoom
    const margins = 140 + 60; // left margin + right margin
    if (zoomFactor === 1) {
      // At 100% zoom, make sure chart fits exactly in container
      return chartWidth - margins - 10; // Extra buffer to prevent scrollbar
    }
    // For zoomed views, scale from the adjusted base width
    return (chartWidth - margins - 10) * zoomFactor;
  }, [chartWidth, zoomFactor]);

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

  // Determine if we're showing a single trace or dual traces
  const isSingleTrace = useMemo(() => {
    return !baseTrace || !targetTrace;
  }, [baseTrace, targetTrace]);

  // Calculate the maximum value in the data to use for domain calculation
  const maxValue = useMemo(() => {
    let max = 0;
    chartData.forEach(item => {
      // Check all length and start keys
      Object.keys(item).forEach(key => {
        if ((key.startsWith('start-') || key.startsWith('length-')) && typeof item[key] === 'number') {
          if (key.startsWith('start-')) {
            const lengthKey = key.replace('start-', 'length-');
            const total = item[key] + (item[lengthKey] || 0);
            max = Math.max(max, total);
          }
        }
      });
    });
    return max || 1; // Default to 1 if no data
  }, [chartData]);

  // Update domain when zoom factor or pan offset changes
  useEffect(() => {
    // More pronounced padding to make domain changes more visible
    const basePadding = isSingleTrace ? 0.6 : 0.2;
    
    // Fixed domain regardless of zoom, as we're scaling the chart size instead
    setDomainMin(0);
    setDomainMax(maxValue + basePadding);
    
  }, [maxValue, isSingleTrace]);
  
  // Reset zoom when chart data changes or dialog reopens
  useEffect(() => {
    setZoomFactor(1);
    // Scroll container to the beginning when resetting
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  }, [chartData, open]);

  // Center the view on initial load and after zoom changes
  useEffect(() => {
    if (containerRef.current && zoomFactor > 1) {
      // Center the scrollable area when zooming in
      const scrollableWidth = containerRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      const scrollCenter = (scrollableWidth - containerWidth) / 2;
      containerRef.current.scrollLeft = scrollCenter;
    }
  }, [zoomFactor]);

  // Handle zoom in
  const handleZoomIn = () => {
    setZoomFactor(prev => {
      const newZoom = prev * 1.5; // More gradual zoom steps
      // Cap zoom to prevent over-zooming
      return Math.min(newZoom, 5);
    });
  };

  // Handle zoom out
  const handleZoomOut = () => {
    setZoomFactor(prev => {
      const newZoom = prev / 1.5; // More gradual zoom steps
      // Limit minimum zoom
      return Math.max(newZoom, 1);
    });
  };

  // Reset zoom
  const handleResetZoom = () => {
    setZoomFactor(1);
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  };

  // For single trace mode, we'll modify the data to center the bars
  const processedChartData = useMemo(() => {
    if (!isSingleTrace) return chartData;
    
    // For single trace, add a centering offset to position the bar in the middle
    return chartData.map(item => {
      const traceIndex = baseTrace ? 0 : 1;
      const startKey = `start-${traceIndex}`;
      const lengthKey = `length-${traceIndex}`;
      
      return {
        ...item,
        // If we have a valid length, center it
        [startKey]: item[lengthKey] > 0 ? 0.3 : 0 // Add a small offset to center the bar
      };
    });
  }, [chartData, isSingleTrace, baseTrace]);

  // Calculate ideal height based on number of rows
  const idealHeight = useMemo(() => {
    const rowHeight = 40; // Height per row in pixels
    // Calculate height based on number of rows without a maximum constraint
    return Math.max(400, chartData.length * rowHeight); // Minimum height of 400px
  }, [chartData]);

  // Calculate container height with padding for controls
  const containerHeight = useMemo(() => {
    // Set a maximum height for the container to enable scrolling
    const maxContainerHeight = Math.min(800, window.innerHeight * 0.7);
    // Always show scrollbar when content exceeds the container
    return maxContainerHeight;
  }, [chartHeight]);

  // Custom tooltip for the chart.
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Get valid traces (ones with actual data)
      const validTraces = Object.keys(data)
        .filter((key) => key.startsWith("length-"))
        .map((key) => {
          const idx = key.replace("length-", "");
          const traceIndex = Number(idx);
          const startKey = `start-${idx}`;
          const st = data[startKey] ?? 0;
          const ln = data[key] ?? 0;
          return { traceIndex, start: st, length: ln, end: st + ln };
        })
        .filter(t => t.length > 0);
      
      // If no valid traces, don't show tooltip
      if (validTraces.length === 0) return null;
      
      return (
        <div className="bg-background border border-border p-2 rounded-md shadow-md max-w-xs">
          {/* Operation name - from the bar label */}
          <p className="font-medium border-b border-border pb-1 mb-2">{label}</p>
          
          {/* Trace details */}
          {validTraces.map(({ traceIndex, start, length, end }) => (
            <div key={traceIndex} className="mb-2 border-b border-muted pb-1 last:border-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: colorPalette[traceIndex % colorPalette.length] }}
                />
                <p className="text-sm font-semibold">
                  {traceNames[traceIndex] || `Trace ${traceIndex + 1}`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-2 text-xs">
                <p>Start: {start.toFixed(3)}s</p>
                <p>End: {end.toFixed(3)}s</p>
                <p className="col-span-2 font-medium">
                  Duration: {length.toFixed(3)}s
                </p>
              </div>
            </div>
          ))}
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
          
          {/* Zoom Controls - Fixed position */}
          <div className="mt-2 px-2 pb-3 border-b border-border">
            <div className="flex space-x-2 items-center px-3 py-1.5 bg-background border border-border rounded-md shadow-sm w-fit">
              <span className="text-xs text-muted-foreground mr-1">
                Zoom: {Math.round(zoomFactor * 100)}%
              </span>
              <button 
                onClick={handleZoomIn} 
                className="p-1 rounded-md hover:bg-muted transition"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button 
                onClick={handleZoomOut} 
                className="p-1 rounded-md hover:bg-muted transition"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button 
                onClick={handleResetZoom} 
                className="p-1 rounded-md hover:bg-muted transition"
                title="Reset Zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Chart Container */}
          <div className="mt-4 h-full overflow-hidden">
            {processedChartData.length > 0 ? (
              <div 
                ref={containerRef} 
                className="overflow-auto"
                style={{ 
                  maxWidth: chartWidth,
                  height: containerHeight,
                  overflowY: "auto",
                  // Only show horizontal scrollbar when zoomed in
                  overflowX: zoomFactor > 1 ? "auto" : "hidden"
                }}
              >
                <BarChart
                  width={scaledChartWidth}
                  height={idealHeight}
                  data={processedChartData}
                  layout="vertical"
                  barSize={24}
                  margin={{ left: 140, right: 60, top: 20, bottom: 20 }}
                  barCategoryGap={24}
                  barGap={8}
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
                    tick={{ dy: 0 }}
                  />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    stroke="#4B5563"
                    tickFormatter={(val) => `${val.toFixed(2)}s`}
                    domain={[0, domainMax]}
                    fontSize={12}
                    ticks={[0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Render different bar configurations based on single vs dual traces */}
                  {isSingleTrace ? (
                    // Single trace mode - render just one centered bar
                    <>
                      <Bar
                        dataKey={baseTrace ? "start-0" : "start-1"}
                        stackId="singleRange"
                        fill="transparent"
                      />
                      <Bar
                        dataKey={baseTrace ? "length-0" : "length-1"}
                        stackId="singleRange"
                        fill={colorPalette[baseTrace ? 0 : 1]}
                        radius={[4, 4, 4, 4]}
                      >
                        <LabelList
                          dataKey={baseTrace ? "length-0" : "length-1"}
                          position="right"
                          formatter={(value: number) => `${value.toFixed(3)}s`}
                          fill="#4B5563"
                          style={{ fontSize: "0.75rem" }}
                        />
                      </Bar>
                    </>
                  ) : (
                    // Dual trace mode - render both sets of bars
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
                  )}
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