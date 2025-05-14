"use client";

import { useEffect, useRef, useId, useState, useMemo } from "react";
import * as d3 from "d3";
import { LogsActions, FieldsActions, PlotDataItem, GranularTileActions } from "@/types/evals/grid";
import { clearFixedTooltip } from "@/utils/evals/plots/tooltip";
import { useDimensionsTracker } from "@/hooks/useDimensionsTracker";
import { useTile, useTileItem } from '@/contexts/hooks/tile';
import { useTab } from '@/contexts/hooks/tab';
import PlotSettings from "./Sidebar";
import { drawPlot } from "@/utils/evals/plots/main";
import { usePlotArgumentsQuery, usePlotDataQueryWithTracking } from "@/hooks/Query/usePlotDataQuery";
import { usePlotTileSync }   from '@/contexts/hooks/tile/sync/usePlotTileSync';
import { PlotArguments } from "@/types/evals/logs";

const LogsPlot = ({ 
    tileId,
    tabId,
    interfaceId,
    projectId,
    tileActions,
    logsActions,
    fieldsActions,
}: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    tileActions: GranularTileActions,
    logsActions: LogsActions,
    fieldsActions: FieldsActions
}) => {

    // Use granular hooks for better performance
    const {
        ui: tileUIState,
        dataActions: tileDataActions,
        plotTile: plotTileState,
    } = useTile(tileId, tabId);

    // SYNCHRONISED PLOT-SPECIFIC ACTIONS (optimistic + router refresh)
    const { plotTileActions } = usePlotTileSync(tileId, tabId, tileActions);

    const { itemActions } = useTileItem(tileId, tabId);
    
    // Get access to the tab context and actions with granular access
    const { ui: tabUIState, uiActions: tabUIActions } = useTab(tabId, interfaceId);

    useEffect(() => {
        if (containerRef.current) {
            (containerRef.current as any).__hoveredLog = tabUIState?.hoveredLog;
            (containerRef.current as any).__setHoveredLog = tabUIActions?.setHoveredLog;
        }
      }, [tabUIState?.hoveredLog, tabUIActions?.setHoveredLog]);

    // Get the item representation for the current tile
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);

    // UI state from the tab
    const interactive = tabUIState?.interactive || false;
    const pending = tabUIState?.pending || tileUIState?.pending || false;

    // Use React Query to access plotDataItem and plotArguments
    const { 
        plotDataItem,
        isLoading: isPlotDataLoading,
        isError: isPlotDataError,
        error: plotDataError,
        updatePlotDataItemWithUpdater
    } = usePlotDataQueryWithTracking(tileId);

    const { data: args } = usePlotArgumentsQuery(tabId);

    // Init logs and handle local updates
    const {plotLogs: logs, plotFields: fields} = useMemo(() => plotDataItem, [plotDataItem]);
    
    // PlotSettings component needs setPlotDataItem to update the plot
    const setPlotDataItem = updatePlotDataItemWithUpdater;

    // Initialize refs and container dimensions
    let svgRef = useRef<SVGSVGElement>(null);
    let containerRef = useRef<HTMLDivElement>(null);
    let settingsRef = useRef<HTMLDivElement>(null);
    const clipId = useId();
    const dimensions = useDimensionsTracker(svgRef); // Dynamic resizing
    const margins = { top: 0, right: 10, bottom: 65, left: 70 } // Margin on the sides
    const axisPadding = 20; // Extra padding between axes borders and plot borders

    // Plot settings
    let plotType = item?.plot_type;
    plotType = plotType ? plotType : "Scatter Plot";    

    let metric = item?.metric ? item?.metric : "mean";
    let aggregateProperty = item?.plot_aggregate;
    const groupings = Object.fromEntries(Object.entries(args as PlotArguments).filter(([_, tableArgs]) => tableArgs.grouping).map(([table, tableArgs]) => ([table, tableArgs.grouping.split(",")])));
    
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
    const [isGroupingKeyMinimized, setIsGroupingKeyMinimized] = useState(false);
    useEffect(() => {
        if (settingsRef.current) {
            (settingsRef.current as any).__isGroupingKeyMinimized = isGroupingKeyMinimized;
            (settingsRef.current as any).__setIsGroupingKeyMinimized = setIsGroupingKeyMinimized;
        }
    }, [isGroupingKeyMinimized, setIsGroupingKeyMinimized]);

    // Sort bars for bar chart
    const [sortBars, setSortBars] = useState("asc")
    
    // Fixed tooltip states
    const [isTooltipMinimized, setIsTooltipMinimized] = useState(false);
    useEffect(() => {
        if (settingsRef.current) {
            (settingsRef.current as any).__isTooltipMinimized = isTooltipMinimized;
            (settingsRef.current as any).__setIsTooltipMinimized = setIsTooltipMinimized;
        }
    }, [isTooltipMinimized, setIsTooltipMinimized]);


    // Set up containers
    const container = d3.select(containerRef.current)
    const placeholder = container.select(".placeholderText") as d3.Selection<SVGTextElement, unknown, null, undefined>;
    const svg = d3.select(svgRef.current);
    const settings = d3.select(settingsRef.current)

    // Track zoom level and reset when changing plot type or axes
    let zoomRef = useRef(d3.zoomIdentity);
    useEffect(() => {
        zoomRef.current = d3.zoomIdentity;
        clearFixedTooltip(settings, setIsTooltipMinimized);
    }, [selectedXAxisProperty, selectedYAxisProperty, plotType])

    // Draw plot
    useEffect(() => {
        drawPlot(
            svg, 
            container, 
            settings, 
            placeholder, 
            dimensions, 
            margins, 
            axisPadding, 
            plotType, 
            logs, 
            fields, 
            selectedXAxisProperty, 
            selectedYAxisProperty, 
            groupByProperty,
            aggregateProperty,
            scaleX,
            scaleY,
            metric,
            sortBars,
            binCount,
            binCounts,
            setBinCounts,
            showRegression,
            zoomRef,
            interactive,
            setIsTooltipMinimized,
            svgRef,
            containerRef,
            setLogScaleXEnabled,
            setLogScaleYEnabled,
            plotTileActions,
            plotTileState
        );
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
        aggregateProperty,
        interactive,
        tileUIState?.color,
        plotTileState?.plot_group_by_colors,
        tabUIState?.hoveredLog
    ]);

return (
    <div className="flex flex-row w-full h-full items-stretch min-h-0 overflow-hidden">
  
      {/* Chart Container */}
      <div
        className="flex flex-1 h-full bg-background relative border-t border-border overflow-hidden"
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
        <div style={{ position: "absolute", minWidth: "160px", maxWidth: "300px", pointerEvents: "none", background: "var(--background)", border: "1px solid var(--foreground)", padding: "8px", borderRadius: "4px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", transition: "opacity 0.2s", fontSize: "14px", opacity: 0, zIndex: 1000 }} className="plotTooltip gap-2 overflow-hidden" />
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
            aggregateProperty={aggregateProperty}
            showRegression={showRegression}
            tileId={tileId}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            args={args as PlotArguments}
            setPlotDataItem={setPlotDataItem}
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            plotTileActions={plotTileActions}
            tileDataActions={tileDataActions}
            plotTileState={plotTileState}
            isTooltipMinimized={isTooltipMinimized}
            setIsTooltipMinimized={setIsTooltipMinimized}
            isGroupingKeyMinimized={isGroupingKeyMinimized}
            setIsGroupingKeyMinimized={setIsGroupingKeyMinimized}
        />
  
    </div>
  );
};

export default LogsPlot;
