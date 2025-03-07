"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";

import PlotType from "./Buttons/PlotType";
import PlotScale from "./Buttons/PlotScale";
import PlotRegression from "./Buttons/PlotRegression";
import PlotGroupBy from "./Buttons/PlotGroupBy";
import PlotReset from "./Buttons/PlotReset";
import PlotBins from "./Buttons/PlotBins";
import PlotRefresh from "./Buttons/PlotRefresh";
import PlotSort from "./Buttons/PlotSort";

import { useDimensionsTracker } from "@/hooks/useDimensionsTracker";
import { LogFieldsResponseProps, LogProps, PlotArguments } from "@/types/evals/logs";
import { LogsActions, FieldsActions, PlotDataItem } from "@/types/evals/grid";
import { drawBorders, drawBarChart, drawLineChart, drawScatterPlot, drawHistogram, checkLogScalability, clearCanvas } from "@/utils/evals/plot";
import PlotAxis from "./Buttons/PlotAxis";
import { ItemType, TileProps } from "@/types/evals/grid";

const LogsPlot = ({ interactive, item, updateItem, project, pending, plotDataItem_ = {plotLogs: [], plotArguments: {}, plotFields: {}}, tableNames, logsActions, fieldsActions }: {
    interactive: boolean,
    item: TileProps,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void,
    project: string | undefined,
    pending: boolean,
    tableNames: string[],
    logsActions: LogsActions,
    fieldsActions: FieldsActions
    plotDataItem_: { plotLogs: LogProps[]; plotArguments: PlotArguments; plotFields: LogFieldsResponseProps };
}) => {

    // Init logs and handle local updates
    const [plotDataItem, setPlotDataItem] = useState<PlotDataItem>(plotDataItem_);
    const {plotLogs: logs, plotArguments: args, plotFields: fields} = plotDataItem
    useEffect(() => {
        if (JSON.stringify(plotDataItem_) != JSON.stringify(plotDataItem)) setPlotDataItem(plotDataItem_);
    }, [plotDataItem_]);
    
    // Initialize refs and container dimensions
    let svgRef = useRef(null);
    let containerRef = useRef(null);
    const dimensions = useDimensionsTracker(svgRef); // Dynamic resizing
    const margins = { top: 35, right: 100, bottom: 65, left: 60 } // Margin on the sides
    const axisPadding = 20; // Extra padding between axes borders and plot borders

    // Plot settings
    let plotType = item.plot_type;
    plotType = plotType ? plotType : "Scatter Plot";    

    let metric = item.metric ? item.metric : "mean";

    let binCount = item.bin_count ? parseFloat(item.bin_count) : 10;
    let [binCounts, setBinCounts] = useState([1, 100])
    let showRegression = item.regression_line === "true" ? "true" : "false";

    let scaleX = item.plot_scale_x;
    let scaleY = item.plot_scale_y;
    let [logScaleXEnabled, setLogScaleXEnabled] = useState(true);
    let [logScaleYEnabled, setLogScaleYEnabled] = useState(true);
    scaleX = scaleX ? scaleX : "linear";
    scaleY = scaleY ? scaleY : "linear";

    // Axes and grouping selected on the plot
    const selectedXAxisProperty = item.x_axis;
    const selectedYAxisProperty = item.y_axis;
    const groupByProperty = item.plot_group_by;

    // Sort bars for bar chart
    const [sortBars, setSortBars] = useState("asc")

    // Draw plot
    useEffect(() => {
        // Initialize SVG, container and placholder text
        const container = d3.select(containerRef.current)
        const placeholder = container.select(".placeholderText")
        const svg = d3.select(svgRef.current)
            .attr("width", dimensions.width)
            .attr("height", dimensions.height)
            .attr("viewBox", [0, 0, dimensions.width, dimensions.height]);

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
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, updateItem(item, "plot_scale_x"), setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, fields, yTable,selectedYAxisProperty, scaleY, updateItem(item, "plot_scale_y"), setLogScaleYEnabled)
                drawLineChart(
                    container,
                    svg,
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
                    fields
                );
            } else {
                clearCanvas(svgRef, containerRef)
                placeholder
                .attr("stroke", "black") 
                .attr("stroke-width", 0.1)
                .attr("fill", "gray")
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .text("Select two numeric properties to plot");
            }
        } 
        
        else if (plotType === "Bar Chart") {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                placeholder.text("");
                drawBarChart(
                    container,
                    svg,
                    "linear",
                    "linear",
                    dimensions,
                    margins,
                    axisPadding,
                    selectedXAxisProperty,
                    selectedYAxisProperty,
                    metric,
                    sortBars,
                    xTable,
                    yTable,
                    logs,
                    fields
                );
            } else {
                clearCanvas(svgRef, containerRef)
                placeholder
                .attr("stroke", "black") 
                .attr("stroke-width", 0.1)
                .attr("fill", "gray")
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .text("Select a property and a reduction metric to plot ");    
            }
        } 
        
        else if (plotType === "Histogram") {
            if (logs && selectedXAxisProperty) {
                placeholder.text("");    
                drawHistogram(
                    container,
                    svg, 
                    "linear",
                    "linear",
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    binCount,
                    updateItem(item, "bin_count"),
                    binCounts,
                    setBinCounts,
                    xTable,
                    logs, 
                    fields
                )
            } else {
                clearCanvas(svgRef, containerRef)
                placeholder
                .attr("stroke", "black") 
                .attr("stroke-width", 0.1)
                .attr("fill", "gray")
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .text("Select a numeric or time property to plot");    
            }
        } 
        
        else {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                placeholder.text("");
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, updateItem(item, "plot_scale_x"), setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, fields, yTable, selectedYAxisProperty, scaleY, updateItem(item, "plot_scale_y"), setLogScaleYEnabled)
                drawScatterPlot(
                    container,
                    svg,
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
                    fields
                );
            } else {
                clearCanvas(svgRef, containerRef)
                placeholder
                .attr("stroke", "black") 
                .attr("stroke-width", 0.1)
                .attr("fill", "gray")
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .text("Select two numeric properties to plot");    
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
        showRegression
    ]);


    // Adjust customization button size to card size
    const scaleFactor = Math.min(1, Math.max(0.5, dimensions.height / 500));
    const translateX = Math.max(0, (1200 - dimensions.height) * 0.01) / scaleFactor;
    const translateY = Math.max(0, (200 - dimensions.height) * 0.01) / scaleFactor;

    return (
        <div className="flex w-full h-full bg-background rounded-md relative my-2 LogsPlot" ref={containerRef}>

            {/* Axes and type */}
            <div className="absolute bottom-6 right-1 z-10">
                <PlotAxis
                    interactive={interactive}
                    pending={pending}
                    fields={fields}
                    setAxisProperty={updateItem(item, "x_axis")}
                    axis="X"
                    axisProperty={selectedXAxisProperty}
                    plotType={plotType}
                    logs={logs}
                    metric={metric}
                    setMetric={(updateItem(item, "metric"))}
                />
            </div>
            {plotType != "Histogram" && 
                <div className="absolute top-0 left-1 z-10">
                    <PlotAxis
                        interactive={interactive}
                        pending={pending}
                        fields={fields}
                        setAxisProperty={updateItem(item, "y_axis")}
                        axis="Y"
                        axisProperty={selectedYAxisProperty}
                        plotType={plotType}
                        logs={logs}
                        metric={metric}
                        setMetric={(updateItem(item, "metric"))}
                    />
                </div>            
            }
            <div className="absolute top-0 right-1 z-10">
                <PlotType
                    interactive={interactive}
                    svgRef={svgRef}
                    containerRef={containerRef}
                    plotType={plotType}
                    setPlotType={updateItem(item, "plot_type")}
                    fields={fields}
                    selectedXAxisProperty={selectedXAxisProperty}
                    setSelectedXAxisProperty={updateItem(item, "x_axis")}
                    selectedYAxisProperty={selectedYAxisProperty}
                    setSelectedYAxisProperty={updateItem(item, "y_axis")}
                />
            </div>

            {/* Customization */}
            <div 
                className="absolute z-10 flex right-3 top-12 flex-col gap-1.5"
                style={{transform: `scale(${scaleFactor}) translateX(${translateX}px) translateY(${translateY}px)`, transformOrigin: 'top left'}}
            >
                {project &&
                    <PlotRefresh tables={tableNames} project={project} item={item} pending={pending} args={args} setPlotDataItem={setPlotDataItem} logsActions={logsActions} fieldsActions={fieldsActions} updateItem={updateItem} logs={logs}/>
                }
                {((plotType === "Histogram" && selectedXAxisProperty) || (selectedXAxisProperty && selectedYAxisProperty)) &&
                    <>
                        <PlotReset
                            svgRef={svgRef}
                            containerRef={containerRef}
                            setSelectedXAxisProperty={updateItem(item, "x_axis")}
                            setSelectedYAxisProperty={updateItem(item, "y_axis")}
                            setGroupByProperty={updateItem(item, "plot_group_by")}
                        />
                        {plotType === "Histogram"
                            ?   <PlotBins binCount={binCount} binCounts={binCounts} setBinCount={updateItem(item, "bin_count")}/>
                            :   plotType != "Bar Chart"
                                ?   <PlotGroupBy fields={fields} groupBy={groupByProperty} setGroupBy={updateItem(item, "plot_group_by")} logs={logs}/>
                                :   null
                        }
                        {!["Histogram", "Bar Chart"].includes(plotType) &&
                            <PlotScale 
                                scaleX={scaleX} 
                                scaleY={scaleY}
                                setScaleX={updateItem(item, "plot_scale_x")}
                                setScaleY={updateItem(item, "plot_scale_y")} 
                                logScaleXEnabled={logScaleXEnabled} 
                                logScaleYEnabled={logScaleYEnabled} 
                                selectedXAxisProperty={selectedXAxisProperty} 
                                fields={fields}
                            />
                        }
                        {plotType === "Bar Chart" && 
                            <PlotSort sortBars={sortBars} setSortBars={setSortBars}/>
                        }
                        {plotType === "Scatter Plot" && 
                            <PlotRegression 
                                showRegression={showRegression} 
                                setShowRegression={updateItem(item, "regression_line")}
                            />
                        }
                    </>
                }
            </div>

            {/* Chart */}
            <svg ref={svgRef} className="flex w-full h-full absolute z-0">
                <defs>
                    <clipPath id="clip">
                        <rect id={"clip-rect"}/>
                    </clipPath>
                </defs>
                <g className="plotData" clipPath="url(#clip)"/>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="placeholderText"/>
                <line className="bottomLine" stroke="var(--foreground)" stroke-width="0.5"/>
                <line className="leftLine" stroke="var(--foreground)" stroke-width="0.5"/>
                <line className="topLine" stroke="var(--foreground)" stroke-width="0.5"/>
                <line className="x-zero" stroke="var(--foreground)" stroke-width="1" stroke-dasharray="5.5" style={{opacity: 0}}/>
                <line className="y-zero" stroke="var(--foreground)" stroke-width="1" stroke-dasharray="5.5" style={{opacity: 0}}/>
                <g className="xAxis" transform={`translate(0, ${dimensions.height - margins.bottom})`}/>
                <g className="yAxis" transform={`translate(${margins.left}, 0)`}/>
            </svg>
            <div
                style={{
                    position: "fixed",
                    minWidth: "160px",
                    maxWidth: "300px",
                    pointerEvents: "none",
                    background: "var(--background)",
                    border: "1px solid var(--foreground)",
                    padding: "8px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    transition: "opacity 0.2s",
                    fontSize: "14px",
                    opacity: 0,
                    zIndex: 1000
                }}
                className="plotTooltip gap-2 overflow-hidden"
            />
            <div
                style={{opacity: 0, "scrollbar-width": "none", backgroundColor: "var(--background)"} as React.CSSProperties} 
                className="groupingKey absolute bottom-20 right-2 z-5 py-2 px-3 flex flex-col gap-1 overflow-auto w-[100px] h-[150px] rounded-md border-2 border-muted"
            />
        </div>
    );
};

export default LogsPlot;
