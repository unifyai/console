"use client";

import * as d3 from "d3";
import { LogProps, LogFieldsResponseProps } from "@/types/interfaces/logs";
import { formatNumber } from "@/utils/interfaces/formatNumber";
import { formatTimeTypeValue } from "../format";
import { getValue } from "./data";

/**
 * Calculates a visually appealing ("nice") step increment for axis ticks.
 * It aims for increments that are multiples of 1, 2, 2.5, 5, or 10 times a power of 10.
 *
 * @param {number} min - The minimum value of the data range.
 * @param {number} max - The maximum value of the data range.
 * @param {number} [count=10] - The approximate desired number of ticks.
 * @returns {number} The calculated nice step increment.
*/
function niceIncrement(min: number, max: number, count = 10) {
    const rawStep = (max - min) / count;
    const base = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const factors = [1, 2, 2.5, 5, 10];
    const bestStep = factors.map(f => base * f).reduce((prev, curr) => Math.abs(curr - rawStep) < Math.abs(prev - rawStep) ? curr : prev);
    return bestStep;
  }

/**
 * Generates an array of tick values for an axis within a given range.
 * Supports both linear and logarithmic scales, including handling log scales
 * for ranges that are entirely negative by using their absolute values.
 * Ensures the min and max values are included in the ticks.
 *
 * @param {number} min - The minimum value of the domain.
 * @param {number} max - The maximum value of the domain.
 * @param {number} [count=10] - The approximate desired number of ticks.
 * @param {boolean} [isLogScale=false] - Whether the scale is logarithmic.
 * @returns {number[]} An array of calculated tick values.
*/
export function generateTicks(min: number, max: number, count = 10, isLogScale = false) {
  
    // Handle log scale on negative range by computing abs bounds and using a log scale, if applicable
    const absMin = Math.min(Math.abs(min), Math.abs(max))
    const absMax = Math.max(Math.abs(min), Math.abs(max))
    const minValue = isLogScale ? Math.log10(absMin) : min;
    const maxValue = isLogScale ? Math.log10(absMax) : max;
  
    // Increment tick values
    const step = niceIncrement(minValue, maxValue, count);
    const start = Math.floor(minValue / step) * step;
    const end = Math.ceil(maxValue / step) * step;
    let ticks = [];
    for (let tick = start; tick <= end + step * 0.5; tick += step) {
      ticks.push(tick);
    }
  
    // Adjust for log scale, if applicable.
    if (isLogScale) ticks = ticks.map(t => Math.pow(10, t))
  
    // Remove out of bound ticks and add min / max value to the ticks if not already included.
    // Adjust for log scale with negative range, if applicable
    if (min < 0 && max < 0 && isLogScale) {
      ticks = ticks.filter(t => t >= absMin && t <= absMax)
      if (!ticks.includes(absMin)) ticks.unshift(absMin)
      if (!ticks.includes(absMax)) ticks.push(absMax)
    }
    else {
      ticks = ticks.filter(t => t >= min && t <= max)
      if (!ticks.includes(min)) ticks.unshift(min)
      if (!ticks.includes(max)) ticks.push(max)  
    }

    return ticks;
}

