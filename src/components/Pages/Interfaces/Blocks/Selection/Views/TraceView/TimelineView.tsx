"use client";

import React, { useState, useMemo, useEffect, useRef, useId } from "react";
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
import { Span } from "@/types/interfaces/traces";

/**
 * TimelineViewButton now supports up to two subtree traces.
 * 
 * - If both baseTrace and targetTrace are provided, it displays them together.
 * - If only one is provided, it displays the single timeline.
 */
export default function TimelineViewButton({
  baseSpanId,
  targetSpanId,
  findSpanById,
  baseTrace: initialBaseTrace,
  targetTrace: initialTargetTrace,
}: {
  baseSpanId?: string;
  targetSpanId?: string;
  findSpanById?: (id: string) => Span | undefined;
  baseTrace?: Span[];
  targetTrace?: Span[];
}) {
  const [open, setOpen] = useState(false);
  const [chartWidth, setChartWidth] = useState(1000);
  const [chartHeight, setChartHeight] = useState(600);
  const [zoomFactor, setZoomFactor] = useState(1); // Default zoom factor
  const [customZoomInput, setCustomZoomInput] = useState("100"); // New state for custom zoom input
  const [domainMin, setDomainMin] = useState(0); // Minimum value of the domain
  const [domainMax, setDomainMax] = useState<number | string>("dataMax+0.2");
  const [tick, setTick] = useState(0);
  const gidBase = useId(); // unique prefix for gradient ids
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Resolve the freshest Span objects when IDs + finder are provided.
  const liveBaseSpan = baseSpanId && findSpanById ? findSpanById(baseSpanId) : undefined;
  const liveTargetSpan = targetSpanId && findSpanById ? findSpanById(targetSpanId) : undefined;

  // Memoize to keep array reference stable between renders unless content truly changes
  const baseTrace = React.useMemo(() => (
    liveBaseSpan ? [liveBaseSpan] : initialBaseTrace
  ), [liveBaseSpan, initialBaseTrace]);

  const targetTrace = React.useMemo(() => (
    liveTargetSpan ? [liveTargetSpan] : initialTargetTrace
  ), [liveTargetSpan, initialTargetTrace]);

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
    const tracesToUnify: Span[][] = [];
    if (baseTrace) tracesToUnify.push(baseTrace);
    if (targetTrace) tracesToUnify.push(targetTrace);
    // Current timestamp in seconds relative to the trace start (avoids mixing epoch vs offset)
    let nowRelSecs = 0;
    const flatRoots = tracesToUnify.flat();
    // Extract earliest absolute timestamp if available
    const absTimes = flatRoots
      .map((s) => (s.timestamp ? Date.parse(s.timestamp) / 1000 : undefined))
      .filter((n): n is number => typeof n === "number" && !isNaN(n));

    if (absTimes.length) {
      // Use the LATEST trace start as the zero-point; this keeps durations
      // reasonable when comparing a very old finished trace with a fresh
      // live-streaming one.
      const t0AbsLatest = Math.max(...absTimes);
      nowRelSecs = Math.max(0, Date.now() / 1000 - t0AbsLatest);
    } else {
      // Fallback: just use the tick counter (seconds since first render)
      nowRelSecs = tick;
    }

    return unifyTracesForChart(tracesToUnify, nowRelSecs);
  }, [baseTrace, targetTrace, tick]);

  // Determine if we're showing a single trace or dual traces
  const isSingleTrace = useMemo(() => {
    return !baseTrace || !targetTrace;
  }, [baseTrace, targetTrace]);

  // Calculate the maximum value in the data to use for domain calculation
  const maxValue = useMemo(() => {
    let max = 0;
    chartData.forEach((raw) => {
      const itemAny = raw as any;
      Object.keys(itemAny).forEach((key) => {
        if ((key.startsWith('start-') || key.startsWith('length-')) && typeof itemAny[key] === 'number') {
          if (key.startsWith('start-')) {
            const lengthKey = key.replace('start-', 'length-');
            const total = itemAny[key] + (itemAny[lengthKey] || 0);
            max = Math.max(max, total);
          }
        }
      });
    });
    return max || 1;
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
    if (!open) return; // run only when dialog opens
    setZoomFactor(1);
    containerRef.current?.scrollTo({ left: 0 });
  }, [open]);

  // For single trace mode, we'll modify the data to center the bars
  const processedChartData = useMemo(() => {
    return chartData;
  }, [chartData]);
  
  // Calculate earliest start time to trim leading empty space (used for shifting data)
  const minStart = useMemo(() => {
    let min = Number.MAX_VALUE;
    chartData.forEach((row: any) => {
      Object.keys(row).forEach((k) => {
        if (k.startsWith('start-') && typeof row[k] === 'number' && row[k] > 0) {
          min = Math.min(min, row[k]);
        }
      });
    });
    return min === Number.MAX_VALUE ? 0 : min;
  }, [chartData]);
  
  // Center the view on initial load and after zoom changes
  useEffect(() => {
    if (!open) return;
    if (containerRef.current && zoomFactor > 1) {
      const relativePosition = minStart / maxValue;
      const scrollableWidth = containerRef.current?.scrollWidth || 0;
      const containerWidth = containerRef.current?.clientWidth || 1;
      const scrollPosition = Math.max(0, (scrollableWidth - containerWidth) * relativePosition);
      if (containerRef.current) containerRef.current.scrollLeft = scrollPosition;
    }
  }, [zoomFactor, open, minStart, maxValue]);

  // Remount BarChart only when row-count changes (avoids pulse).
  const barChartKey = `${processedChartData.length}`;

  // ------------------------------------------------------------------
  // Debug: log dataset only when it actually changes, not every tick
  // ------------------------------------------------------------------
  const prevDataRef = React.useRef<string>(JSON.stringify(processedChartData));
  useEffect(() => {
    const nowStr = JSON.stringify(processedChartData);
    if (nowStr !== prevDataRef.current) {
      prevDataRef.current = nowStr;
    }
  }, [processedChartData]);

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
  }, []);

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
          <p className="text-title border-b border-border pb-1 mb-2">{label}</p>
          
          {/* Trace details */}
          {validTraces.map(({ traceIndex, start, length, end }) => (
            <div key={traceIndex} className="mb-2 border-b border-muted pb-1 last:border-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: colorPalette[traceIndex % colorPalette.length] }}
                />
                <p className="text-body text-strong">
                  {traceNames[traceIndex] || `Trace ${traceIndex + 1}`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-2 text-caption">
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

  // Handle custom zoom input change
  const handleCustomZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only numbers
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCustomZoomInput(value);
  };
  
  // Apply custom zoom when user presses Enter or input loses focus
  const applyCustomZoom = () => {
    // Parse the input value as a number
    const zoomValue = parseInt(customZoomInput, 10);
    
    // Validate the zoom value (100% to 1000%)
    if (!isNaN(zoomValue) && zoomValue >= 100 && zoomValue <= 1000) {
      // Convert percentage to factor (e.g., 200% -> 2)
      const newZoomFactor = zoomValue / 100;
      setZoomFactor(newZoomFactor);
    } else {
      // Reset the input to the current zoom level if invalid
      setCustomZoomInput(Math.round(zoomFactor * 100).toString());
    }
  };
  
  // Update the custom zoom input when zoom factor changes
  useEffect(() => {
    setCustomZoomInput(Math.round(zoomFactor * 100).toString());
  }, [zoomFactor]);

  // Handle zoom in
  const handleZoomIn = () => {
    setZoomFactor(prev => {
      const newZoom = prev * 1.25; // More fine-grained zoom steps (changed from 1.5)
      // Cap zoom to prevent over-zooming - increased from 5 to 10
      return Math.min(newZoom, 10);
    });
  };

  // Handle zoom out
  const handleZoomOut = () => {
    setZoomFactor(prev => {
      const newZoom = prev / 1.25; // More fine-grained zoom steps (changed from 1.5)
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

  // Pan left
  const handlePanLeft = () => {
    if (containerRef.current && containerRef.current.scrollLeft > 0) {
      // Calculate a reasonable pan amount (about 25% of the visible width)
      const panAmount = containerRef.current.clientWidth * 0.25;
      containerRef.current.scrollLeft -= panAmount;
    }
  };
  
  // Pan right
  const handlePanRight = () => {
    if (containerRef.current) {
      // Calculate a reasonable pan amount (about 25% of the visible width)
      const panAmount = containerRef.current.clientWidth * 0.25;
      const maxScroll = containerRef.current.scrollWidth - containerRef.current.clientWidth;
      if (containerRef.current.scrollLeft < maxScroll) {
        containerRef.current.scrollLeft += panAmount;
      }
    }
  };

  // Calculate dynamic tick marks based on zoom factor
  const dynamicTicks = useMemo(() => {
    // Base number of intervals (4 intervals = 5 ticks at 100% zoom)
    const baseIntervals = 4;
    
    // Calculate intervals based on zoom factor with diminishing returns
    // More intervals at higher zoom levels, but not too many to avoid overcrowding
    let intervals = baseIntervals;
    if (zoomFactor > 1) {
      // Logarithmic growth: more ticks initially, then slower growth at higher zoom levels
      intervals = Math.min(
        40, // Cap at 40 intervals (41 ticks)
        Math.floor(baseIntervals + Math.log2(zoomFactor) * 10)
      );
    }
    
    // Generate evenly spaced tick values
    const ticks = [];
    const step = maxValue / intervals;
    
    // Create ticks with slight adjustments to ensure important values are included
    for (let i = 0; i <= intervals; i++) {
      const tickValue = step * i;
      ticks.push(tickValue);
    }
    
    return ticks;
  }, [maxValue, zoomFactor]);

  // Dynamically adjust tick density based on available width
  const adjustedTickCount = useMemo(() => {
    // Calculate approximate pixels per tick
    const availableWidth = scaledChartWidth - 200; // Account for margins
    const tickCount = dynamicTicks.length;
    const pixelsPerTick = availableWidth / tickCount;
    
    // If ticks are too close together, reduce them
    if (pixelsPerTick < 50) { // Minimum 50px between ticks
      // Skip some ticks to maintain readability
      const skipFactor = Math.ceil(50 / pixelsPerTick);
      return dynamicTicks.filter((_, index) => index % skipFactor === 0);
    }
    
    return dynamicTicks;
  }, [dynamicTicks, scaledChartWidth]);

  // Live ticker to refresh the chart while there are running spans
  const traces = useMemo(() => [ ...(baseTrace ?? []), ...(targetTrace ?? []) ], [baseTrace, targetTrace]);

  useEffect(() => {
    function spanIsRunning(span: Span): boolean {
      if (span.completed === false || span.execTime === undefined || span.execTime === null) {
        return true;
      }
      return span.childSpans?.some(spanIsRunning) ?? false;
    }

    const hasRunning = traces.some(spanIsRunning);
    if (!hasRunning) return; // nothing to animate

    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [traces]);

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
          
          {/* Enhanced Zoom Controls - Fixed position */}
          <div className="mt-2 px-2 pb-3 border-b border-border">
            <div className="flex space-x-2 items-center px-3 py-1.5 bg-background border border-border rounded-md shadow-sm w-fit">
              <span className="text-caption text-muted-foreground mr-1">Zoom:</span>
              <div className="flex items-center">
                <input
                  type="text"
                  value={customZoomInput}
                  onChange={handleCustomZoomChange}
                  onBlur={applyCustomZoom}
                  onKeyDown={(e) => e.key === 'Enter' && applyCustomZoom()}
                  className="w-12 h-6 text-caption px-1 border border-input rounded-sm mr-1 text-center"
                  aria-label="Zoom percentage"
                />
                <span className="text-caption text-muted-foreground">%</span>
              </div>
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
              
              {/* Pan controls - only show when zoomed in */}
              {zoomFactor > 1 && (
                <>
                  <div className="mx-1 h-4 w-px bg-border" />
                  <button 
                    onClick={handlePanLeft} 
                    className="p-1 rounded-md hover:bg-muted transition"
                    title="Pan Left"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={handlePanRight} 
                    className="p-1 rounded-md hover:bg-muted transition"
                    title="Pan Right"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
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
                  //overflowX: zoomFactor > 1 ? "auto" : "hidden"
                }}
              >
                <BarChart
                  key={barChartKey}
                  width={scaledChartWidth}
                  height={idealHeight}
                  data={processedChartData}
                  layout="vertical"
                  barSize={24}
                  margin={{ left: 0, right: 0, top: 20, bottom: 20 }}
                  barCategoryGap={24}
                  barGap={8}
                >
                  {/* Gradient definitions for running spans */}
                  <defs>
                    {[0,1].map((idx) => (
                      <linearGradient id={`${gidBase}-running-${idx}`} key={idx} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={colorPalette[idx % colorPalette.length]} stopOpacity={1} />
                        <stop offset="70%" stopColor={colorPalette[idx % colorPalette.length]} stopOpacity={1} />
                        <stop offset="100%" stopColor={colorPalette[idx % colorPalette.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    stroke="#E5E7EB"
                    strokeDasharray="3 3"
                    horizontal={false}
                    verticalPoints={adjustedTickCount.map(tick => tick)}
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
                    tickFormatter={(val) => {
                      // Increase precision (decimal places) as zoom level increases
                      const decimalPlaces = Math.min(4, Math.max(2, Math.floor(zoomFactor)));
                      return `${val.toFixed(decimalPlaces)}s`;
                    }}
                    domain={[0, domainMax]}
                    fontSize={12}
                    ticks={adjustedTickCount}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Render different bar configurations based on single vs dual traces */}
                  {isSingleTrace ? (
                    // Single trace mode - render just one centered bar
                    <>
                      <Bar
                        isAnimationActive={false}
                        dataKey={baseTrace ? "start-0" : "start-1"}
                        stackId="singleRange"
                        fill="transparent"
                      />
                      <Bar
                        isAnimationActive={false}
                        dataKey={baseTrace ? "length-0" : "length-1"}
                        stackId="singleRange"
                        fill={colorPalette[baseTrace ? 0 : 1]}
                        radius={[4, 4, 4, 4]}
                      >
                        {processedChartData.map((entry, idx) => {
                          const traceIdx = baseTrace ? 0 : 1;
                          const runningKey = `running-${traceIdx}` as keyof typeof entry;
                          const isRunning = Boolean(entry[runningKey]);
                          const fill = isRunning ? `url(#${gidBase}-running-${traceIdx})` : colorPalette[traceIdx];
                          return <Cell key={`cell-${idx}`} fill={fill} />;
                        })}
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
                        isAnimationActive={false}
                        dataKey="start-0"
                        stackId="range-0"
                        fill="transparent"
                      />
                      <Bar
                        isAnimationActive={false}
                        dataKey="length-0"
                        stackId="range-0"
                        fill={colorPalette[0]}
                        radius={[4, 4, 4, 4]}
                      >
                        {processedChartData.map((entry, idx) => {
                          const fill = entry["running-0"] ? `url(#${gidBase}-running-0)` : colorPalette[0];
                          return <Cell key={`r0-${idx}`} fill={fill} />;
                        })}
                        <LabelList
                          dataKey="length-0"
                          position="right"
                          formatter={(value: number) => `${value.toFixed(3)}s`}
                          fill="#4B5563"
                          style={{ fontSize: "0.75rem" }}
                        />
                      </Bar>
                      <Bar
                        isAnimationActive={false}
                        dataKey="start-1"
                        stackId="range-1"
                        fill="transparent"
                      />
                      <Bar
                        isAnimationActive={false}
                        dataKey="length-1"
                        stackId="range-1"
                        fill={colorPalette[1]}
                        radius={[4, 4, 4, 4]}
                      >
                        {processedChartData.map((entry, idx) => {
                          const fill = entry["running-1"] ? `url(#${gidBase}-running-1)` : colorPalette[1];
                          return <Cell key={`r1-${idx}`} fill={fill} />;
                        })}
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