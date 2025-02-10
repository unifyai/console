"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";

import PlotType from "./Buttons/PlotType";
import PlotScale from "./Buttons/PlotScale";
import PlotRegression from "./Buttons/PlotRegression";
import PlotGroupBy from "./Buttons/PlotGroupBy";
import PlotReset from "./Buttons/PlotReset";
import PlotBins from "./Buttons/PlotBins";

import { useDimensionsTracker } from "@/hooks/useDimensionsTracker";
import { LogFieldsResponseProps, LogProps } from "@/types/evals/logs";
import { drawBorders, drawBarChart, drawLineChart, drawScatterPlot, drawHistogram, checkLogScalability } from "@/utils/evals/plot";

import PlotAxis from "./Buttons/PlotAxis";
import { ItemType, TileProps } from "@/types/evals/grid";

const LogsPlot = ({ interactive, logs, fields, item, updateItem }: {
    interactive: boolean,
    logs: LogProps[] | undefined,
    fields: LogFieldsResponseProps,
    item: TileProps,
    updateItem: (item: TileProps, attrName: ItemType) => (newValue: string | undefined) => void
}) => {
    // Initialize refs and container dimensions
    let svgRef = useRef(null);
    let containerRef = useRef(null);
    const dimensions = useDimensionsTracker(svgRef); // Dynamic resizing
    const margins = { top: 35, right: 100, bottom: 65, left: 60 } // Margin on the sides
    const axisPadding = 20; // Extra padding between axes borders and plot borders
    const placeholderTextRef = useRef(null);

    // Plot settings
    let plotType = item.plot_type;
    plotType = plotType ? plotType : "Scatter Plot";    

    let metric = item.metric ? item.metric : "mean";

    let binCount = item.bin_count ? parseFloat(item.bin_count) : 1;
    let [binCounts, setBinCounts] = useState([1])
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

    // Draw plot
    useEffect(() => {
        // Initialize SVG container
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
                d3.select(placeholderTextRef.current).text("");
                const adjustedScaleX = checkLogScalability(logs, xTable, selectedXAxisProperty, scaleX, updateItem(item, "plot_scale_x"), setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, yTable,selectedYAxisProperty, scaleY, updateItem(item, "plot_scale_y"), setLogScaleYEnabled)
                drawLineChart(
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
                d3.select(placeholderTextRef.current)
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
                d3.select(placeholderTextRef.current).text("");
                drawBarChart(
                    svg,
                    "linear",
                    "linear",
                    dimensions,
                    margins,
                    axisPadding,
                    selectedXAxisProperty,
                    selectedYAxisProperty,
                    metric,
                    xTable,
                    yTable,
                    logs,
                    fields
                );
            } else {
                d3.select(placeholderTextRef.current)
                .attr("stroke", "black") 
                .attr("stroke-width", 0.1)
                .attr("fill", "gray")
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .text("Select a property to plot and a reduction metric");    
            }
        } 
        
        else if (plotType === "Histogram") {
            if (logs && selectedXAxisProperty) {
                d3.select(placeholderTextRef.current).text("");    
                drawHistogram(
                    svg, 
                    "linear",
                    "linear",
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    binCount,
                    setBinCounts,
                    xTable,
                    logs, 
                    fields
                )
            } else {
                d3.select(placeholderTextRef.current)
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
                d3.select(placeholderTextRef.current).text("");
                const adjustedScaleX = checkLogScalability(logs, xTable, selectedXAxisProperty, scaleX, updateItem(item, "plot_scale_x"), setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, yTable, selectedYAxisProperty, scaleY, updateItem(item, "plot_scale_y"), setLogScaleYEnabled)
                drawScatterPlot(
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
                d3.select(placeholderTextRef.current)
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
        metric,
        binCount,
        showRegression
    ]);

    return (
        <div className="flex w-full h-full bg-background rounded-md relative my-2 LogsPlot" ref={containerRef}>

            {/* Axes and type */}
            <div className="absolute bottom-6 right-1 z-10">
                <PlotAxis
                    interactive={interactive}
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
            {selectedXAxisProperty && selectedYAxisProperty &&
                <>
                    <div className="absolute top-12 right-3 z-10 PlotReset">
                        <PlotReset
                            svgRef={svgRef}
                            setSelectedXAxisProperty={updateItem(item, "x_axis")}
                            setSelectedYAxisProperty={updateItem(item, "y_axis")}
                            setGroupByProperty={updateItem(item, "plot_group_by")}
                        />
                    </div>
                    {plotType === "Histogram"
                        ?   <div className="absolute top-24 right-3 z-10 PlotBins">
                                <PlotBins binCount={binCount} binCounts={binCounts} setBinCount={updateItem(item, "bin_count")}/>
                            </div>
                        :   plotType != "Bar Chart"
                            ?   <div className="absolute top-24 right-3 z-10 PlotGroupBy">
                                    <PlotGroupBy fields={fields} groupBy={groupByProperty} setGroupBy={updateItem(item, "plot_group_by")} logs={logs}/>
                                </div>
                            :   null
                    }
                    {!["Histogram", "Bar Chart"].includes(plotType) &&
                        <div className="absolute top-36 right-3 z-10 PlotScale">
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
                        </div>
                    }
                    {plotType === "Scatter Plot" && 
                        <div className="absolute top-48 right-3 z-10 PlotRegressioncale">
                            <PlotRegression 
                                showRegression={showRegression} 
                                setShowRegression={updateItem(item, "regression_line")}
                            />
                        </div>
                    }
                </>
            }

            {/* Chart */}
            <svg ref={svgRef} className="flex w-full h-full absolute z-0">
                <defs>
                    <clipPath id="clip">
                        <rect id={"clip-rect"} x={margins.left} y={margins.top} width={dimensions.width - margins.left - margins.right} height={dimensions.height - margins.top - margins.bottom}/>
                    </clipPath>
                </defs>
                <g className="plotData" clipPath="url(#clip)"/>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="placeholderText" ref={placeholderTextRef} />
                <line className="bottomLine" />
                <line className="leftLine" />
                <line className="topLine" />
                <g className="xAxis" />
                <g className="yAxis" />
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
                className="plotTooltip absolute py-4 px-6 z-10 shadow-md rounded-lg bg-white grid grid-cols-2 gap-2 overflow-hidden max-w-[500px] max-h-[300px]"
            />
            <div
                style={{ opacity: 0 }}
                className="groupingKey absolute bottom-20 right-2 z-10 py-2 px-3 flex flex-col gap-1 overflow-auto w-[100px] h-[150px] rounded-md border-2 border-muted"
            />
        </div>
    );
};

export default LogsPlot;