/**
 * Formats a time-based tick value for display on an axis.
 * It attempts to shorten the format based on the previous tick value
 * to avoid redundancy (e.g., omitting the year if it's the same as the previous tick).
 * Handles 'timestamp', 'date', 'time', and 'timedelta' data types.
 *
 * @param {number} currentTickValue - The numeric value of the current tick (e.g., timestamp).
 * @param {number | undefined} previousTickValue - The numeric value of the previous tick, or undefined if it's the first tick.
 * @param {string} dataType - The type of the data being formatted ('timestamp', 'date', 'time', 'timedelta').
 * @returns {string} The formatted tick label string.
*/
function formatTimeTypeTick (currentTickValue: number, previousTickValue: number | undefined, dataType: string) {
    // If no previous value, return the full formatting
    if (!previousTickValue) return formatTimeTypeValue(currentTickValue, dataType)
    
    // Define time formats for each data type and each case
    const timeFormats : {[type: typeof dataType]: {[format: string]:  (date: Date) => string}}= {
        "timestamp": {
            "noYear": d3.timeFormat("%m-%d %H:%M:%S.%L"),
            "noMonth": d3.timeFormat("%d %H:%M:%S.%L"),
            "noDay": d3.timeFormat("%H:%M:%S.%L"),
            "noHour": d3.timeFormat("%M:%S.%L"),
            "noMinute": d3.timeFormat("%S.%L"),
            "noSecond": d3.timeFormat("%L")
        },
        "date": {
            "noYear": d3.timeFormat("%m-%d"),
            "noMonth": d3.timeFormat("%d")
        },
        "time": {
            "noHour": d3.timeFormat("%M:%S"),
            "noMinute": d3.timeFormat("%S")
        },
        "timedelta": {
            "noDay": d3.timeFormat("%H:%M:%S"),
            "noHour": d3.timeFormat("%M:%S"),
            "noMinute": d3.timeFormat("%S")
        }
    }

    // Split current and previous ticks into their respective time components and incrementally compare the corresponding components.
    // Exclude shared components from the returned tick format or return the full format if the first component is different.
    const [previousTickFormat, currentTickFormat] = [previousTickValue, currentTickValue].map(tick => formatTimeTypeValue(tick, dataType)) 
    let [previousParts, currentParts] : [string[], string[]] = [[], []]
    const currentTickDate = new Date(currentTickValue)
    switch (dataType) {
        case "timestamp":
            // Split into [year, month, day, hour, minutes, seconds, milliseconds]
            [previousParts, currentParts] = [previousTickFormat, currentTickFormat].map(tickFormat => 
                tickFormat.split(" ").flatMap((dateOrTime, i) => i === 0 
                    ? dateOrTime.split("-") 
                    : dateOrTime.split(":").flatMap((timePart, i) => i === 2
                        ? timePart.split(".")
                        : timePart
                    )
                )
            )
            let tickFormat : string;
            if (previousParts[0] === currentParts[0]) {
                if (previousParts[1] === currentParts[1]) {
                    if (previousParts[2] === currentParts[2]) {
                        if (previousParts[3] === currentParts[3]) {
                            if (previousParts[4] === currentParts[4]) {
                                if (previousParts[5] === currentParts[5]) {
                                    if (previousParts[6] === currentParts[6]) {
                                        tickFormat = timeFormats["timestamp"]["noSecond"](currentTickDate)
                                    }
                                    // Same second, different millisecond
                                    else {
                                        tickFormat = timeFormats["timestamp"]["noSecond"](currentTickDate)
                                    }
                                }
                                // Same minute, different second
                                else {
                                    tickFormat = timeFormats["timestamp"]["noMinute"](currentTickDate)
                                }
                            }
                            // Same hour, different minute
                            else {
                                tickFormat = timeFormats["timestamp"]["noHour"](currentTickDate)
                            }
                        }
                        // Same day, different hour
                        else {
                            tickFormat = timeFormats["timestamp"]["noDay"](currentTickDate)
                        }
                    }
                    // Same month, different day
                    else {
                        tickFormat = timeFormats["timestamp"]["noMonth"](currentTickDate)
                    }
                }
                // Same year, different month
                else {
                    tickFormat = timeFormats["timestamp"]["noYear"](currentTickDate)
                }
            } 
            // Different year
            else {
                tickFormat = currentTickFormat
            }
            
            // Remove milliseconds if zero
            if (currentParts[6] === "000") tickFormat = tickFormat.split(".")[0]
            return tickFormat
        case "time":
            // Split into [hour, minutes, seconds]
            [previousParts, currentParts] = [previousTickFormat, currentTickFormat].map(tickFormat => tickFormat.split(":"))
            if (previousParts[0] === currentParts[0]) {
                if (previousParts[1] === currentParts[1]) {
                    if (previousParts[2] === currentParts[2]) {
                        const tickFormat = timeFormats["timestamp"]["noMinute"](currentTickDate)
                        return tickFormat
                    }
                    // Same minute, different second
                    else {
                        const tickFormat = timeFormats["timestamp"]["noMinute"](currentTickDate)
                        return tickFormat
                    }
                }
                // Same hour, different minute
                else {
                    const tickFormat = timeFormats["time"]["noHour"](currentTickDate)
                    return tickFormat
                }
            }
            // Different hour
            else {
                return currentTickFormat
            }
        case "date":
            // Split into [year, month, day]
            [previousParts, currentParts] = [previousTickFormat, currentTickFormat].map(tickFormat => tickFormat.split("-"))
            if (previousParts[0] === currentParts[0]) {
                if (previousParts[1] === currentParts[1]) {
                    if (previousParts[2] === currentParts[2]) {
                        const tickFormat = timeFormats["date"]["noMonth"](currentTickDate)
                        return tickFormat
                    }
                    // Same month, different day
                    else {
                        const tickFormat = timeFormats["date"]["noMonth"](currentTickDate)
                        return tickFormat
                    }
                }
                // Same year, different month
                else {
                    const tickFormat = timeFormats["date"]["noYear"](currentTickDate)
                    return tickFormat
                }
            }
            // Different year
            else {
                return currentTickFormat
            }
        case "timedelta":
            // Split into [day, hour, minutes, seconds]
            [previousParts, currentParts] = [previousTickFormat, currentTickFormat].map(tickFormat => 
                tickFormat.split(", ").flatMap((dayOrTime, i) => i === 0 
                    ? dayOrTime 
                    : dayOrTime.split(":")
                )
            )
            if (previousParts[0] === currentParts[0]) {
                if (previousParts[1] === currentParts[1]) {
                    if (previousParts[2] === currentParts[2]) {
                        if (previousParts[3] === currentParts[3]) {
                            const tickFormat = timeFormats["timedelta"]["noMinute"](currentTickDate)
                            return tickFormat
                        }
                        // Same minute, different second
                        else {
                            const tickFormat = timeFormats["timedelta"]["noMinute"](currentTickDate)
                            return tickFormat
                        }
                    }
                    // Same hour, different minute
                    else {
                        const tickFormat = timeFormats["timedelta"]["noHour"](currentTickDate)
                        return tickFormat
                    }
                }
                // Same day, different hour
                else {
                    const tickFormat = timeFormats["timedelta"]["noDay"](currentTickDate)
                    return tickFormat
                }
            }
            // Different day
            else {
                return currentTickFormat
            }
        default:
            return currentTickFormat
    }
}

