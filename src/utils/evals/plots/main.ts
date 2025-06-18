"use client";

import * as d3 from "d3";
import { LogProps, LogFieldsResponseProps } from "@/types/evals/logs";
import { drawLineChart } from "./plot-line";
import { drawScatterPlot } from "./plot-scatter";
import { drawHistogram } from "./plot-histogram";
import { drawBarChart } from "./plot-bar";
import { drawBorders } from "./canvas";
import { checkLogScalability } from "./axes";
import { clearCanvas } from "./canvas";
import { clearFixedTooltip } from "./tooltip";
import { PlotActions } from "@/contexts/hooks/tile/usePlotTile";
import { PlotTile } from "@/contexts/slices/selectors/plotTile";

/**
 * Main function orchestrating the drawing of different plot types (Scatter, Bar, Histogram, Line) within a specified SVG container.
 * It updates SVG and clip path dimensions, draws borders, determines necessary table context, checks for log scale validity,
 * clears placeholder text or shows sampling messages, and delegates the actual plotting to specific functions
 * (drawScatterPlot, drawBarChart, drawHistogram, drawLineChart) based on the provided plotType.
 * Handles clearing the canvas and tooltips if required data/properties are missing.
 *
 * @param {d3.Selection<SVGSVGElement | null, unknown, null, undefined>} svg - D3 selection of the main SVG element.
 * @param {d3.Selection<HTMLDivElement | null, unknown, null, undefined>} container - D3 selection of the container div (used for tooltips).
 * @param {d3.Selection<HTMLDivElement | null, unknown, null, undefined>} settings - D3 selection of the element for displaying settings/grouping keys.
 * @param {d3.Selection<SVGTextElement, unknown, null, undefined>} placeholder - D3 selection of the text element used for placeholder messages.
 * @param {{width: number, height: number}} dimensions - Object containing the target width and height for the SVG.
 * @param {{[key: string]: number}} margins - Object defining the top, right, bottom, and left margins for the plot area.
 * @param {number} axisPadding - Padding applied inside the axis ranges.
 * @param {string} plotType - The type of plot to render ('Scatter Plot', 'Bar Chart', 'Histogram', 'Line Chart').
 * @param {LogProps[]} logs - The array of log data objects to plot.
 * @param {LogFieldsResponseProps} fields - Metadata describing the fields in the logs.
 * @param {string | undefined} selectedXAxisProperty - The name of the field selected for the X-axis (e.g., 'table1.value').
 * @param {string | undefined} selectedYAxisProperty - The name of the field selected for the Y-axis (e.g., 'table1.result'). Required for Scatter, Bar, Line.
 * @param {string | undefined} groupByProperty - The name of the field used for grouping data.
 * @param {string | undefined} aggregateProperty - The name of the aggregate property (used for tooltip display).
 * @param {string} scaleX - The desired scale type for the X-axis ('linear' or 'log'). Used for Scatter, Line.
 * @param {string} scaleY - The desired scale type for the Y-axis ('linear' or 'log'). Used for Scatter, Line.
 * @param {string} metric - (Bar Chart specific) The aggregation metric applied to the Y-axis (e.g., 'mean', 'sum').
 * @param {string | undefined} sortBars - (Bar Chart specific) Sorting order for bars ('asc', 'desc', 'unsorted').
 * @param {number} binCount - (Histogram specific) The number of bins to use.
 * @param {number[]} binCounts - (Histogram specific) Array storing [minPossibleBins, maxPossibleBins].
 * @param {(binCounts: number[]) => void} setBinCounts - (Histogram specific) State setter for the bin count range.
 * @param {string} showRegression - (Scatter Plot specific) Flag ('true'/'false') to control the display of regression lines.
 * @param {any} zoomRef - A React ref object to store and manage the D3 zoom state across re-renders.
 * @param {boolean} interactive - Flag indicating whether interactive features like zoom/pan and tooltips should be enabled.
 * @param {boolean} zoomEnabled - Flag indicating whether zoom/pan is specifically enabled for this plot.
 * @param {(logs: LogProps[], fields: LogFieldsResponseProps, table: string, axisProperty: string, scale: string, setScale: (scale: string) => void, setLogScaleEnabled: (enabled: boolean) => void) => string} checkLogScalability - Function to check if data is suitable for log scale and adjust if needed.
 * @param {(svgRef: React.RefObject<SVGSVGElement>, containerRef: React.RefObject<HTMLDivElement>) => void} clearCanvas - Function to clear the SVG canvas.
 * @param {(settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>, setIsTooltipMinimized: React.Dispatch<React.SetStateAction<boolean>>) => void} clearFixedTooltip - Function to clear/hide the fixed tooltip.
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setIsTooltipMinimized - State setter for the fixed tooltip's minimized state.
 * @param {React.RefObject<SVGSVGElement>} svgRef - React ref for the SVG element (used by clearCanvas).
 * @param {React.RefObject<HTMLDivElement>} containerRef - React ref for the container element (used by clearCanvas).
 * @param {(enabled: boolean) => void} setLogScaleXEnabled - State setter to enable/disable the log scale option for the X-axis.
 * @param {(enabled: boolean) => void} setLogScaleYEnabled - State setter to enable/disable the log scale option for the Y-axis.
 * @param {{ setPlotScaleX?: (scale: string) => void; setPlotScaleY?: (scale: string) => void; setBinCount?: (count: string) => void; }} [plotTileActions] - Optional object containing state update functions for the plot tile (e.g., setting scale, bin count).
 * @param {{ plot_group_by_colors?: string | null; }} [plotTileState] - Optional object containing UI states for the plot tile (e.g., grouping color scheme).
 * @returns {void}
 */
