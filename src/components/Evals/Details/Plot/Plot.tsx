"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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
import { useQueryState, parseAsFloat, parseAsString } from "nuqs";

const LogsPlot = ({ logs, fields}: {
    logs: LogProps[] | undefined,
    fields: LogFieldsResponseProps
}) => {
    // Initialize refs and container dimensions
    let svgRef = useRef(null);
    let containerRef = useRef(null);
    const dimensions = useDimensionsTracker(svgRef); // Dynamic resizing
    const margins = {top: 30, right: 100, bottom: 75, left: 60} // Margin on the sides
    const axisPadding = 20; // Extra padding between axes borders and plot borders

    // Plot settings
    let [plotType, setPlotType] = useQueryState("plot_type", { shallow: false });
    let [metric, setMetric] = useQueryState("plot_metric", {shallow: false, defaultValue: "mean"})
    let [binCount, setBinCount] = useQueryState("bin_count", parseAsString.withDefault("10"))
    let [binCounts, setBinCounts] = useState([1, 100])
    const [showRegression, setShowRegression] = useState("false");
    plotType = plotType ? plotType : "Scatter Plot";
    let [scaleX, setScaleX] = useQueryState("plot_scale_x");
    let [scaleY, setScaleY] = useQueryState("plot_scale_y");
    let [logScaleXEnabled, setLogScaleXEnabled] = useState(true);
    let [logScaleYEnabled, setLogScaleYEnabled] = useState(true);
    scaleX = scaleX ? scaleX : "linear";
    scaleY = scaleY ? scaleY : "linear";

    // Axes and grouping selected on the plot
    const [selectedXAxisProperty, setSelectedXAxisProperty] = useQueryState("x_axis", { shallow: false });
    const [selectedYAxisProperty, setSelectedYAxisProperty] = useQueryState("y_axis", { shallow: false });
    const [groupByProperty, setGroupByProperty] = useQueryState("plot_group_by", { shallow: false });

    // Track zoom level and reset when changing plot type or axes
    let zoomRef = useRef(d3.zoomIdentity);
    useEffect(() => {
        zoomRef.current = d3.zoomIdentity
    }, [selectedXAxisProperty, selectedYAxisProperty, plotType])
    
    // Draw plot
    useEffect (() => {
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
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, setScaleX, setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, fields, yTable, selectedYAxisProperty, scaleY, setScaleY, setLogScaleYEnabled)
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
                    groupByProperty || undefined,
                    xTable,
                    yTable,
                    logs, 
                    fields,
                    zoomRef
                );
            } else {
                placeholder
                .attr("stroke", "black") 
                .attr("stroke-width", 0.1)
                .attr("fill", "gray")
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .text("Select two numeric properties to plot");
            }
        }   

        else if (plotType  === "Bar Chart") {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                placeholder.text("");
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, setScaleX, setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, fields, yTable, selectedYAxisProperty, scaleY, setScaleY, setLogScaleYEnabled)
                drawBarChart(
                    container,
                    svg, 
                    adjustedScaleX,
                    adjustedScaleY,
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    selectedYAxisProperty, 
                    metric as string,
                    "unsorted",
                    xTable,
                    yTable,
                    logs, 
                    fields,
                    zoomRef
                );
            } else {
                placeholder
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
                placeholder.text("");
                drawHistogram(
                    container,
                    svg, 
                    scaleX,
                    scaleY,
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    +binCount,
                    setBinCount,
                    binCounts,
                    setBinCounts,
                    xTable,
                    logs,
                    fields,
                )
            } else {
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
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, setScaleX, setLogScaleXEnabled)
                const adjustedScaleY = checkLogScalability(logs, fields, yTable, selectedYAxisProperty, scaleY, setScaleY, setLogScaleYEnabled)
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
                    groupByProperty || undefined,
                    showRegression,
                    xTable,
                    yTable,
                    logs, 
                    fields,
                    zoomRef
                );
            } else {
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
        metric,
        binCount,
        binCounts,
        showRegression
    ]);

    return (
    <div  className="flex w-full h-full bg-background rounded-md relative py-2 LogsPlot" ref={containerRef}>

        {/* Axes and type */}
        <div className="absolute bottom-6 right-1 z-10">
            <PlotAxis 
                fields={fields} 
                setAxisProperty={setSelectedXAxisProperty} 
                axis="X" 
                axisProperty={selectedXAxisProperty} 
                plotType={plotType}
                logs={logs}
                setMetric={setMetric}
                metric={metric}
            />
        </div>
        {plotType != "Histogram" &&
            <div className="absolute top-0.5 left-1 z-10">
                <PlotAxis metric={metric} setMetric={setMetric} fields={fields} setAxisProperty={setSelectedYAxisProperty} axis="Y" axisProperty={selectedYAxisProperty} plotType={plotType} logs={logs}/>
            </div>
        }
        <div className="absolute top-0.5 right-1 z-10">
            <PlotType plotType={plotType} setPlotType={setPlotType} fields={fields} selectedXAxisProperty={selectedXAxisProperty} setSelectedXAxisProperty={setSelectedXAxisProperty} selectedYAxisProperty={selectedYAxisProperty} setSelectedYAxisProperty={setSelectedYAxisProperty}/>
        </div>
        
        {/* Customization */}
        {selectedXAxisProperty && selectedYAxisProperty &&
        <>
            <div className="absolute top-12 right-3 z-10 PlotReset">
                <PlotReset svgRef={svgRef} setSelectedXAxisProperty={setSelectedXAxisProperty} setSelectedYAxisProperty={setSelectedYAxisProperty} setGroupByProperty={setGroupByProperty}/>
            </div>
            {plotType === "Histogram"
                    ?   <div className="absolute top-24 right-3 z-10 PlotBins">
                            <PlotBins binCount={+binCount} binCounts={binCounts} setBinCount={setBinCount} />
                        </div>
                    :   plotType != "Bar Chart"
                        ?   <div className="absolute top-24 right-3 z-10 PlotGroupBy">
                                <PlotGroupBy logs={logs} fields={fields} groupBy={groupByProperty} setGroupBy={setGroupByProperty}/>
                            </div>
                        :   null
            }
            {!["Histogram", "Bar Chart"].includes(plotType) &&
                <div className="absolute top-36 right-3 z-10 PlotScale">
                    <PlotScale scaleX={scaleX} scaleY={scaleY} setScaleX={setScaleX} setScaleY={setScaleY} logScaleXEnabled={logScaleXEnabled} logScaleYEnabled={logScaleYEnabled} selectedXAxisProperty={selectedXAxisProperty} fields={fields}/>
                </div>
            }
            {plotType === "Scatter Plot" && 
                <div className="absolute top-48 right-3 z-10 PlotRegressioncale">
                    <PlotRegression 
                        showRegression={showRegression} 
                        setShowRegression={setShowRegression}
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
            <rect className="zoom-layer"/>
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
            className="groupingKey absolute bottom-20 right-2 z-10 py-2 px-3 flex flex-col gap-1 overflow-auto w-[100px] h-[150px] rounded-md border-2 border-muted"
        />
    </div>
    );
};

export default LogsPlot;