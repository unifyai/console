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
import { useQueryState, parseAsFloat } from "nuqs";
import PlotAggregate from "./Buttons/PlotAggregate";

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
    const placeholderTextRef = useRef(null);

    // Plot settings
    let [plotType, setPlotType] = useQueryState("plot_type", { shallow: false });
    let [scale, setScale] = useQueryState("plot_scale");
    let [logScaleEnabled, setLogScaleEnabled] = useState(true);
    let [isAggregated, setIsAggregated] = useQueryState("aggregated_data")
    let [binCount, setBinCount] = useQueryState("bin_count", parseAsFloat.withDefault(1))
    let [binCounts, setBinCounts] = useState([1])
    const [showRegression, setShowRegression] = useState("false");
    plotType = plotType ? plotType : "Scatter Plot";
    scale = scale ? scale : "linear";

    // Axes and grouping selected on the plot
    const [selectedXAxisProperty, setSelectedXAxisProperty] = useQueryState("x_axis", { shallow: false });
    const [selectedYAxisProperty, setSelectedYAxisProperty] = useQueryState("y_axis", { shallow: false });
    const [groupByProperty, setGroupByProperty] = useQueryState("plot_group_by", { shallow: false });

    // Draw plot
    useEffect (() => {
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
        
        // Draw selected plot type 
        if (plotType === "Line Chart") {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                d3.select(placeholderTextRef.current).text("");
                checkLogScalability(logs, selectedXAxisProperty, selectedYAxisProperty, scale, setScale, setLogScaleEnabled)
                drawLineChart(
                    svg, 
                    scale, 
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    selectedYAxisProperty, 
                    groupByProperty || undefined,
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

        else if (plotType  === "Bar Chart") {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                d3.select(placeholderTextRef.current).text("");
                checkLogScalability(logs, selectedXAxisProperty, selectedYAxisProperty, scale, setScale, setLogScaleEnabled)
                drawBarChart(
                    svg, 
                    scale, 
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    selectedYAxisProperty, 
                    isAggregated || undefined,
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
                    scale, 
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    binCount,
                    setBinCounts,
                    logs, 
                    fields,
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
                checkLogScalability(logs, selectedXAxisProperty, selectedYAxisProperty, scale, setScale, setLogScaleEnabled)
                drawScatterPlot(
                    svg, 
                    scale, 
                    dimensions, 
                    margins, 
                    axisPadding, 
                    selectedXAxisProperty, 
                    selectedYAxisProperty, 
                    groupByProperty || undefined,
                    showRegression,
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
        scale,
        selectedXAxisProperty,
        selectedYAxisProperty,
        plotType,
        groupByProperty,
        isAggregated,
        binCount,
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
            />
        </div>
        {plotType != "Histogram" &&
            <div className="absolute top-0.5 left-1 z-10">
                <PlotAxis fields={fields} setAxisProperty={setSelectedYAxisProperty} axis="Y" axisProperty={selectedYAxisProperty} plotType={plotType} logs={logs}/>
            </div>
        }
        <div className="absolute top-0.5 right-1 z-10">
            <PlotType plotType={plotType} setPlotType={setPlotType} fields={fields} selectedXAxisProperty={selectedXAxisProperty} setSelectedXAxisProperty={setSelectedXAxisProperty} selectedYAxisProperty={selectedYAxisProperty} setSelectedYAxisProperty={setSelectedYAxisProperty}/>
        </div>
        
        {/* Customization */}
        {selectedXAxisProperty && selectedYAxisProperty &&
        <>
            <div className="absolute top-12 right-3 z-10 PlotReset">
                <PlotReset setSelectedXAxisProperty={setSelectedXAxisProperty} setSelectedYAxisProperty={setSelectedYAxisProperty} setGroupByProperty={setGroupByProperty}/>
            </div>
            {plotType === "Bar Chart" 
                ?   <div className="absolute top-24 right-3 z-10 PlotAggregated">
                        <PlotAggregate isAggregated={isAggregated} setIsAggregated={setIsAggregated}/>
                    </div>
                :   plotType === "Histogram"
                    ?   <div className="absolute top-24 right-3 z-10 PlotBins">
                            <PlotBins binCount={binCount} binCounts={binCounts} setBinCount={setBinCount} />
                        </div>
                    :   <div className="absolute top-24 right-3 z-10 PlotGroupBy">
                            <PlotGroupBy fields={fields} groupBy={groupByProperty} setGroupBy={setGroupByProperty}/>
                        </div>
            }
            {plotType != "Histogram" &&
                <div className="absolute top-36 right-3 z-10 PlotScale">
                    <PlotScale scale={scale} setScale={setScale} logScaleEnabled={logScaleEnabled}/>
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
            <g className="plotData" clipPath="url(#clip)"/>
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="placeholderText" ref={placeholderTextRef}/>
            <line className="bottomLine"/>
            <line className="leftLine"/>
            <line className="topLine"/>
            <g className="xAxis"/>
            <g className="yAxis"/>
        </svg>
        <div
            style={{
                position: "fixed",
                minWidth: "160px",
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
            style={{opacity: 0}} 
            className="groupingKey absolute bottom-20 right-2 z-10 py-2 px-3 flex flex-col gap-1 overflow-auto w-[100px] h-[150px] rounded-md border-2 border-muted"
        />
    </div>
    );
};

export default LogsPlot;