export const drawPlot = (
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    placeholder: d3.Selection<SVGTextElement, unknown, null, undefined>,
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    axisPadding: number,
    plotType: string,
    logs: LogProps[],
    fields: LogFieldsResponseProps,
    selectedXAxisProperty: string | undefined,
    selectedYAxisProperty: string | undefined,
    groupByProperty: string | undefined,
    aggregateProperty: string | undefined,
    scaleX: string,
    scaleY: string,
    metric: string,
    sortBars: string | undefined,
    binCount: number,
    binCounts: number[],
    setBinCounts: (binCounts: number[]) => void,
    showRegression: string,
    zoomRef: any,
    interactive: boolean,
    zoomEnabled: boolean,
    setIsTooltipMinimized: React.Dispatch<React.SetStateAction<boolean>>,
    svgRef: React.RefObject<SVGSVGElement>,
    containerRef: React.RefObject<HTMLDivElement>,
    setLogScaleXEnabled: (enabled: boolean) => void,
    setLogScaleYEnabled: (enabled: boolean) => void,
    plotTileActions?: PlotActions | null,
    plotTileState?: PlotTile | null
) => {
        // Update svg dimensions
        svg
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .attr("viewBox", [0, 0, dimensions.width, dimensions.height]);

        // Update clipbox dimensions
        svg.select("#clip-rect")
            .attr("x", margins.left)
            .attr("y", margins.top)
            .attr("width", dimensions.width - margins.left - margins.right)
            .attr("height", dimensions.height - margins.top - margins.bottom);

        // Draw plot borders
        drawBorders(svg, dimensions.height, dimensions.width, margins);

        const xTable = selectedXAxisProperty?.split(".")[0] || "";
        const yTable = selectedYAxisProperty?.split(".")[0] || "";

        const groupByColors = plotTileState?.plot_group_by_colors ?? undefined;

        // Draw selected plot type
        if (plotType === "Line Chart") {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                if (logs.length >= 1000) placeholder.text("Too many data points. Using a random sample.").attr("text-anchor", "start").attr("x", `${margins.left + 10}px`).attr("y", `${dimensions.height - margins.bottom - 10}px`).attr("font-size", "10px"); else placeholder.text("");
                const setScaleX = plotTileActions?.setPlotScaleX;
                const setScaleY = plotTileActions?.setPlotScaleY;
                if (!setScaleX || !setScaleY) {
                    console.error("Required plotTileActions (setPlotScaleX, setPlotScaleY) not provided for Line Chart scale check.");
                    return;
                }
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, setScaleX, setLogScaleXEnabled);
                const adjustedScaleY = checkLogScalability(logs, fields, yTable,selectedYAxisProperty, scaleY, setScaleY, setLogScaleYEnabled);
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
                    aggregateProperty,
                    xTable,
                    yTable,
                    logs,
                    fields,
                    zoomRef,
                    groupByColors,
                    interactive,
                    zoomEnabled
                );
            } else {
                clearCanvas(svgRef, containerRef);
                clearFixedTooltip(settings, setIsTooltipMinimized);
            }
        }

        else if (plotType === "Bar Chart") {
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                if (logs.length >= 1000) placeholder.text("Too many data points. Using a random sample.").attr("text-anchor", "start").attr("x", `${margins.left + 10}px`).attr("y", `${dimensions.height - margins.bottom - 10}px`).attr("font-size", "10px"); else placeholder.text("");
                drawBarChart(
                    container,
                    svg,
                    settings,
                    "linear", // Bar chart uses linear scales typically
                    "linear",
                    dimensions,
                    margins,
                    axisPadding,
                    selectedXAxisProperty,
                    selectedYAxisProperty,
                    groupByProperty,
                    aggregateProperty,
                    metric,
                    sortBars,
                    xTable,
                    yTable,
                    logs,
                    fields,
                    zoomRef,
                    groupByColors,
                    interactive
                );
            } else {
                clearCanvas(svgRef, containerRef);
                clearFixedTooltip(settings, setIsTooltipMinimized);
            }
        }

        else if (plotType === "Histogram") {
            if (logs && selectedXAxisProperty) {
                if (logs.length >= 1000) placeholder.text("Too many data points. Using a random sample.").attr("text-anchor", "start").attr("x", `${margins.left + 10}px`).attr("y", `${dimensions.height - margins.bottom - 10}px`).attr("font-size", "10px"); else placeholder.text("");
                const setBinCountAction = plotTileActions?.setBinCount;
                if (!setBinCountAction) {
                    console.error("Required plotTileActions (setBinCount) not provided for Histogram.");
                    return;
                }
                drawHistogram(
                    container,
                    svg,
                    settings,
                    "linear", // Histogram uses linear scales typically
                    "linear",
                    dimensions,
                    margins,
                    axisPadding,
                    selectedXAxisProperty,
                    groupByProperty,
                    aggregateProperty,
                    binCount,
                    setBinCountAction,
                    binCounts,
                    setBinCounts,
                    xTable,
                    logs,
                    fields,
                    groupByColors
                );
            } else {
                clearCanvas(svgRef, containerRef);
                clearFixedTooltip(settings, setIsTooltipMinimized);
            }
        }

        else { // Default to Scatter Plot
            if (logs && selectedXAxisProperty && selectedYAxisProperty) {
                if (logs.length >= 1000) placeholder.text("Too many data points. Using a random sample.").attr("text-anchor", "start").attr("x", `${margins.left + 10}px`).attr("y", `${dimensions.height - margins.bottom - 10}px`).attr("font-size", "10px"); else placeholder.text("");
                const setScaleX = plotTileActions?.setPlotScaleX;
                const setScaleY = plotTileActions?.setPlotScaleY;
                if (!setScaleX || !setScaleY) {
                    console.error("Required plotTileActions (setPlotScaleX, setPlotScaleY) not provided for Scatter Plot scale check.");
                    return;
                }
                const adjustedScaleX = checkLogScalability(logs, fields, xTable, selectedXAxisProperty, scaleX, setScaleX, setLogScaleXEnabled);
                const adjustedScaleY = checkLogScalability(logs, fields, yTable, selectedYAxisProperty, scaleY, setScaleY, setLogScaleYEnabled);
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
                    aggregateProperty,
                    showRegression,
                    xTable,
                    yTable,
                    logs,
                    fields,
                    containerRef,
                    zoomRef,
                    groupByColors,
                    interactive,
                    zoomEnabled
                );
            } else {
                clearCanvas(svgRef, containerRef);
                clearFixedTooltip(settings, setIsTooltipMinimized);
            }
        }
};