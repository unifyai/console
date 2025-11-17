"use client";

import { useEffect, useRef, useId, useState, useMemo } from "react";
import * as d3 from "d3";
import { LogsActions, FieldsActions, GranularTileActions, ContextActions, ProjectsActions } from "@/types/interfaces/grid";
import { clearFixedTooltip } from "@/utils/interfaces/plots/tooltip";
import { useDimensionsTracker } from "@/hooks/Interfaces/useDimensionsTracker";
import { useTile, useTileItem } from '@/contexts/hooks/tile';
import { useTab } from '@/contexts/hooks/tab';
import PlotSettings from "./Sidebar";
import { drawPlot } from "@/utils/interfaces/plots/main";
import { usePlotArgumentsQuery, usePlotDataQueryWithTracking } from "@/hooks/Interfaces/Query/usePlotDataQuery";
import { usePlotTileSync } from '@/contexts/hooks/tile/sync/usePlotTileSync';
import { PlotArguments } from "@/types/interfaces/logs";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useGlobalUIMode } from '@/contexts/hooks/useGlobalUIMode';

const LogsPlot = ({ 
    tileId,
    tabId,
    interfaceId,
    projectId,
    tileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions,
}: {
    tileId: string,
    tabId: string,
    interfaceId: string,
    projectId: string,
    tileActions: GranularTileActions,
    projectsActions: ProjectsActions,
    contextActions: ContextActions,
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
    const { plotTileActions } = usePlotTileSync(
        tileId,
        tabId,
        tileActions,
        projectsActions,
        contextActions,
        logsActions,
        fieldsActions
    );

    const { itemActions } = useTileItem(tileId, tabId);
    
    // Get access to the tab context and actions with granular access
    const { ui: tabUIState, uiActions: tabUIActions } = useTab(tabId, interfaceId);
    const setFocusPaneOpen = useStoreContext(state => state.setFocusPaneOpen);

    useEffect(() => {
        if (containerRef.current) {
            (containerRef.current as any).__hoveredLog = tabUIState?.hoveredLog;
            (containerRef.current as any).__setHoveredLog = tabUIActions?.setHoveredLog;
        }
      }, [tabUIState?.hoveredLog, tabUIActions?.setHoveredLog]);

    // Get the item representation for the current tile
    const item = useMemo(() => itemActions?.asTileItem(), [itemActions]);
    
    // Get global UI mode settings
    const { isInteractive } = useGlobalUIMode();

    // UI state from the tab
    const interactive = isInteractive;
    const pending = tabUIState?.pending || tileUIState?.pending || false;

    // Use React Query to access plotDataItem and plotArguments
    const { 
        plotDataItem,
        isLoading: isPlotDataLoading,
        isError: isPlotDataError,
        error: plotDataError,
    } = usePlotDataQueryWithTracking(tileId);

    const { data: args } = usePlotArgumentsQuery(tabId);

    // Init logs and handle local updates
    const {plotLogs: logs, plotFields: fields} = useMemo(() => plotDataItem, [plotDataItem]);

    // Initialize refs and container dimensions
    let svgRef = useRef<SVGSVGElement>(null);
    let containerRef = useRef<HTMLDivElement>(null);
    let settingsRef = useRef<HTMLDivElement>(null);
    const clipId = useId();
    const dimensions = useDimensionsTracker(svgRef); // Dynamic resizing
    const margins = useMemo(() => ({ top: 0, right: 15, bottom: 45, left: 55 }), []); // Optimized margins
    const axisPadding = 15; // Extra padding between axes borders and plot borders

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
    const [zoomEnabled, setZoomEnabled] = useState(false);
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
            zoomEnabled,
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
        zoomEnabled,
        tileUIState?.color,
        plotTileState?.plot_group_by_colors,
        tabUIState?.hoveredLog,
        container,
        fields,
        margins,
        placeholder,
        plotTileActions,
        plotTileState,
        settings,
        svg
    ]);

return (
    <div className="flex flex-row w-full h-full items-stretch min-h-0 overflow-hidden">
  
      {/* Chart Container */}
      <div
        className="flex flex-1 h-full bg-background relative overflow-hidden"
        ref={containerRef}
      >
        {/* Focus button moved to sidebar toolbar */}
        {/* SVG content*/}
        <svg ref={svgRef} className="w-full h-full absolute top-0 left-0 z-0">
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
            showSettings={interactive}
            tabUIState={tabUIState}
            tabUIActions={tabUIActions}
            setFocusPaneOpen={setFocusPaneOpen}
            tileName={item?.name}
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
            zoomEnabled={zoomEnabled}
            setZoomEnabled={setZoomEnabled}
            tileId={tileId}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            serverTileActions={tileActions}
            projectsActions={projectsActions}
            contextActions={contextActions} 
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            plotTileState={plotTileState}
            isTooltipMinimized={isTooltipMinimized}
            setIsTooltipMinimized={setIsTooltipMinimized}
            isGroupingKeyMinimized={isGroupingKeyMinimized}
            setIsGroupingKeyMinimized={setIsGroupingKeyMinimized}
            plotTileActions={plotTileActions}
            tileDataActions={tileDataActions}
        />

    </div>
  );
};

export default LogsPlot;
