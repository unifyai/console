"use client";

import { useEffect, useRef, useId, useState, useMemo } from "react";
import * as d3 from "d3";
import { useDimensionsTracker } from "@/hooks/useDimensionsTracker";
import { LogsActions, FieldsActions, PlotDataItem } from "@/types/evals/grid";
import { drawBorders, drawBarChart, drawLineChart, drawScatterPlot, drawHistogram, checkLogScalability, clearCanvas } from "@/utils/evals/plot";
import { useTile, useTileItem } from '@/contexts/hooks/tile';
import { useTab } from '@/contexts/hooks/tab';
import PlotSettings from "./Sidebar";

const LogsPlot = ({ 
    tileId,
    tabId,
    interfaceId,
    projectId,
    logsActions,
    fieldsActions,
}: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {

    // Use granular hooks for better performance
    const {
        ui: tileUIState,
        dataActions: tileDataActions,
        actions: tileActions,
        plotTile: plotTileState,
        plotTileActions,
    } = useTile(tileId, tabId, interfaceId, projectId);

    const { itemActions } = useTileItem(tileId, tabId, interfaceId);
    
    // Get access to the tab context and actions with granular access
    const { ui: tabUIState } = useTab(tabId, interfaceId, projectId);

    // Get the item representation for the current tile
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

    // UI state from the tab
    const interactive = tabUIState?.interactive || false;
    const pending = tabUIState?.pending || tabUIState?.dataPending || tileUIState?.pending || false;

    // Use the plotDataItem from the tile's plot data
    const plotDataItem = useMemo(() => plotTileState?.plotDataItem || {
        plotLogs: [],
        plotArguments: {},
        plotFields: {}
    } as PlotDataItem, [plotTileState?.plotDataItem]);

    const setPlotDataItem = (newPlotDataItemOrUpdater: PlotDataItem | ((prev: PlotDataItem) => PlotDataItem)) => {
        // Update plotDataItem in the store
        if (plotTileActions && plotTileState) {
          if (typeof newPlotDataItemOrUpdater === 'function') {
            // Handle function updater pattern: (prev) => next
            const updaterFn = newPlotDataItemOrUpdater as (prev: PlotDataItem) => PlotDataItem;
            const newPlotDataItem = updaterFn(plotDataItem);
            plotTileActions.setPlotDataItem(newPlotDataItem);
          } else {
            // Handle direct value update
            plotTileActions.setPlotDataItem(newPlotDataItemOrUpdater);
          }
        }
    }

    // Init logs and handle local updates
    const {plotLogs: logs, plotArguments: args, plotFields: fields} = useMemo(() => plotDataItem, [plotDataItem]);

    // Initialize refs and container dimensions
    let svgRef = useRef(null);
    let containerRef = useRef(null);
    let settingsRef = useRef(null);
    const clipId = useId();
    const dimensions = useDimensionsTracker(svgRef); // Dynamic resizing
    const margins = { top: 0, right: 10, bottom: 65, left: 60 } // Margin on the sides
    const axisPadding = 20; // Extra padding between axes borders and plot borders

    // Plot settings
    let plotType = item?.plot_type;
    plotType = plotType ? plotType : "Scatter Plot";    

    let metric = item?.metric ? item?.metric : "mean";
    let isAggregated = item?.is_aggregated;
    const groupings = Object.fromEntries(Object.entries(args).filter(([_, tableArgs]) => tableArgs.grouping).map(([table, tableArgs]) => ([table, tableArgs.grouping.split(",")])));
    
    let binCount = item?.bin_count ? parseFloat(item?.bin_count) : 10;
    let [binCounts, setBinCounts] = useState([1, 100])
    let showRegression = item?.regression_line === "true" ? "true" : "false";

    let scaleX = item?.plot_scale_x;
    let scaleY = item?.plot_scale_y;
    let [logScaleXEnabled, setLogScaleXEnabled] = useState(true);
    let [logScaleYEnabled, setLogScaleYEnabled] = useState(true);
    scaleX = scaleX ? scaleX : "linear";
    scaleY = scaleY ? scaleY : "linear";

    // Axes and grouping selected on the plot
    const selectedXAxisProperty = item?.x_axis;
    const selectedYAxisProperty = item?.y_axis;
    const groupByProperty = item?.plot_group_by;

    // Sort bars for bar chart
    const [sortBars, setSortBars] = useState("asc")

    // Track zoom level and reset when changing plot type or axes
    let zoomRef = useRef(d3.zoomIdentity);
    useEffect(() => {
        zoomRef.current = d3.zoomIdentity
    }, [selectedXAxisProperty, selectedYAxisProperty, plotType])

    // Draw plot
    useEffect(() => {
        // Initialize SVG, container and placholder text
        const container = d3.select(containerRef.current)
        const placeholder = container.select(".placeholderText")
        const svg = d3.select(svgRef.current)
            .attr("width", dimensions.width)
            .attr("height", dimensions.height)
            .attr("viewBox", [0, 0, dimensions.width, dimensions.height]);
        const settings = d3.select(settingsRef.current)

        // Update clipbox dimensions
        svg.select("#clip-rect")
            .attr("x", margins.left)
            .attr("y", margins.top)
            .attr("width", dimensions.width - margins.left - margins.right)
            .attr("height", dimensions.height - margins.top - margins.bottom)

        // Draw plot borders
        drawBorders(svg, dimensions.height, dimensions.width, margins);

        const xTable = selectedXAxisProperty?.split(".")[0] || "";
        const yTable = selectedYAxisProperty?.split(".")[0] || "";

        // Draw selected plot type 
        if (plotType === "Line Chart") {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                placeholder.text("");
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, plotTileActions?.setPlotScaleX!, setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, fields, yTable,selectedYAxisProperty, scaleY, plotTileActions?.setPlotScaleY!, setLogScaleYEnabled)
                drawLineChart(
                    container,
                    svg,
                    settings,
                    adjustedScaleX,
                    adjustedScaleY,
                    dimensions,
                    margins,
                    axisPadding,
                    selectedXAxisProperty,
                    selectedYAxisProperty,
                    groupByProperty,
                    xTable,
                    yTable,
                    logs,
                    fields,
                    zoomRef,
                    interactive
                );
            } else {
                clearCanvas(svgRef, containerRef)
            }
        } 
        
        else if (plotType === "Bar Chart") {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                placeholder.text("");
                drawBarChart(
                    container,
                    svg,
                    settings,
                    "linear",
                    "linear",
                    dimensions,
                    margins,
                    axisPadding,
                    selectedXAxisProperty,
                    selectedYAxisProperty,
                    groupByProperty,
                    metric,
                    sortBars,
                    xTable,
                    yTable,
                    logs,
                    fields,
                    zoomRef,
                    interactive
                );
            } else {
                clearCanvas(svgRef, containerRef)
            }
        } 
        
        else if (plotType === "Histogram") {
            if (logs && selectedXAxisProperty) {
                placeholder.text("");    
                drawHistogram(
                    container,
                    svg, 
                    settings,
                    "linear",
                    "linear",
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    groupByProperty,
                    binCount,
                    plotTileActions?.setBinCount!,
                    binCounts,
                    setBinCounts,
                    xTable,
                    logs, 
                    fields
                )
            } else {
                clearCanvas(svgRef, containerRef)
            }
        } 
        
        else {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                if (logs.length > 1000) placeholder.text("Too many data points. Displaying a random subset.").attr("text-anchor", "start").attr("x", `${margins.left + 10}px`).attr("y", `${dimensions.height - margins.bottom - 10}px`).attr("font-size", "10px"); else placeholder.text("");
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, plotTileActions?.setPlotScaleX!, setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, fields, yTable, selectedYAxisProperty, scaleY, plotTileActions?.setPlotScaleY!, setLogScaleYEnabled)
                drawScatterPlot(
                    container,
                    svg,
                    settings,
                    adjustedScaleX,
                    adjustedScaleY,
                    dimensions,
                    margins,
                    axisPadding,
                    selectedXAxisProperty,
                    selectedYAxisProperty,
                    groupByProperty,
                    showRegression,
                    xTable,
                    yTable,
                    logs,
                    fields,
                    zoomRef,
                    interactive
                );
            } else {
                clearCanvas(svgRef, containerRef)
            }
        }

    }, [
        logs,
        dimensions,
        scaleX,
        scaleY,
        selectedXAxisProperty,
        selectedYAxisProperty,
        plotType,
        groupByProperty,
        sortBars,
        metric,
        binCount,
        binCounts,
        showRegression,
        isAggregated,
        interactive
    ]);

