"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import * as d3 from "d3";

import PlotType from "./Buttons/PlotType";
import PlotScale from "./Buttons/PlotScale";
import PlotGroupBy from "./Buttons/PlotGroupBy";
import PlotReset from "./Buttons/PlotReset";

import { useDimensionsTracker } from "@/hooks/useDimensionsTracker";
import { LogProps } from "@/types/evals/logs";
import { drawBarChart, drawLineChart, drawScatterPlot, filterLogsForPlotting } from "@/utils/evals/plot";

import PlotAxis from "./Buttons/PlotAxis";
import InfoCard from "./InfoCard";
import { useQueryState } from "nuqs";

const LogsPlot = ({ logs }: {
    logs: LogProps[] | undefined,
}) => {
    // Initialize refs and container dimensions
    let svgRef = useRef(null);
    let containerRef = useRef(null);
    const dimensions = useDimensionsTracker(svgRef); // Dynamic resizing
    const margins = [30, 100, 65, 50]; // Margin on the sides (top, right, bottom, left)
    const axisPadding = 40; // Extra padding for sideways spacing
    const placeholderTextRef = useRef(null);

    // Define axis ranges
    const filteredLogs = useMemo(() => logs ? filterLogsForPlotting(logs): [], [logs]);
    const axisProperties = useMemo(() => Array.from(new Set(filteredLogs.map((log) => log.entries).flatMap((entry) => Object.keys(entry)))), [logs]);

    // Track hover card state
    const [infoCardData, setInfoCardData] = useState<LogProps | null>(null);
    const [infoCardPosition, setInfoCardPosition] = useState({x: 0, y:0});

    // Plot settings (TO BE MOVED OUTSIDE OF PLOT)
    let [plotType, setPlotType] = useQueryState("plot_type");
    let [scale, setScale] = useQueryState("plot_scale");
    plotType = plotType ? plotType : "Scatter Plot";
    scale = scale ? scale : "log";

    // Axes and grouping selected on the plot
    const [selectedXAxisProperty, setSelectedXAxisProperty] = useQueryState("x_axis");
    const [selectedYAxisProperty, setSelectedYAxisProperty] = useQueryState("y_axis");
    const [groupByProperty, setGroupByProperty] = useQueryState("plot_group_by");

    // Draw plot
    useEffect (() => {
        // Initialize SVG container
        const svg = d3.select(svgRef.current)
            .attr("width", dimensions.width)
            .attr("height", dimensions.height)
            .attr("viewBox", [0, 0, dimensions.width, dimensions.height]);
        
        // Draw selected plot type        
        if (plotType === "Line Chart") {
            drawLineChart(svg, scale, dimensions, margins, axisPadding, selectedXAxisProperty, selectedYAxisProperty, groupByProperty, filteredLogs, axisProperties);
        } else if (plotType  === "Bar Chart") {
            drawBarChart(svg, scale, dimensions, margins, axisPadding, selectedXAxisProperty, selectedYAxisProperty, groupByProperty, filteredLogs, axisProperties);
        } else {
            drawScatterPlot(svg, logs, scale, setInfoCardData, setInfoCardPosition, dimensions, margins, axisPadding, selectedXAxisProperty, selectedYAxisProperty, groupByProperty, filteredLogs, axisProperties);
        }
                
        // Add placeholder text if either properties are not selected
        if (!selectedXAxisProperty || !selectedYAxisProperty) {
            d3.select(placeholderTextRef.current)
                .attr("stroke", "black") 
                .attr("stroke-width", 0.1)
                .attr("fill", "gray")
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .text("Select two numeric properties to plot");
        } else {
            d3.select(placeholderTextRef.current)
                .text("");
        }
    }, [
        logs,
        dimensions,
        scale,
        selectedXAxisProperty,
        selectedXAxisProperty,
        plotType,
        groupByProperty,
    ]);

    return (
    <div  className="flex w-full h-full bg-background rounded-md relative py-3 LogsPlot" ref={containerRef}>

        {/* Axes and type */}
        <div className="absolute bottom-4 right-1 z-10">
            <PlotAxis properties={axisProperties} setAxisProperty={setSelectedXAxisProperty} axis="X" axisProperty={selectedXAxisProperty} plotType={plotType}/>
        </div>
        <div className="absolute top-0.5 left-1 z-10">
            <PlotAxis properties={axisProperties} setAxisProperty={setSelectedYAxisProperty} axis="Y" axisProperty={selectedYAxisProperty} plotType={plotType}/>
        </div>
        <div className="absolute top-0.5 right-1 z-10">
            <PlotType plotType={plotType} setPlotType={setPlotType}/>
        </div>
        
        {/* Customization */}
        {selectedXAxisProperty && selectedYAxisProperty &&
        <>
            <div className="absolute top-12 right-3 z-10 PlotReset">
                <PlotReset setSelectedXAxisProperty={setSelectedXAxisProperty} setSelectedYAxisProperty={setSelectedYAxisProperty} setGroupByProperty={setGroupByProperty}/>
            </div>
            <div className="absolute top-24 right-3 z-10 PlotGroupBy">
                <PlotGroupBy properties={axisProperties} groupBy={groupByProperty} setGroupBy={setGroupByProperty}/>
            </div>
            <div className="absolute top-36 right-3 z-10 PlotScale">
                <PlotScale scale={scale} setScale={setScale}/>
            </div>
        </>
        }
        <svg ref={svgRef} className="flex w-full h-full absolute z-0">
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="placeholderText" ref={placeholderTextRef}/>
            <line className="bottomLine"/>
            <line className="leftLine"/>
            <line className="topLine"/>
            <g className="xAxis"/>
            <g className="yAxis"/>
        </svg>
        {infoCardData && 
            <InfoCard 
                data={infoCardData} 
                position={infoCardPosition} 
                dimensions={dimensions}
                selectedXAxisProperty={selectedXAxisProperty!} 
                selectedYAxisProperty={selectedYAxisProperty!}
                margins={margins}
            />
        }
    </div>
    );
};

export default LogsPlot;