/**
 * Checks if the data associated with a specific axis property across logs
 * is suitable for a logarithmic scale (all positive or all negative, and no zeros).
 * If the data is not suitable, it updates the state to disable the log scale option
 * and switches the current scale to 'linear' if it was 'log'.
 *
 * @param {LogProps[]} logs - The array of log data objects.
 * @param {LogFieldsResponseProps} fields - Metadata about the fields in the logs.
 * @param {string} table - The table name associated with the logs/fields.
 * @param {string} axisProperty - The name of the field used for the axis.
 * @param {string} scale - The current scale type ('linear' or 'log').
 * @param {(scale: string) => void} setScale - State setter function to update the scale type.
 * @param {(enabled: boolean) => void} setLogScaleEnabled - State setter function to enable/disable the log scale option.
 * @returns {string} The potentially updated scale type ('linear' or 'log').
*/
export function checkLogScalability (
    logs: LogProps[],
    fields: LogFieldsResponseProps,
    table: string,
    axisProperty: string,
    scale: string,
    setScale: (scale: string) => void,
    setLogScaleEnabled: (enabled: boolean) => void
) {
    const values = logs.map(log => getValue(fields, axisProperty, log, table));
    const allPositive = values.every(v => v > 0);
    const allNegative = values.every(v => v < 0);
    const hasZero = values.some(v => v === 0);
    const condition = (allPositive || allNegative) && !hasZero;
    if (!condition) {
        setLogScaleEnabled(false)
        if (scale === "log") {
            setScale("linear"); 
            return "linear";
        }
    } else {
        setLogScaleEnabled(true)
    }
    return scale;
}