return (
    <div className="flex flex-row w-full h-full">
  
      {/* Chart Container */}
      <div
        className="flex flex-1 h-full bg-background relative border-t border-border"
        ref={containerRef}
      >
        {/* SVG content*/}
        <svg ref={svgRef} className="flex w-full h-full absolute z-0">
           <defs>
             <clipPath id={clipId}>
               <rect id={"clip-rect"} />
             </clipPath>
           </defs>
           <rect className="zoom-layer" />
           <g className="plotData" clipPath={`url(#${clipId})`} />
           <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="placeholderText" stroke="var(--foreground)" strokeWidth="0.1" style={{ "fill": "var(--foreground)" }} />
           <line className="bottomLine" stroke="var(--foreground)" stroke-width="0.5"/>
           <line className="leftLine" stroke="var(--foreground)" stroke-width="0.5"/>
           <line className="x-zero" stroke="var(--foreground)" strokeWidth="1" strokeDasharray="5,5" style={{ opacity: 0 }} />
           <line className="y-zero" stroke="var(--foreground)" strokeWidth="1" strokeDasharray="5,5" style={{ opacity: 0 }} />
           <g className="xAxis" transform={`translate(0, ${dimensions.height - margins.bottom})`} />
           <g className="yAxis" transform={`translate(${margins.left}, 0)`} />
        </svg>
        {/* Hover Tooltip */}
        <div style={{ position: "fixed", minWidth: "160px", maxWidth: "300px", pointerEvents: "none", background: "var(--background)", border: "1px solid var(--foreground)", padding: "8px", borderRadius: "4px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", transition: "opacity 0.2s", fontSize: "14px", opacity: 0, zIndex: 1000 }} className="plotTooltip gap-2 overflow-hidden" />
      </div>
  
      {/* Settings Panel */}
      <PlotSettings
            interactive={interactive}
            pending={pending}
            svgRef={svgRef}
            containerRef={containerRef}
            settingsRef={settingsRef}
            plotType={plotType}
            fields={fields}
            selectedXAxisProperty={selectedXAxisProperty}
            selectedYAxisProperty={selectedYAxisProperty}
            logs={logs}
            metric={metric}
            scaleX={scaleX} 
            scaleY={scaleY}
            logScaleXEnabled={logScaleXEnabled} 
            logScaleYEnabled={logScaleYEnabled}
            groupByProperty={groupByProperty}
            binCounts={binCounts}
            binCount={binCount}
            sortBars={sortBars}
            setSortBars={setSortBars}
            groupings={groupings}
            isAggregated={isAggregated}
            showRegression={showRegression}
            tileId={tileId}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            args={args}
            setPlotDataItem={setPlotDataItem}
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            plotTileActions={plotTileActions}
            tileDataActions={tileDataActions}
        />
  
    </div>
  );
};

export default LogsPlot;