/**
 * Reverses a domain array if the reverseX flag is true.
 * This is used primarily when handling logarithmic scales on negative number ranges,
 * where the visual representation might need to be flipped.
 * Calculates the domain based on the absolute extent of the provided values if reversing.
 *
 * @param {number[]} values - The data values used to determine the extent if reversing.
 * @param {number[]} domain - The original domain array [min, max].
 * @param {boolean} reverseX - Flag indicating whether to reverse the domain.
 * @returns {number[]} The original domain or the reversed domain based on absolute values.
*/
export const reverseOrKeepDomain = (values: number[], domain: number[], reverseX: boolean) => {
    if (reverseX) {
        const absXValues = values.map(v => Math.abs(v));
        const [absMinX, absMaxX] = d3.extent(absXValues) as number[];
        return [absMaxX, absMinX];
    }
    return domain
}

/**
 * Draws the X and Y axes on a given SVG element using D3.
 * Configures tick formatting based on plot type and data type (including time types),
 * applies styles, adds axis labels, and draws zero reference lines if applicable.
 *
 * @param {string} plotType - The type of plot being drawn (e.g., "Scatter Plot", "Bar Chart").
 * @param {d3.Selection<SVGSVGElement | null, unknown, null, undefined>} svg - The D3 selection of the SVG element.
 * @param {{width: number, height: number}} dimensions - The width and height of the plotting area.
 * @param {{[key: string]: number}} margins - An object defining the top, right, bottom, and left margins.
 * @param {d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>} x - The D3 scale function for the X-axis.
 * @param {d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>} y - The D3 scale function for the Y-axis.
 * @param {number[]} xTicks - An array of numerical values for the X-axis ticks.
 * @param {number[]} yTicks - An array of numerical values for the Y-axis ticks.
 * @param {boolean} [reverseX=false] - Whether to reverse the direction/formatting of the X-axis (for negative log scales).
 * @param {boolean} [reverseY=false] - Whether to reverse the direction/formatting of the Y-axis (for negative log scales).
 * @param {string} [xAxisLabel] - Optional label text for the X-axis.
 * @param {string} [yAxisLabel] - Optional label text for the Y-axis.
 * @param {string} [xType] - Optional data type for the X-axis ('timestamp', 'date', 'time', 'timedelta') for special formatting.
 * @param {string} [yType] - Optional data type for the Y-axis ('timestamp', 'date', 'time', 'timedelta') for special formatting.
 * @returns {{xAxis: d3.Selection<d3.BaseType, unknown, null, undefined>, yAxis: d3.Selection<d3.BaseType, unknown, null, undefined>}} An object containing the D3 selections for the drawn X and Y axes.
 */
export const drawAxes = (
    plotType: string,
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>, 
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    x: d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>,
    y: d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>,
    xTicks: number[], 
    yTicks: number[],
    reverseX: boolean = false,
    reverseY: boolean = false,
    xAxisLabel?: string,
    yAxisLabel?: string,
    xType?: string,
    yType?: string,
) => {

    /* Initialize variables */
    let xAxis : d3.Selection<d3.BaseType, unknown, null, undefined>;
    let yAxis : d3.Selection<d3.BaseType, unknown, null, undefined>;
    let xTickFormatter: any;
    let yTickFormatter: any;

    /* Initialize x and y axes */
    const height = dimensions.height; 
    const width = dimensions.width;   
    xAxis = svg.select(".xAxis")
    yAxis = svg.select(".yAxis")

    /* Adjust tick formatting */
    if (plotType === "Bar Chart") {
        xTickFormatter = d3.axisBottom(x as d3.ScaleBand<string>).tickSizeOuter(0).tickFormat(d => {
            if (typeof d === "number") return reverseX ? formatNumber(-d) : formatNumber(d) 
            return d.toString().slice(0, 10)
        }) as any;
    } else if (plotType === "Histogram" || plotType === "Line Chart" || plotType === "Scatter Plot") {
        xTickFormatter = d3.axisBottom(x as d3.ScaleLinear<number, number, never>).tickValues(xTicks).tickFormat((d, i) => {
            const prevTick = i > 0 ? xTicks[i - 1] : undefined;
            if (xType === "timestamp" || xType === "timedelta" || xType === "time" || xType === "date") return formatTimeTypeTick(d as number, prevTick, xType)
            return reverseX ? formatNumber(-d as number) : formatNumber(d as number)
        }) as any
    }
    else {
        xTickFormatter = d3.axisBottom(x as d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>).tickValues(xTicks).tickFormat((d, i) => {
            let value = parseFloat(d.toString())
            value = reverseX ? -value : value
            return formatNumber(value);
        }) as any
    }
    yTickFormatter = d3
        .axisLeft(y as d3.ScaleLinear<number, number, never> | d3.ScaleLinear<number, number, never>)
        .tickValues((plotType === "Histogram") || (plotType === "Bar Chart" && yTicks.every(tick => tick >= 0))
            ? yTicks.length > 1 ? yTicks.slice(1) : yTicks 
            : yTicks as number[]
        )
        .tickFormat((d, i) => {
            const prevTick = i > 0 ? yTicks[i - 1] : undefined;
            if (yType === "timestamp" || yType === "timedelta" || yType === "time" || yType === "date") return formatTimeTypeTick(d as number, prevTick, yType)
            let value = parseFloat(d as any)
            value = reverseY ? -value : value
            return formatNumber(value)
        }) as any

    /* Format ticks */
    xAxis = xAxis.call(xTickFormatter);
    yAxis = yAxis.call(yTickFormatter);

    /* Style ticks, axis and line */
    xAxis.selectAll("text").attr("stroke", "black") .attr("stroke-width", 0.1).attr("transform", "rotate(-20) translate(0, 5)").attr("text-anchor", "end").attr("font-size", "10px");
    yAxis.selectAll("text").attr("stroke", "black") .attr("stroke-width", 0.1).attr("text-anchor", "end").attr("font-size", `10px`);
    xAxis.select("path").style("opacity", 0);
    yAxis.select("path").style("opacity", 0);
    xAxis.style("opacity", 1)
    
    // Hide tick labels and lines for bar charts, but keep axis label visible
    if (plotType === "Bar Chart") {
        xAxis.selectAll(".tick text").style("opacity", 0);  // Hide tick labels
        xAxis.selectAll(".tick line").style("opacity", 0);  // Hide tick lines
        xAxis.selectAll(".domain").style("opacity", 0);     // Hide axis line
    }

    // --- Add Axis Labels ---
    const labelFontSize = "12px";
    const labelColor = "var(--foreground)";
    xAxis.selectAll(".x-axis-label").remove(); // Remove old label first
    if (xAxisLabel) {
        xAxis.append("text")
        .attr("class", "x-axis-label")
        .attr("text-anchor", "middle")
        .attr("x", margins.left + (width - margins.left - margins.right) / 2) // Center below plot area
        .attr("y", margins.bottom - 15) // Position below ticks
        .attr("fill", labelColor)
        .style("font-size", labelFontSize)
        .text(xAxisLabel);
    }
    yAxis.selectAll(".y-axis-label").remove(); // Remove old label first
    if (yAxisLabel) {
        yAxis.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("y", -margins.left + 20) // Position left of axis
        .attr("x", -(margins.top + (height - margins.top - margins.bottom) / 2)) // Center vertically in plot area
        .attr("fill", labelColor)
        .style("font-size", labelFontSize)
        .text(yAxisLabel);
    }

    /* Add x = 0 and / or y = 0 line, if applicable */
    const zeroXLine = svg.selectAll(".x-zero")
    const zeroYLine = svg.selectAll(".y-zero")
    if (["Line Chart", "Scatter Plot"].includes(plotType) && Math.min(...xTicks) <= 0 && Math.max(...xTicks) >= 0) {
        zeroXLine
            .attr("x1", x(0 as any) as number)
            .attr("x2", x(0 as any) as number)
            .attr("y1", margins.top)
            .attr("y2", height - margins.bottom)
            .style("opacity", 1);
    }  
    else {
        zeroXLine.style("opacity", 0);
    }
    if (["Bar Chart", "Line Chart", "Scatter Plot"].includes(plotType) && Math.min(...yTicks) <= 0 && Math.max(...yTicks) >= 0) {
        zeroYLine
            .attr("x1", margins.left)
            .attr("x2", width)
            .attr("y1", y(0 as any) as number)
            .attr("y2", y(0 as any) as number)
            .style("opacity", 1);
    }
    else {
        zeroYLine.style("opacity", 0);
    }
    
    return {xAxis, yAxis}
};