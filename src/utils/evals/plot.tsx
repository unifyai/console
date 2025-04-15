"use client";

import * as d3 from "d3";
import { LogProps, LogItemProps, LogFieldsResponseProps } from "@/types/evals/logs";
import { DataRange, GroupedDataRange, GroupedBin, GroupedDataLabel, DataLabel, DataPoint, GroupedDataPoint, GroupingColors, InfoCardData } from "@/types/evals/plot";
import { toComputableValue, computeStatistic } from "./common";
import { formatNumber } from "../formatNumber";
import { formatTimeTypeValue, timeValueToTime, timeDeltaValueToDuration } from "./format";

const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const closeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const copiedIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`;

/** Utility functions to draw UI elements shared across plot types, including: 
 * X and Y axes and ticks
 * Plot border lines
 * Hover tooltip card and positioning
 * Grouped values legend
 * Clearing the canvas
*/

export function clearCanvas (svgRef: any, containerRef: any) {
    const svg = d3.select(svgRef.current)
    const g = svg.select(".plotData")
    const xAxis = svg.select(".xAxis")
    const yAxis = svg.select(".yAxis")
    const xZero = svg.select(".x-zero")
    const yZero = svg.select(".y-zero")

    g.selectAll("*").remove();
    xAxis.selectAll("*").remove();
    yAxis.selectAll("*").remove();
    xZero.style("opacity", 0)
    yZero.style("opacity", 0)

}  

const drawAxes = (
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
    xType?: string,
    yType?: string
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

    if (plotType === "Bar Chart") xAxis.style("opacity", 0)         // (Temporary: Hide x axis for bar charts)

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

export const drawBorders = (
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  height: number,
  width: number,
  margins: {[key: string]: number}
) => {
    svg.select(".bottomLine")
      .attr("x1", 0)
      .attr("y1", height - margins.bottom )
      .attr("x2", width + margins.left)
      .attr("y2", height - margins.bottom)
    svg.select(".leftLine")
      .attr("x1", margins.left)
      .attr("y1", margins.top)
      .attr("x2", margins.left)
      .attr("y2", height - margins.bottom)
    svg.select(".topLine")
      .attr("x1", 0)
      .attr("y1", margins.top)
      .attr("x2", width + margins.left)
      .attr("y2", margins.top)
};

/**
 * Clears the content and hides the fixed tooltip container.
 */
export function clearFixedTooltip() {
    const container = d3.select(".fixedPlotTooltip");
    container.datum(null).html('').classed('hidden', true);
}

/**
 * Renders the content of the fixed tooltip based on the bound datum.
 * @param container d3.Selection of the fixed tooltip div.
 */
function renderFixedTooltipContent(container: d3.Selection<HTMLDivElement, InfoCardData | null, HTMLElement, any>) {
    const data = container.datum(); // Get the bound data

    if (!data) {
        clearFixedTooltip(); // Ensure it's cleared and hidden if no data
        return;
    }

    container.html('').classed('hidden', false); // Clear previous content and ensure visible

    // Add Close Button
    container.append('button')
        .attr('class', 'absolute top-1 right-1 p-0.5 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring')
        .attr('aria-label', 'Close tooltip')
        .html(closeIconSVG)
        .on('click', (event) => {
            event.stopPropagation(); // Prevent plot background click if tooltip overlaps
            clearFixedTooltip();
        });

    const contentWrapper = container.append('div')
        .attr('class', 'flex flex-col gap-2 mt-1'); // Add margin top for close button space


    // Helper function to add an item with a copy button
    const addItem = (label: string, value?: string | number) => {
        const itemDiv = contentWrapper.append('div').attr('class', 'flex items-center justify-between gap-2');
        const textDiv = itemDiv.append('div').attr('class', 'flex-1 overflow-hidden');
        textDiv.append('p').attr('class', 'text-xs text-muted-foreground truncate').text(label);
        if (value) textDiv.append('p').attr('class', 'font-semibold truncate').text(value);

        const copyButton = itemDiv.append('button')
            .attr('class', 'p-1 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring copy-button shrink-0')
            .attr('aria-label', `Copy ${label}`)
            .html(copyIconSVG);

        copyButton.on('click', function(event) {
            event.stopPropagation();
            const button = d3.select(this);
            navigator.clipboard.writeText(String(value)).then(() => {
                button.html(copiedIconSVG);
                setTimeout(() => {button.html(copyIconSVG)}, 1500);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
    };

    // Add Aggregate Item (if exists)
    if (data.aggregate) {
        addItem(data.aggregate.name);
        contentWrapper.append('div').attr('class', 'border-b border-border my-1'); // Divider
    }

    // Add Group Item (if exists)
    if (data.group) {
        addItem(data.group.name, data.group.value);
        contentWrapper.append('div').attr('class', 'border-b border-border my-1'); // Divider
    }

    // Add X Item
    addItem(data.x.name, data.x.value);

    // Add Y Item
    if (data.y) {
        contentWrapper.append('div').attr('class', 'border-b border-border my-1'); // Divider
        addItem(data.y.name, data.y.value);
    }
}

/**
 * Generic click handler for plot elements (bars, points, hist bins) to handle fixed tooltip .
 * @param event The click event.
 * @param data The data associated with the clicked element (InfoCardData structure).
 */
function showFixedTooltip(event: MouseEvent, data: InfoCardData | null) {
    event.stopPropagation();
    const fixedTooltipContainer = d3.select<HTMLDivElement, InfoCardData | null>(".fixedPlotTooltip");
    fixedTooltipContainer.datum(data); // Bind the new data
    renderFixedTooltipContent(fixedTooltipContainer); // Render with new data
}

/**
 * Generates the HTML content for the hover tooltip.
 * @param data The data for the hovered element.
 * @returns HTML string for the tooltip.
*/
const tooltipTemplate = (data: InfoCardData) => {
    let template = `
    <p>${data.x.name}</p>
    <p class="font-bold">${data.x.value}</p>
    <div style="border-bottom: 1px solid var(--foreground); margin: 4px 0;"></div>
    <p>${data.y.name}</p>
    <p class="font-bold">${data.y.value}</p>
    `
    if (data.group) {
        const groupTemplate = `
        <p>${data.group.name}</p>
        <p class="font-bold">${data.group.value}</p>
        <div style="border-bottom: 1px solid var(--foreground); margin: 4px 0;"></div>
        `
        template = groupTemplate + template
    }
    if (data.aggregate) {
        const aggregateTemplate = `
        <p>${data.aggregate.name}</p>
        <div style="border-bottom: 1px solid var(--foreground); margin: 4px 0;"></div>
        `
        template = aggregateTemplate + template
    }
    // Instructions to pin the tooltip
    template += `
        <div class="border-b border-border my-2"></div>
        <p class="text-xs text-muted-foreground flex items-center gap-1">
            <span class="inline-block" aria-hidden="true">ⓘ</span>
            <span class="italic">Click to pin in the foldable menu</span>
        </p>
    `;

    return template
}

const keyTemplate = (keys: GroupingColors) => {
    const value = (entry: { key: string | null, color: string }) => entry.key?.toString().replace(/^"|"$/g, '');
    return (`
    ${keys.map((entry, index) => `
    <div id=${entry.key} class="key flex flex-row gap-2 mt-1 items-center">
        <div class="rounded-full h-2 w-2 shrink-0" style="background-color: ${entry.color}; color: ${entry.color}"></div>
        <p class="text-xs text-foreground">${value(entry)}</p>
    </div>
    `).join("\n")}`)
}

/**
 * Positions the hover tooltip relative to the mouse cursor,
 * ensuring it stays within the viewport boundaries.
 *
 * IMPORTANT: This function should be called *after* the tooltip's
 * content has been updated (e.g., via .html()) so that its
 * dimensions can be measured correctly.
 *
 * @param event The mouse event (used for cursor position).
 * @param tooltip The D3 selection of the tooltip element.
 */
const positionTooltip = (event: any, tooltip: any) => {
    const tooltipNode = tooltip.node();
    if (!tooltipNode) return;
    const [tooltipRect] = [tooltipNode.getBoundingClientRect()];
    const [tooltipWidth, tooltipHeight] = [tooltipRect.width, tooltipRect.height];
    const [pointerX, pointerY] = d3.pointer(event, event.target);
    const [xOffset, yOffset] = [
        pointerX - tooltipWidth / 2,
        pointerY < tooltipHeight ? pointerY + tooltipHeight / 1.75 : pointerY - tooltipHeight / 1.15
    ]
    tooltip
        .style("left", `${xOffset}px`)
        .style("top", `${yOffset}px`)
};

// Helper function to get the primary color from a node
export const getPrimaryColorFromNode = (node: Element | null): string => {
    const fallback = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    if (node) {
      // Read the computed style for --primary from the specific node
      const color = getComputedStyle(node).getPropertyValue('--primary').trim();
      // Provide a fallback if the property isn't set or is empty
      return color || fallback;
    }
    // Fallback if the node itself is null
    return fallback;
};

/** Utility functions to process plot data, including:
 * Calculating the x and y axis tick values
 * Formatting time axis values to remove redundant components
 * Checking if an axis data range can be turned to log scale
 * Reversing the axis domain to compute log scaled values if all numbers in the range are strictly negative
 * Checking if a table's logs has values for a given axis property, and getting those values, if applicable
 * Combine plot logs data across tables
 * Extracting a subset of the data if it's too large
*/
function niceIncrement(min: number, max: number, count = 10) {
    const rawStep = (max - min) / count;
    const base = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const factors = [1, 2, 2.5, 5, 10];
    const bestStep = factors.map(f => base * f).reduce((prev, curr) => Math.abs(curr - rawStep) < Math.abs(prev - rawStep) ? curr : prev);
    return bestStep;
  }
  
function generateTicks(min: number, max: number, count = 10, isLogScale = false) {
  
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

const reverseOrKeepDomain = (values: number[], domain: number[], reverseX: boolean) => {
    if (reverseX) {
        const absXValues = values.map(v => Math.abs(v));
        const [absMinX, absMaxX] = d3.extent(absXValues) as number[];
        return [absMaxX, absMinX];
    }
    return domain
}

const hasProperty = (fields: LogFieldsResponseProps, axisProperty: string, log: LogProps, table: string) => {
    const fieldType = fields[axisProperty] ? fields[axisProperty].field_type : "entry"
    const hasValues = fieldType === "derived_entry"
        ? log[`${table}.derived_entries`] && (log[`${table}.derived_entries`] as LogItemProps)[axisProperty] !== undefined
        : fieldType === "param"
            ? log[`${table}.params`] && (log[`${table}.params`] as LogItemProps)[axisProperty] !== undefined
            : log[`${table}.entries`] && (log[`${table}.entries`] as LogItemProps)[axisProperty] !== undefined
    return hasValues
}

const getValue = (fields: LogFieldsResponseProps, axisProperty: string, log: LogProps, table: string) => {
    if (!hasProperty(fields, axisProperty, log, table)) return undefined;
    const fieldType = fields[axisProperty] ? fields[axisProperty].field_type : "entry"
    let value = fieldType === "derived_entry"
        ? (log[`${table}.derived_entries`] as LogItemProps)[axisProperty]
        : fieldType === "param"
            ? (log[`${table}.params`] as LogItemProps)[axisProperty]
            : (log[`${table}.entries`] as LogItemProps)[axisProperty]
    const dataType = fields[axisProperty] ? fields[axisProperty].data_type : "float"
    if (dataType === "timestamp" || dataType === "date") value = new Date(value).getTime()
    if (dataType === "timedelta") value = timeDeltaValueToDuration(value)
    if (dataType === "time") value = timeValueToTime(value).getTime()
    if (dataType === "bool") value = Number(typeof value === "string" ? value === "true" : value) 
    return value
}

function getRandomSubset(arr: any[], size: number) {
    let shuffled = arr.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, size);
}

/** Main plot functions including:
 * Bar chart: Group data by x-axis key and compute a reduction metric value for the y-axis property per x-axis value. Accepts any data type.
 * Line chart: Plot single y-axis versus x-axis line, or one line per group. Accepts floats, ints or times.
 * Scatter plot: Plot y-axis versus x-axis dots with a single color or one color per grouped value. Accepts floats or ints.
 * Histogram: Plot frequency per x-axis value for given bin size. Accepts floats, ints or times.
*/
export const drawBarChart = (
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    scaleX: string,
    scaleY: string,
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    axisPadding: number,
    selectedXAxisProperty: string | undefined,
    selectedYAxisProperty: string | undefined,
    groupByProperty: string | undefined,
    aggregateProperty: string | undefined,
    metric: string,
    sortBars: string | undefined,
    xTable: string,
    yTable: string,
    logs: LogProps[],
    fields: LogFieldsResponseProps,
    zoomRef: any,
    interactive: boolean = true
) => {

    // Clear previous elements
    const g = svg.select(".plotData");
    g.selectAll("circle.data-point").remove();
    g.selectAll("circle.hover-area").remove();
    g.selectAll("path.line-item").remove();
    g.selectAll("rect.hist-item").remove();
    g.selectAll("text.correlation").remove();
    g.selectAll("text.correlation-group").remove();
    g.selectAll("path.best-fit").remove()
    
    // Prepare data
    const properties = Object.entries(fields).map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties.at(0);
    const yAxisProperty = selectedYAxisProperty && properties.includes(selectedYAxisProperty) ? selectedYAxisProperty : properties.at(0);
    let data: DataLabel[] | GroupedDataLabel[] = [];
    if (xAxisProperty && yAxisProperty) {
        const filteredData = logs.filter(log => {
            const hasX = hasProperty(fields, xAxisProperty, log, xTable)
            const hasY = hasProperty(fields, yAxisProperty, log, yTable)
            const hasGroup = groupByProperty ? hasProperty(fields, groupByProperty, log, xTable) : true
            return hasX && hasY && hasGroup
        });
        const statistic = (vals: number[]) => parseFloat(computeStatistic(metric, vals));
        if (groupByProperty) {
            const groupsMap = d3.groups(filteredData, d => getValue(fields, groupByProperty, d, xTable));
            for (const [groupKey, groupLogs] of groupsMap) {
                const subGroups = d3.rollup(
                    groupLogs,
                    v => statistic(v.map(log => toComputableValue(getValue(fields, yAxisProperty, log, yTable)))),
                    d => JSON.stringify(getValue(fields, xAxisProperty, d, xTable))
                );
                for (const subGroup of Array.from(subGroups)) {
                    (data as GroupedDataLabel[]).push([String(groupKey), subGroup]);
                }
            }
        } else {
            const groups = d3.rollup(
                filteredData,
                v => statistic(v.map(log => toComputableValue(getValue(fields, yAxisProperty, log, yTable)))),
                d => JSON.stringify(getValue(fields, xAxisProperty, d, xTable))
            );
            data = Array.from(groups, ([group, value]) => [group, value]) as DataLabel[];
        }
        if (!groupByProperty && sortBars != "unsorted") {
            (data as DataLabel[]).sort((a, b) => {
                const yA = a[1];
                const yB = b[1];
                switch (sortBars) {
                    case "asc":
                        return yA - yB
                    case "desc":
                        return yB - yA
                    default:
                        return yA - yB;
                }
            });
        }
        else {
            groupByProperty
            ?   (data as GroupedDataLabel[]).every(item => Number(item[1][0]))
                    ? (data as GroupedDataLabel[]).sort((a, b) => Number(a[1][0]) - Number(b[1][0]))
                    : (data as GroupedDataLabel[]).sort((a, b) => a[1][0].localeCompare(b[1][0]))
            :   (data as GroupedDataLabel[]).every(item => Number(item[0]))
                    ? (data as DataLabel[]).sort((a, b) => Number(a[0]) - Number(b[0]))
                    : (data as DataLabel[]).sort((a, b) => a[0].localeCompare(b[0]))
        }
    }

    // Define scales
    const [width, height] = [dimensions.width, dimensions.height];
    const xDomain = groupByProperty
    ? Array.from(new Set((data as GroupedDataLabel[]).flatMap(d => d[1][0])))
    : Array.from(new Set((data as DataLabel[]).map(d => d[0])))
    const xRange = [margins.left, width - margins.right]
    const yValues = groupByProperty
    ? (data as GroupedDataLabel[]).flatMap(d => d[1][1])
    : (data as DataLabel[]).map(d => d[1])
    let [minY, maxY] = d3.extent(yValues) as [number, number]
    if (minY === undefined || maxY === undefined) {
        minY = 0;
        maxY = 1;
    } else if (minY === maxY) {
        minY = minY - 1;
        maxY = maxY + 1;
    } else if (minY > 0 && maxY > 0) {
        minY = Math.min(0, minY)
    } else if (minY < 0 && maxY < 0) {
        minY = Math.min(0, minY)
    }
    let yDomain = [minY, maxY]
    const xScale = d3.scaleBand().domain(xDomain).range(xRange).padding(0.2);
    const yRange = [
        height - margins.bottom - axisPadding * Number(yValues.some(d => d < 0)),
        margins.top + axisPadding * Number(yValues.some(d => d > 0))
    ]
    const yScale = (scaleY === "log" ? d3.scaleLog() : d3.scaleLinear()).domain(yDomain).range(yRange);

    // Draw axes
    const [xTicks, yTicks] = [
        generateTicks(0, 0, 10, scaleX === "log"),
        generateTicks(minY, maxY, 10, scaleY === "log")
    ]
    drawAxes("Bar Chart", svg, dimensions, margins, xScale, yScale, xTicks, yTicks);

    // Tooltip and grouping key
    const tooltip = container.select(".plotTooltip").style("opacity", 0);
    const key = settings.select(".groupingKey");

    // Draw bars
    const initialOpacity = groupByProperty ? 0.7 : 1.0;
    if (groupByProperty){
        const groupDomain = Array.from(new Set((data as GroupedDataLabel[]).map(d => d[0])))
        const colorScale = d3.scaleOrdinal<string>(d3.schemeCategory10).domain(groupDomain);
        g
            .selectAll<SVGRectElement, GroupedDataLabel>("rect.bar-item")
            .data((data as GroupedDataLabel[]), d => `${(d as GroupedDataLabel)[0]}-${(d as GroupedDataLabel)[1][0]}`)
            .join(
                enter => enter.append("rect")
                    .attr("class", "bar-item")
                    .attr("x", d => xScale(d[1][0])!)
                    .attr("width", xScale.bandwidth())
                    .attr("y", yScale(0))
                    .attr("height", 0)
                    .attr("fill", d => colorScale(d[0]))
                    .style("opacity", 0)
                    .style("cursor", "pointer")
                    .call(enter => enter.transition("enter")
                        .duration(500)
                        .attr("y", d => yScale(Math.max(0, d[1][1])))
                        .attr("height", d => Math.abs(yScale(d[1][1]) - yScale(0)))
                        .style("opacity", initialOpacity)
                    ),
                update => update
                    .call(update => update.transition("update")
                        .duration(500)
                        .attr("x", d => xScale(d[1][0])!)
                        .attr("width", xScale.bandwidth())
                        .attr("y", d => yScale(Math.max(0, d[1][1])))
                        .attr("height", d => Math.abs(yScale(d[1][1]) - yScale(0)))
                        .attr("fill", d => colorScale(d[0]))
                        .style("opacity", initialOpacity)
                    ),
                exit => exit.transition("exit")
                    .duration(500)
                    .attr("height", 0)
                    .attr("y", yScale(0))
                    .style("opacity", 0)
                    .remove()
        );
        // Grouping Key
        const colors: GroupingColors = groupDomain.map(groupKey => ({key: groupKey, color: colorScale(groupKey)}));
        key.html(keyTemplate(colors)).style("opacity", 1);
        key
            .selectAll(".key")
            .on("mouseover", (event: MouseEvent) => {
                const target = event.currentTarget as HTMLElement;
                const groupKey = target.id;
                g.selectAll("rect.bar-item")
                 .transition("opacity")
                 .duration(200)
                 .style("opacity", d => { return (d as GroupedDataLabel)[0] === groupKey ? 1 : 0 });
                key.selectAll(".key")
                   .transition("opacity").duration(200)
                   .style("opacity", function() { return (this as any).id === groupKey ? 1 : 0.3; });
            })
            .on("mouseout", () => {
                g.selectAll("rect.bar-item")
                 .transition("opacity")
                 .duration(200)
                 .style("opacity", initialOpacity);
                key.selectAll(".key")
                   .transition("opacity")
                   .duration(200)
                   .style("opacity", 1);
            });
    }
    else {
        const primary = getPrimaryColorFromNode(svg.node());
        g
            .selectAll<SVGRectElement, DataLabel>("rect.bar-item")
            .data(data as DataLabel[], d => d[0])
            .join(
                enter => enter.append("rect")
                    .attr("class", "bar-item")
                    .attr("x", d => xScale(d[0])!)
                    .attr("width", xScale.bandwidth())
                    .attr("y", yScale(0))
                    .attr("height", 0)
                    .attr("fill", primary)
                    .style("cursor", "pointer")
                    .call(
                        enter => enter.transition("enter")
                            .duration(500)
                            .attr("y", d => yScale(Math.max(0, d[1])))
                            .attr("height", d => Math.abs(yScale(d[1]) - yScale(0)))
                    ),
                update => update
                    .call(update => update.transition("update")
                        .duration(500)
                        .attr("x", d => xScale(d[0])!)
                        .attr("width", xScale.bandwidth())
                        .attr("y", d => yScale(Math.max(0, d[1])))
                        .attr("height", d => Math.abs(yScale(d[1]) - yScale(0))))
                        .attr("fill", primary),
                exit => exit.transition("exit")
                    .duration(500)
                    .attr("height", 0)
                    .attr("y", yScale(0))
                    .remove()
            );
    }

    // Events
    const getTooltipData = (groupByProperty: string | undefined, d: GroupedDataLabel | DataLabel) => {
        if (groupByProperty) {
            const group = (d as GroupedDataLabel)[0];            
            const xValue = (d as GroupedDataLabel)[1][0];
            const yValue = (d as GroupedDataLabel)[1][1];
            const data : InfoCardData =  {
                group: { 
                    name: `Group: ${groupByProperty}`, 
                    value: group 
                },
                x: { 
                    name: `X: ${xAxisProperty!}`, 
                    value: xValue 
                },
                y: { 
                    name: `Y: ${yAxisProperty}(${metric})`, 
                    value: yValue 
                }
            }
            if (aggregateProperty) {
                data.aggregate = {
                    name: `Aggregate: ${aggregateProperty}`,
                }
            }
            return data
        }
        else {
            const xValue = (d as DataLabel)[0];
            const yValue = (d as DataLabel)[1];
            const data : InfoCardData = {
                x: { 
                    name: `X: ${xAxisProperty!}`, 
                    value: xValue 
                },
                y: { 
                    name: `Y: ${yAxisProperty}(${metric})`,
                    value: yValue
                }
            }
            if (aggregateProperty) {
                data.aggregate = {
                    name: `Aggregate: ${aggregateProperty}`,
                }
            }
            return data
        }
    }
    const handleMouseOver = (event: any, d: GroupedDataLabel | DataLabel) => {
        if (groupByProperty) {
            const group = (d as GroupedDataLabel)[0];            
            tooltip.html(tooltipTemplate(getTooltipData(groupByProperty, d))).transition("opacity").style("opacity", 1);
            g.selectAll("rect.bar-item")
              .transition("opacity").duration(200)
              .style("opacity", barData => (barData as GroupedDataLabel)[0] === group ? 1 : 0);
            key.selectAll(".key")
                .transition("opacity")
                .duration(200)
                .style("opacity", function() { return (this as any).id === group ? 1 : 0.3; });
        }
        else {
            const xValue = (d as DataLabel)[0];
            tooltip.html(tooltipTemplate(getTooltipData(groupByProperty, d))).transition("opacity").style("opacity", 1);
            g.selectAll("rect.bar-item")
                .transition("opacity")
                .style("opacity", bar => (bar as DataLabel)[0] === xValue ? 1 : 0.3);
        }
    };
     const handleMouseMove = (event: any) => {
        positionTooltip(event, tooltip);
    };
    const handleMouseOut = () => {
        tooltip.transition("opacity").style("opacity", 0);
        g.selectAll("rect.bar-item").transition("opacity").style("opacity", initialOpacity);
        if (groupByProperty) {
            key.selectAll(".key").transition("opacity").duration(200).style("opacity", 1);
        }
    };
    g.selectAll("rect.bar-item")
        .on("mouseover", (e, d) =>handleMouseOver(e,(d as GroupedDataLabel | DataLabel)))
        .on("mousemove", handleMouseMove)
        .on("mouseout", handleMouseOut)
        .on("click", (e,d) => showFixedTooltip(e, getTooltipData(groupByProperty, (d as GroupedDataLabel | DataLabel))));
};

export const drawLineChart = (
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  scaleX: string,
  scaleY: string,
  dimensions: {width: number, height: number},
  margins: {[key: string]: number},
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  groupBy: string | undefined,
  aggregate: string | undefined,
  xTable: string,
  yTable: string,
  logs: LogProps[],
  fields: LogFieldsResponseProps,
  zoomRef: any,
  interactive: boolean = true
) => {

    // Remove drawings from previous plots
    const g = svg.select(".plotData")
    g.selectAll("circle.data-point").remove();
    g.selectAll("circle.hover-area").remove();
    g.selectAll("rect.bar-item").remove();
    g.selectAll("rect.hist-item").remove();
    g.selectAll("text.correlation").remove();
    g.selectAll("text.correlation-group").remove();
    g.selectAll("path.best-fit").remove();

    // Prepare data:
    // 1- Auto set y axis property to the first property if changing plots from bar chart to line chart 
    // 2- Filter data for logs that have the x and y properties, and the groupBy property if grouping
    // 3- Convert non numeric values to numeric values if applicable
    // 4- Sort logs by x axis value
    // 5- Return plotting data as arrays of x / y values, or arrays of groupedBy x / y values if grouping
    let data : DataPoint[] | GroupedDataPoint[] = [];
    const properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int" || data_type === "timestamp" || data_type === "time" || data_type === "timedelta" || data_type === "date" || data_type === "bool"))
            .map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties.at(0);
    const yAxisProperty = selectedYAxisProperty && properties.includes(selectedYAxisProperty) ? selectedYAxisProperty : properties.at(0);
    let xType : string | undefined;
    if (xAxisProperty && yAxisProperty) {
        xType = fields[xAxisProperty].data_type
        const filteredData = logs.filter((log) => {
            const hasGroup = groupBy ? hasProperty(fields, groupBy, log, xTable) : true
            const hasX = hasProperty(fields, xAxisProperty, log, xTable)
            const hasY = hasProperty(fields, yAxisProperty, log, yTable)    
            return hasGroup && hasX && hasY;
        });
        const sortedData = filteredData.sort((a, b) => {
            const valueA = getValue(fields, xAxisProperty, a, xTable)
            const valueB = getValue(fields, xAxisProperty, b, xTable)
            if (xType === "timedelta") return valueB - valueA;
            return valueA - valueB;
        });
        const getData = (logs: LogProps[]) => logs.map(d => [
            getValue(fields, xAxisProperty, d, xTable),
            getValue(fields, yAxisProperty, d, yTable)
        ])  as DataPoint[]
        data = groupBy 
            ?   d3  .groups(sortedData, d => getValue(fields, groupBy, d, xTable))
                    .map(([groupKey, groupData]) => {
                        const group = groupKey as string;
                        const values = getData(groupData);
                        return [group, values];
                    }) as GroupedDataPoint[]
            :   getData(sortedData);
    }

    // Define scales:
    // 1- Extract all x and y values as separate arrays
    // 2- Find the min and max values for both arrays
    // 3- Setup the axis scales
    // 4- If all values are negative and the scale is log, convert to positive values
    // 4- Map x and y values to the plot pixel range
    const width = dimensions.width;
    const height = dimensions.height;
    const [xValues, yValues] = [
        groupBy ? (data as GroupedDataPoint[]).flatMap((group) => group[1].map((d) => d[0])) : (data as DataPoint[]).map((d) => d[0]),
        groupBy ? (data as GroupedDataPoint[]).flatMap((group) => group[1].map((d) => d[1])) : (data as DataPoint[]).map((d) => d[1])
    ]
    const [[minX = 0, maxX = 0], [minY = 0, maxY = 0]] = [d3.extent(xValues), d3.extent(yValues)];
    const [xAxisScale, yAxisScale] = [
        scaleX === "log" ? d3.scaleLog : d3.scaleLinear as any,
        scaleY === "log" ? d3.scaleLog : d3.scaleLinear
    ];
    const reverseX = scaleX === "log" && xValues.every(v => v < 0);
    const reverseY = scaleY === "log" && yValues.every(v => v < 0);
    const [xDomain, yDomain] = [
        reverseOrKeepDomain(xValues, [minX, maxX], reverseX), 
        reverseOrKeepDomain(yValues, [minY, maxY], reverseY)
    ]
    const [xRange, yRange] = [
        [margins.left + axisPadding, width - margins.right - axisPadding],
        [height - margins.bottom - axisPadding, margins.top + axisPadding]
    ]
    const [x, y] = [
        xAxisScale().domain(xDomain).range(xRange),
        yAxisScale().domain(yDomain).range(yRange)
    ];

    // Draw axes
    const [xTicks, yTicks] = [
        generateTicks(minX, maxX, 10, scaleX === "log"),
        generateTicks(minY, maxY, 10, scaleY === "log")
    ]
    drawAxes("Line Chart", svg, dimensions, margins, x, y, xTicks, yTicks, reverseX, reverseY, xType);

    // Add grouping key and hide tooltip
    const key = settings.select(".groupingKey")
    const tooltip = container.select(".plotTooltip").style("opacity", 0)

    // Plot lines.
    // If grouping, plot one line per group, each with their color, and attach the grouping key.
    // Else plot a single line
    const lineGenerator = d3.line<number[]>()
    .curve(d3.curveLinear)
    .x(d => {
      const value = d[0];
      return reverseX ? x(Math.abs(value)) : x(value);
    })
    .y(d => {
      const value = d[1];
      return reverseY ? y(Math.abs(value)) : y(value);
    });
    if (groupBy) {        
        let domain = (data as GroupedDataPoint[]).map((d) => JSON.stringify(d[0]));
        domain = Array.from(new Set(domain))
        const color = d3.scaleOrdinal().domain(domain).range(d3.schemeCategory10);
        const colors = domain.map((key) => ({key: key, color: color(key) as string}));
        g.selectAll("path.line-item")
            .data(
                data as GroupedDataPoint[], 
                (d) => `${(d as GroupedDataPoint)[0]}-${(d as GroupedDataPoint)[1]}` // Setting a unique identifier)
            ) 
            .join("path")
            .on("mouseover", (event, d) => hoverOnLine(d[0]))
            .on("mouseout", (event, d) => leaveLine())
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", d => color(JSON.stringify(d[0])) as string)
            .attr("stroke-width", 2)
            .attr("d", d => lineGenerator(d[1]))
            .attr("class", "line-item");
            
        key
            .html(keyTemplate(colors))
            .transition("opacity")
            .style("opacity", 1)
    } else {
        const primary = getPrimaryColorFromNode(svg.node());
        g.selectAll("path.line-item")
            .data(
                [data as DataPoint[]],
                (d) => `${(d as DataPoint)[0]}-${(d as DataPoint)[1]}` // Setting a unique identifier)
            )
            .join(
                enter => enter.append("path")
                  .attr("class", "line-item line")
                  .attr("fill", "none")
                  .attr("stroke", primary)
                  .attr("stroke-width", 2)
                  .attr("d", lineGenerator),
                update => update
                  .attr("stroke", primary)
                  .transition("update")
                  .duration(500)
                  .attr("d", lineGenerator),
                exit => exit.remove()
            );
    }

    // When hovering on a line, lower opacity of other line groups and their corresponding key
    function hoverOnLine (groupValue: string) {
        g.selectAll("path.line-item")
            .transition("opacity")
            .duration(200)
            .style("opacity", d => (d as GroupedDataPoint)[0] === groupValue ? 1 : 0.5);
        key.selectAll(".key")
            .each(function (d, i) {
                const id = d3.select(this).attr("id")
                const opacity = id.toString() === groupValue ? 1 : 0.5
                d3.select(this)
                .transition("opacity")
                .duration(200)
                .style("opacity", opacity)
            })
    }

    // When leaving a line, restore opacity of all line groups and their corresponding key
    function leaveLine () {
        g.selectAll("path.line-item").transition("opacity").duration(200).style("opacity", 1)
        key.selectAll(".key").transition("opacity").duration(200).style("opacity", 1)
    }

    // Handle panning and zooming
    const initialX = x.copy();
    const zoomContainer = svg
        .select(".zoom-layer")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .style("fill", "none")
        .style("pointer-events", interactive ? "all" : "none")
        .lower();
    zoomContainer.on("wheel", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    zoomContainer.on('dblclick', () => {
        zoomRef.current = d3.zoomIdentity;        
        zoomContainer.transition("zoom").duration(500).call(zoom.transform as any, d3.zoomIdentity);
    });
    const zoom = d3
        .zoom()
        .on('start', () => {
            d3.select('body').style('overflow', 'hidden')
            // Temporarily disable interaction during zoom   
            g.selectAll("path.line-item").style("pointer-events", "none");
        })
        .on('end', () => {
            d3.select('body').style('overflow', 'auto')
            // Re-enable hover effects after zoom
            g.selectAll("path.line-item").style("pointer-events", "all");
        })
        .on('zoom', (event) => {
            
            event.sourceEvent?.preventDefault();
            event.sourceEvent?.stopPropagation();

            zoomRef.current = event.transform

            const newX = event.transform.rescaleX(initialX);

            // Update line generator with new scales
            lineGenerator.x(d => reverseX ? newX(Math.abs(d[0])) : newX(d[0]))

            // Recalculate ticks based on new domain
            const [minX, maxX] = newX.domain();
            const [xTicks, yTicks] = [
                generateTicks(minX, maxX, 10, scaleX === "log"),
                generateTicks(minY, maxY, 10, scaleY === "log")
            ]

            // Redraw axes with new scales
            drawAxes("Line Chart", svg, dimensions, margins, newX, y, xTicks, yTicks, reverseX, reverseY, xType);

            // Update line paths
            if (groupBy) {
            g
                .selectAll("path.line-item")
                .transition("zoom")
                .attr("d", (d) => lineGenerator((d as GroupedDataPoint)[1]));
            } else {
            g
                .selectAll("path.line-item")
                .transition("zoom")
                .attr("d", lineGenerator(data as DataPoint[]));
            }
        }
    );
    // Attach zoom transform to container and reapply previous zoom if exists
    zoomContainer.call(zoom as any);
    zoomContainer.call(zoom.transform as any, zoomRef.current);
};

export const drawScatterPlot = (
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  scaleX: string,
  scaleY: string,
  dimensions: {width: number, height: number},
  margins: {[key: string]: number},
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  groupBy: string | undefined,
  aggregate: string | undefined,
  showRegression: string,
  xTable: string,
  yTable: string,
  logs: LogProps[],
  fields: LogFieldsResponseProps,
  zoomRef: any,
  interactive: boolean = true
) => {
  
    // Remove drawings from previous plots
    const g = svg.select(".plotData")
    g.selectAll("path.line-item").remove();
    g.selectAll("rect.bar-item").remove();
    g.selectAll("rect.hist-item").remove();
    g.selectAll("text.correlation-group").remove();
    g.selectAll("text.correlation").remove();
    if (showRegression != "true") g.selectAll("path.best-fit").remove()

    // Prepare data
    let data : LogProps[] = [];
    const properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int" || data_type === "timestamp" || data_type === "time" || data_type === "timedelta" || data_type === "date" || data_type === "bool"))
            .map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties.at(0);
    const yAxisProperty = selectedYAxisProperty && properties.includes(selectedYAxisProperty) ? selectedYAxisProperty : properties.at(0);
    let [xType, yType]: [string | undefined, string | undefined] = [undefined, undefined]
    if (xAxisProperty && yAxisProperty) {
        [xType, yType] = [fields[xAxisProperty].data_type, fields[yAxisProperty].data_type]
        data = logs.filter((log) => {
            const hasGroup = groupBy ? hasProperty(fields, groupBy, log, xTable) : true
            const hasX = hasProperty(fields, xAxisProperty, log, xTable)
            const hasY = hasProperty(fields, yAxisProperty, log, yTable)
            return hasGroup && hasX && hasY
        })
        data = data?.length > 1000 ? getRandomSubset(data, 1000) : data
    }

    // Define scales
    const [width, height] = [dimensions.width, dimensions.height];
    const [xValues, yValues] = [
        data.map(d => getValue(fields, xAxisProperty as string, d, xTable) as number),
        data.map(d => getValue(fields, yAxisProperty as string, d, yTable) as number)
    ]
    const [[minX = 0, maxX = 0], [minY = 0, maxY = 0]] = [d3.extent(xValues), d3.extent(yValues)];
    const [xScale, yScale] = [
        scaleX === "log" ? d3.scaleLog : d3.scaleLinear,
        scaleY === "log" ? d3.scaleLog : d3.scaleLinear
    ]
    const reverseX = scaleX === "log" && xValues.every(v => v < 0);
    const reverseY = scaleY === "log" && yValues.every(v => v < 0);
    const [xDomain, yDomain] = [
        reverseOrKeepDomain(xValues, [minX, maxX], reverseX), 
        reverseOrKeepDomain(yValues, [minY, maxY], reverseY)
    ]
    const [xRange, yRange] = [
        [margins.left + axisPadding, width - margins.right - axisPadding],
        [height - margins.bottom - axisPadding, margins.top + axisPadding]
    ]
    const [x, y] = [
        xScale().domain(xDomain).range(xRange),
        yScale().domain(yDomain).range(yRange)
    ]

    // Draw axes
    const [xTicks, yTicks] = [
        generateTicks(minX, maxX, 10, scaleX === "log"),
        generateTicks(minY, maxY, 10, scaleY === "log")
    ]
    drawAxes("Scatter Plot", svg, dimensions, margins, x, y, xTicks, yTicks, reverseX, reverseY, xType, yType);

    // Add tooltip and grouping key
    const tooltip = container.select(".plotTooltip").style("opacity", 0)
    const key = settings.select(".groupingKey")

    // Add data points
    // If grouping is set:
    // - Generate a color scheme based on the grouping values
    // - Color the points based on their groupBy value
    // - Pass the color info to the grouping key
    const primary = getPrimaryColorFromNode(svg.node());
    let color = d3.scaleOrdinal<string>().range(d3.schemeCategory10);
    if (groupBy) {
        let domain = data.map(d => JSON.stringify(getValue(fields, groupBy, d, xTable)));
        domain = Array.from(new Set(domain));
        color.domain(domain);
        const colors = domain.map((key) => ({ key: key, color: color(key) as string }));
        key
            .html(keyTemplate(colors))
            .transition("opacity")
            .style("opacity", 1);
    }    
    const points = g
        .selectAll("circle.data-point")
        .data(data, (d: unknown) => (d as LogProps).id); // Use unique identifier to track point transitions
    points.join(
        enter => enter
            .append("circle")
            .attr("class", "data-point")
            .attr("fill", groupBy ? (d) => color(JSON.stringify(getValue(fields, groupBy, d, xTable))) : primary)
            .attr("stroke", groupBy ? (d) => color(JSON.stringify(getValue(fields, groupBy, d, xTable))) : primary)
            .attr("cx", d => x(reverseX ? Math.abs(getValue(fields, xAxisProperty as string, d, xTable)) : getValue(fields, xAxisProperty as string, d, xTable)))
            .attr("cy", d => y(reverseY ? Math.abs(getValue(fields, yAxisProperty as string, d, yTable)) : getValue(fields, yAxisProperty as string, d, yTable)))
            .attr("r", 3)
            .style("opacity", 0)
            .style("cursor", "pointer")
            .on("mouseover", (event, data) => hoverOnPoint(event, data, xTable, yTable))
            .on("mousemove", (event, data) => moveOnPoint(event, data))
            .on("mouseout", (event, data) => leavePoint(event, data))
            .on("click", (event, data) => showFixedTooltip(event, getTooltipData(data, xTable, yTable)))
            // Call transition only on the enter selection *after* initial setup
            .call(enter => enter.transition("enter").duration(200).style("opacity", 1)),
                update => update
                    .attr("fill", groupBy ? (d) => color(JSON.stringify(getValue(fields, groupBy, d, xTable))) : primary)
                    .attr("stroke", groupBy ? (d) => color(JSON.stringify(getValue(fields, groupBy, d, xTable))) : primary)
                    .call(update => update
                        .transition("update")
                        .duration(250)
                        .attr("cx", d => x(reverseX ? Math.abs(getValue(fields, xAxisProperty as string, d, xTable)) : getValue(fields, xAxisProperty as string, d, xTable)))
                        .attr("cy", d => y(reverseY ? Math.abs(getValue(fields, yAxisProperty as string, d, yTable)) : getValue(fields, yAxisProperty as string, d, yTable)))
                        .attr("r", 3)
                        .style("opacity", 1)
            ),
        exit => exit.call(exit => exit.transition("exit").duration(200).attr("r", 0).remove())
    );

    // Add hover areas
    g
        .selectAll("circle.hover-area")
        .data(data)
        .join("circle")
        .style("cursor", "pointer")
        .on("mouseover", (event, data) => hoverOnPoint(event, data, xTable, yTable))
        .on("mousemove", (event, data) => moveOnPoint(event, data))
        .on("mouseout", (event, data) => leavePoint(event, data))
        .on("click", (event, data) => showFixedTooltip(event, getTooltipData(data, xTable, yTable)))
        .attr("cx", d => x(reverseX ? Math.abs(getValue(fields, xAxisProperty as string, d, xTable) as number) : getValue(fields, xAxisProperty as string, d, xTable) as number))
        .attr("cy", d => y(reverseY ? Math.abs(getValue(fields, yAxisProperty as string, d, yTable) as number) : getValue(fields, yAxisProperty as string, d, yTable) as number))
        .attr("r", 10)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .style("pointer-events", "all")
        .attr("class", "hover-area");

    // When hovering on point.
    // - Set info card position and content
    // - If grouping is set, lower the opacity and radius of all points and groupding keys that don't belong to the same category
    const getTooltipData = (data: LogProps, xTable: string, yTable: string) => {
        const hoverData : InfoCardData = {
            "x" : {
                "name":  `X: ${selectedXAxisProperty as string}`,
                "value": (xType === "timestamp" || xType === "timedelta" || xType === "time" || xType === "date")
                    ? formatTimeTypeValue(getValue(fields, selectedXAxisProperty as string, data, xTable), xType)
                    : getValue(fields, selectedXAxisProperty as string, data, xTable)
            },
            "y" : {
                "name":  `Y: ${selectedYAxisProperty as string}`, 
                "value": (yType === "timestamp" || yType === "timedelta" || yType === "time" || yType === "date")
                    ? formatTimeTypeValue(getValue(fields, selectedYAxisProperty as string, data, yTable), yType)
                    : getValue(fields, selectedYAxisProperty as string, data, yTable)
            }
        }
        if (groupBy) hoverData["group"] = {
            "name": `Group: ${groupBy}`, 
            value: getValue(fields, groupBy as string, data, xTable)
        }
        if (aggregate) hoverData["aggregate"] = {
            name: `Aggregate: ${aggregate}`,
        }
        return hoverData
    }
    function hoverOnPoint (event: any, data: LogProps, xTable: string, yTable: string) {

        tooltip.html(tooltipTemplate(getTooltipData(data, xTable, yTable))).transition("opacity").style("opacity", 1)
        positionTooltip(event, tooltip);

        if (groupBy) {
            g.selectAll("circle.data-point")
                .transition("opacity")
                .duration(200)
                .attr("r", d => (d as LogProps)[`${xTable}.id`] === data[`${xTable}.id`] ? 4 : 3)
                .style("opacity", d => getValue(fields, groupBy, d as LogProps, xTable) === getValue(fields, groupBy, data, xTable) ? 1 : 0.5)
            g.selectAll("path.best-fit")
                .transition("opacity")
                .duration(200)
                .style("opacity", (d: any) => d.groupKey === groupBy ? 1 : 0.5
            );
            g.selectAll("text.correlation-group")
                .transition("opacity")
                .duration(200)
                .style("opacity", (d: any) => d.groupKey === groupBy ? 1 : 0.5);
            key.selectAll(".key")
                .each(function (d, i) {
                    const id = d3.select(this).attr("id")
                    const opacity = id.toString() === getValue(fields, groupBy, data, xTable).toString() ? 1 : 0.5
                    d3.select(this)
                      .transition("opacity")
                      .duration(200)
                      .style("opacity", opacity)
                })
        } else {
            g.selectAll("circle.data-point")
                .filter((d: unknown) => (d as LogProps).id !== data.id)
                .transition("opacity")
                .duration(200)
                .style("opacity", 0.5);
        }
    
    }

    function moveOnPoint(event: any, data: LogProps) {
        positionTooltip(event, tooltip);
    }

    // When leaving a point. Reset info card data and reset point opacity if grouped
    function leavePoint (event: any, data: LogProps) {
        tooltip.transition("opacity").style("opacity", 0)
        if (groupBy) {
            g.selectAll("circle.data-point")
                .transition("opacity")
                .duration(200)
                .attr("r", 3)
                .style("opacity", 1)
            g.selectAll(".key")
               .transition("opacity")
               .duration(200)
               .style("opacity", 1)
            key.selectAll(".key")
                .transition("opacity")
                .duration(200)
                .style("opacity", 1)
            g.selectAll("path.best-fit, text.correlation-group")
                .transition("opacity")
                .duration(200)
                .style("opacity", 1);
        } else {
            g.selectAll("circle.data-point")
            .transition("opacity")
            .duration(200)
            .style("opacity", 1);
        }  
    }

    // Add line of best fit
    const calculateRegression = (data: DataPoint[]) => {
        const n = data.length;
        const xValues = data.map(d => d[0]);
        const yValues = data.map(d => d[1]);
        
        const xMean = d3.mean(xValues) || 0;
        const yMean = d3.mean(yValues) || 0;

        const numerator = d3.sum(xValues.map((x, i) => (x - xMean) * (yValues[i] - yMean)));
        const denominator = d3.sum(xValues.map(x => (x - xMean) ** 2));
        
        const m = numerator / denominator;
        const b = yMean - m * xMean;
        
        const r = numerator / (Math.sqrt(denominator) * Math.sqrt(d3.sum(yValues.map(y => (y - yMean) ** 2))));
        
        return { m, b, r };
    };

    if (data.length > 1 && showRegression === "true") {
        if (groupBy) {

            // Group the data and calculate regression for each group
            let groups = data.map(d => JSON.stringify(getValue(fields, groupBy, d, xTable)));
            groups = Array.from(new Set(groups))
            const color = d3.scaleOrdinal().domain(groups).range(d3.schemeCategory10);

            const groupRegressions = groups.map(groupKey => {
                const groupData = data.filter(d => 
                    JSON.stringify(getValue(fields, groupBy, d, xTable)) === groupKey
                );
                const points = groupData.map(d => [
                    getValue(fields, xAxisProperty as string, d, xTable),
                    getValue(fields, yAxisProperty as string, d, yTable)
                ]) as DataPoint[];
                
                return {
                    ...calculateRegression(points),
                    groupKey: groupKey
                };
            });

            // Draw regression lines for each group
            const line = d3.line<[number, number]>()
                .x(d => x(d[0]))
                .y(d => y(d[1]));
            
            g.selectAll("path.best-fit")
                .data(groupRegressions, (d: any) => d.groupKey) // Object constancy
                .join("path")
                .attr("d", d => {
                    const xMin = x.domain()[0];
                    const xMax = x.domain()[1];
                    return line([
                        [xMin, d.m * xMin + d.b],
                        [xMax, d.m * xMax + d.b]
                    ]);
                })
                .attr("stroke", (d: any) => color(d.groupKey) as string)
                .attr("stroke-width", 2)
                .attr("fill", "none")
                .attr("class", "best-fit");
            
            g.selectAll("text.correlation-group")
                .data(groupRegressions, (d: any) => d.groupKey)
                .join(
                    enter => enter.append("text")
                        .attr("class", "correlation-group")
                        .attr("dominant-baseline", "middle"),
                    update => update,
                    exit => exit.remove()
                )
                .each(function(d) {
                    const xMin = x.domain()[0];
                    const xMax = x.domain()[1];
                    const lineStart = [xMin, d.m * xMin + d.b];
                    const lineEnd = [xMax, d.m * xMax + d.b];
                    
                    const [xStartPx, yStartPx] = [x(lineStart[0]), y(lineStart[1])];
                    const [xEndPx, yEndPx] = [x(lineEnd[0]), y(lineEnd[1])];
                    const dx = xEndPx - xStartPx;
                    const dy = yEndPx - yStartPx;
                    
                    const angleRad = Math.atan2(dy, dx);
                    const angleDeg = angleRad * 180 / Math.PI;
                    const textOffset = -60;
                    const hypothenuse = Math.hypot(dx, dy) != 0 ? Math.hypot(dx, dy) : 1
                    const textX = xEndPx + (dx / hypothenuse) * textOffset;
                    const textY = yEndPx + (dy / hypothenuse) * textOffset - 20;
    
                    d3.select(this)
                        .attr("x", textX)
                        .attr("y", textY)
                        .attr("transform", `rotate(${angleDeg},${textX},${textY})`)
                        .attr("text-anchor", dx < 0 ? "end" : "start")
                        .attr("fill", color(d.groupKey) as string)
                        .text(`r = ${d.r.toFixed(2)}`);
                });
        }
        else {
            // Draw line
            const allPoints = data.map(d => [getValue(fields, xAxisProperty as string, d, xTable), getValue(fields, yAxisProperty as string, d, yTable)]) as DataPoint[];
            const regression = calculateRegression(allPoints);
            const line = d3.line<[number, number]>().x(d => x(d[0])).y(d => y(d[1]));
            g
                .selectAll("path.best-fit")
                .data([regression])
                .join(
                    enter => enter.append("path")
                        .attr("class", "best-fit")
                        .attr("stroke", primary)
                        .attr("stroke-width", 2)
                        .attr("fill", "none")
                        .attr("d", d => {
                            const xMin = x.domain()[0];
                            const xMax = x.domain()[1];
                            return line([
                            [xMin, d.m * xMin + d.b],
                            [xMax, d.m * xMax + d.b]
                            ]);
                        }),
                    update => update
                        .attr("stroke", primary)
                        .attr("d", d => {
                            const xMin = x.domain()[0];
                            const xMax = x.domain()[1];
                            return line([
                            [xMin, d.m * xMin + d.b],
                            [xMax, d.m * xMax + d.b]
                            ]);
                        }),
                    exit => exit.remove()
                );

            // Get SVG coordinates of line endpoints
            const lineStart = [minX, regression.m * minX + regression.b];
            const lineEnd = [maxX, regression.m * maxX + regression.b];
            const [xStartPx, yStartPx] = [x(lineStart[0]), y(lineStart[1])];
            const [xEndPx, yEndPx] = [x(lineEnd[0]), y(lineEnd[1])];

            // Calculate angle in degrees
            const dx = xEndPx - xStartPx;
            const dy = yEndPx - yStartPx;
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = angleRad * 180 / Math.PI;

            // Position at line tip
            const textOffset = -60;
            const hypothenuse = Math.hypot(dx, dy) != 0 ? Math.hypot(dx, dy) : 1
            const textX = xEndPx + (dx / hypothenuse) * textOffset;
            const textY = yEndPx + (dy / hypothenuse) * textOffset - 20;
            g
                .selectAll("text.correlation")
                .data([regression])
                .join(
                enter => enter
                    .append("text")
                    .attr("x", textX)
                    .attr("y", textY)
                    .attr("transform", `rotate(${angleDeg},${textX},${textY})`)
                    .attr("text-anchor", dx < 0 ? "end" : "start")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", primary)
                    .text(`r = ${regression.r.toFixed(2)}`)
                    .attr("class", "correlation"),
                update => update
                    .attr("fill", primary)
                    .attr("x", textX)
                    .attr("y", textY)
                    .attr("transform", `rotate(${angleDeg},${textX},${textY})`)
                    .attr("text-anchor", dx < 0 ? "end" : "start")
                    .attr("dominant-baseline", "middle")
                    .text(d => `r = ${d.r.toFixed(2)}`),
                exit => exit.remove()
                );
        }
    }

    // Handle panning and zooming
    const initialX = x.copy();
    const initialY = y.copy();
    const zoomContainer = svg
        .select(".zoom-layer")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .style("fill", "none")
        .style("pointer-events", interactive ? "all" : "none")
        .lower();
    
    zoomContainer.on("wheel", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    zoomContainer.on('dblclick', () => {
        zoomRef.current = d3.zoomIdentity;        
        zoomContainer.transition("zoom").duration(500).call(zoom.transform as any, d3.zoomIdentity);
    });
    const zoom = d3
        .zoom()
        .on('start', () => {
            d3.select('body').style('overflow', 'hidden')
            // Temporarily disable interaction during zoom   
            g.selectAll("circle.data-point").style("pointer-events", "none");
            g.selectAll("circle.hover-area").style("pointer-events", "none");
            g.selectAll("text.correlation").style("pointer-events", "none");
            g.selectAll("text.correlation-group").style("pointer-events", "none");
            g.selectAll("path.best-fit").style("pointer-events", "none");
        })
        .on('end', () => {
            d3.select('body').style('overflow', 'auto')
            // Re-enable hover effects after zoom
            g.selectAll("circle.data-point").style("pointer-events", "all");
            g.selectAll("circle.hover-area").style("pointer-events", "all");
            g.selectAll("text.correlation").style("pointer-events", "all");
            g.selectAll("text.correlation-group").style("pointer-events", "all");
            g.selectAll("path.best-fit").style("pointer-events", "all");
        })
        .on('zoom', (event) => {

            event.sourceEvent?.preventDefault();
            event.sourceEvent?.stopPropagation();

            zoomRef.current = event.transform

            const newX = event.transform.rescaleX(initialX);
            const newY = event.transform.rescaleY(initialY);

            // Update axes
            const [newXTicks, newYTicks] = [
                generateTicks(newX.domain()[0], newX.domain()[1], 10, scaleX === "log"),
                generateTicks(newY.domain()[0], newY.domain()[1], 10, scaleY === "log")
            ]

            drawAxes("Scatter Plot", svg, dimensions, margins, newX, newY, newXTicks, newYTicks, reverseX, reverseY, xType, yType);

            // Update points
            g
                .selectAll("circle.data-point")
                .transition("zoom")
                .attr("cx", d => {
                    const value = getValue(fields, xAxisProperty as string, d as LogProps, xTable) as number;
                    return reverseX ? newX(Math.abs(value)) : newX(value);
                })
                .attr("cy", d => {
                    const value = getValue(fields, yAxisProperty as string, d as LogProps, yTable) as number;
                    return reverseY ? newY(Math.abs(value)) : newY(value);
                });

            // Update hover areas
            g   
                .selectAll("circle.hover-area")
                .transition("zoom")
                .attr("cx", d => {
                    const value = getValue(fields, xAxisProperty as string, d as LogProps, xTable) as number;
                    return reverseX ? newX(Math.abs(value)) : newX(value);
                })
                .attr("cy", d => {
                    const value = getValue(fields, yAxisProperty as string, d as LogProps, yTable) as number;
                    return reverseY ? newY(Math.abs(value)) : newY(value);
                });

            // Update regression lines
            if (showRegression === "true") {

                const line = d3.line<[number, number]>()
                    .x(d => newX(d[0]))
                    .y(d => newY(d[1]));
            
                // Find new minimum x and maximum x to use as the line ends and correlation text position
                const xMin = d3.min(data, d => getValue(fields, xAxisProperty as string, d, xTable));
                const xMax = d3.max(data, d => getValue(fields, xAxisProperty as string, d, xTable));                
                const [xStart, xEnd] = newX.domain();
                const constrainedXStart = Math.max(xStart, xMin);
                const constrainedXEnd = Math.min(xEnd, xMax);

                // Update regression lines
                g.selectAll("path.best-fit")
                    .transition("zoom")
                    .attr("d", (d: any) => {
                        return line([
                            [constrainedXStart, d.m * constrainedXStart + d.b],
                            [constrainedXEnd, d.m * constrainedXEnd + d.b]
                        ]);
                    });
            
                // Update correlation text
                g
                    .selectAll("text.correlation, text.correlation-group")
                    .transition("zoom")
                    .each(function(d: any) {

                        const lineStart = [xMin, d.m * xMin + d.b];
                        const lineEnd = [xMax, d.m * xMax + d.b];

                        const [xStartPx, yStartPx] = [newX(lineStart[0]), newY(lineStart[1])];
                        const [xEndPx, yEndPx] = [newX(lineEnd[0]), newY(lineEnd[1])];
                        const dx = xEndPx - xStartPx;
                        const dy = yEndPx - yStartPx;

                        const angleRad = Math.atan2(dy, dx);
                        const angleDeg = angleRad * 180 / Math.PI;
                        const textOffset = -60;
                        const hypothenuse = Math.hypot(dx, dy) != 0 ? Math.hypot(dx, dy) : 1
                        const textX = xEndPx + (dx / hypothenuse) * textOffset;
                        const textY = yEndPx + (dy / hypothenuse) * textOffset - 20;

                        d3.select(this)
                            .attr("x", textX)
                            .attr("y", textY)
                            .attr("transform", `rotate(${angleDeg},${textX},${textY})`)
                            .attr("text-anchor", dx < 0 ? "end" : "start");
                    });
            }
        });
    // Attach zoom transform to container and reapply previous zoom if exists
    zoomContainer.call(zoom as any);
    zoomContainer.call(zoom.transform as any, zoomRef.current);
};

export const drawHistogram = (
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    scaleX: string,
    scaleY: string,
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    axisPadding: number,
    selectedXAxisProperty: string | undefined,
    groupByProperty: string | undefined,
    aggregateProperty: string | undefined,
    binCount: number,
    setbinCount: (binCount: string) => void,
    binCounts: number[],
    setbinCounts: (binCounts: number[]) => void,
    table: string,
    logs: LogProps[],
    fields: LogFieldsResponseProps,
) => {

    // Remove drawings from previous plots
    const g = svg.select(".plotData")
    g.selectAll("circle.data-point").remove();
    g.selectAll("circle.hover-area").remove();
    g.selectAll("path.line-item").remove();
    g.selectAll("rect.bar-item").remove();
    g.selectAll("text.correlation").remove();
    g.selectAll("text.correlation-group").remove();
    g.selectAll("path.best-fit").remove();
    container.select(".groupingKey")

    // Prepare data
    let data : DataRange | GroupedDataRange = [];
    const properties = Object
        .entries(fields)
        .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int" || data_type === "timestamp" || data_type === "time" || data_type === "timedelta" || data_type === "date" || data_type === "bool"))
        .map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties.at(0);
    let xType : string | undefined;
    if (xAxisProperty) {
        xType = fields[xAxisProperty].data_type
        const filteredData = logs.filter((log) => {
            const hasX = hasProperty(fields, xAxisProperty, log, table)
            const hasGroup = groupByProperty ? hasProperty(fields, groupByProperty, log, table) : true;
            return hasX && hasGroup
        });
        if (groupByProperty) {
            data = d3
            .groups(filteredData, d => getValue(fields, groupByProperty, d, table))
            .map(([group, values]) => ([group, values.map(log => getValue(fields, xAxisProperty, log, table))])
            ) as GroupedDataRange;
        }
        else {
            data = filteredData.map((log) => 
                getValue(fields, xAxisProperty, log, table)
            ) as DataRange
        }
    }

    // Define scales
    const [width, height] = [dimensions.width, dimensions.height];
    const [xRange, yRange] = [
        [margins.left, width - margins.right],
        [height - margins.bottom, margins.top + 2 * axisPadding]
    ];
    const xValues = groupByProperty 
    ? (data as GroupedDataRange).flatMap(d => d[1])
    : (data as DataRange)
    const [minX = 0, maxX = 0] = d3.extent(xValues);
    const [xScale, yScale] = [d3.scaleLinear, d3.scaleLinear]
    const x = xScale().domain([minX, maxX]).range(xRange)
    
    // Set bins
    const step = (maxX - minX)/binCount 
    const thresholds = d3.range(minX, maxX, step)
    const binGenerator = d3.bin().domain([minX, maxX]).thresholds(thresholds);
    const buckets: d3.Bin<number, number>[] | GroupedBin[] = groupByProperty
    ? (data as GroupedDataRange).flatMap(([group, values]) => {
        const binsArray: d3.Bin<number, number>[] = binGenerator(values);    
        const groupedBinsForThisGroup: GroupedBin[] = binsArray.map(bin => {
            const groupedBin = bin as GroupedBin; // Assert the type
            groupedBin.group = group;           // Add the property
            return groupedBin;                  // Return the modified bin
        });    
        return groupedBinsForThisGroup;
    })
    : binGenerator(data as number[]);
    if (binCounts[1] != data.length) {
        const newBinCounts = [1, data.length]
        setbinCounts(newBinCounts)
        if (data.length > 0 && binCount === 0) {
            const newCount = Math.min(10, data.length);
            setbinCount(newCount.toString());
        }
        return;
    }
    if (binCount > binCounts[1]) {
        const count = Math.min(10, data.length)
        setbinCount(count.toString())
        return;
    }

    const [minY, maxY] = [0, d3.max(buckets, d => d.length) ?? 0]
    const y = yScale().domain([minY, maxY]).range(yRange)

    // Draw axes
    const [xTicks, yTicks] = [
        generateTicks(minX, maxX, 10, scaleX === "log"),
        generateTicks(minY, maxY, 10, scaleY === "log")
    ]
    drawAxes("Histogram", svg, dimensions, margins, x, y, xTicks, yTicks, false, false, xType);

    // Tooltip and grouping key
    const tooltip = container.select(".plotTooltip").style("opacity", 0);
    const key = settings.select(".groupingKey");

    // Add histogram
    const initialOpacity = groupByProperty ? 0.7 : 1.0;
    if (groupByProperty) {
        const groupDomain = Array.from(new Set((buckets as GroupedBin[]).map(d => d.group)))
        const colorScale = d3.scaleOrdinal<string>(d3.schemeCategory10).domain(groupDomain);
        const bars = g
        .selectAll("rect.hist-item")
        .data((buckets as GroupedBin[]), (d) => `${(d as GroupedBin).group}-${(d as GroupedBin).x0}-${(d as GroupedBin).x1}`); // Use bin boundaries as key
        const enteringBars = bars
            .enter()
            .append("rect")
            .attr("class", "hist-item")
            .attr("fill", d => colorScale(d.group))
            .attr("x", d => x(d.x0 as number))
            .attr("width", d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
            .attr("y", y(0)) // Start at base
            .attr("height", 0) // Start with 0 height
            .style("opacity", initialOpacity)
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => hoverOnHist(event, d))
            .on("mousemove", (event, d) => moveOnHist(event, d))
            .on("mouseout", (event, d) => leaveHist(event, d))
            .on("click", (event, d) => showFixedTooltip(event, getTooltipData(d)));
        enteringBars
            .merge(bars as any)
            .transition("enter")
            .duration(500)
            .attr("fill", d => colorScale(d.group))
            .attr("x", d => x(d.x0 as number))
            .attr("width", d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
            .attr("y", d => y(d.length))
            .attr("height", d => y(0) - y(d.length))
            .style("opacity", initialOpacity);
        bars.exit()
            .transition("exit")
            .duration(500)
            .attr("y", y(0))
            .attr("height", 0)
            .remove();

        // Grouping Key
        const colors: GroupingColors = groupDomain.map(groupKey => ({key: groupKey, color: colorScale(groupKey)}));
        key.html(keyTemplate(colors)).style("opacity", 1);
        key
            .selectAll(".key")
            .on("mouseover", (event: MouseEvent) => {
                const target = event.currentTarget as HTMLElement;
                const groupKey = target.id;
                g.selectAll("rect.hist-item")
                 .transition("opacity")
                 .duration(200)
                 .style("opacity", d => { return (d as GroupedBin).group === groupKey ? 1 : 0 });
                key.selectAll(".key")
                   .transition("opacity").duration(200)
                   .style("opacity", function() { return (this as any).id === groupKey ? 1 : 0.3; });
            })
            .on("mouseout", () => {
                g.selectAll("rect.hist-item")
                 .transition("opacity")
                 .duration(200)
                 .style("opacity", initialOpacity);
                key.selectAll(".key")
                   .transition("opacity")
                   .duration(200)
                   .style("opacity", 1);
            });
    }
    else {
        const primary = getPrimaryColorFromNode(svg.node());
        const bars = g
        .selectAll("rect.hist-item")
        .data((buckets as d3.Bin<number, number>[]), (d: any) => `${d.x0}-${d.x1}`); // Use bin boundaries as key
        bars.join(
            enter => enter
                .append("rect")
                .attr("class", "hist-item")
                .attr("fill", primary)
                .attr("x", d => x(d.x0 as number))
                .attr("width", d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
                .attr("y", y(0)) // Start at base
                .attr("height", 0) // Start with 0 height
                .style("opacity", initialOpacity)
                .style("cursor", "pointer")
                .on("mouseover", (event, d) => hoverOnHist(event, d))
                .on("mousemove", (event, d) => moveOnHist(event, d))
                .on("mouseout", (event, d) => leaveHist(event, d))
                .on("click", (event, d) => showFixedTooltip(event, getTooltipData(d)))
                .call(enter => enter.transition("enter").duration(500)
                    .attr("y", d => y(d.length))
                    .attr("height", d => y(0) - y(d.length))
                ),
            update => update
                .attr("fill", primary)
                .call(update => update.transition("update").duration(500)
                    .attr("x", d => x(d.x0 as number))
                    .attr("width", d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
                    .attr("y", d => y(d.length))
                    .attr("height", d => y(0) - y(d.length))
                ),
            exit => exit
                .call(exit => exit.transition("exit").duration(500)
                    .attr("y", y(0))
                    .attr("height", 0)
                    .remove()
                )
        );
    }

    // Add mouse event handlers
    const getTooltipData = (bin: d3.Bin<number, number> | GroupedBin) => {
        const [localMinX, localMaxX] = groupByProperty // Compute group boundaries if group by is set
        ? d3.extent((data as GroupedDataRange).filter(d => d[0] === (bin as GroupedBin).group).flatMap(d => d[1]) as DataRange)
        : [minX, maxX]
        const hoverData : InfoCardData = {
            group: {
              name: "Data Range",
              value: (xType === "timestamp" || xType === "timedelta" || xType === "time" || xType === "date")
                  ? `${groupByProperty ? "Group: " + (bin as GroupedBin).group + ", " : ""}Min: ${formatTimeTypeValue(localMinX as number, xType)}, Max: ${formatTimeTypeValue(localMaxX as number, xType)}`
                  : `${groupByProperty ? "Group: " + (bin as GroupedBin).group + ", " : ""}Min: ${formatNumber(minX)}, Max: ${formatNumber(maxX)}`
            },
            x: {
              name: "Bar Range",
              value: (xType === "timestamp" || xType === "timedelta" || xType === "time" || xType === "date")
                ? `${formatTimeTypeValue(bin.x0!, xType)} - ${formatTimeTypeValue(bin.x1!, xType)}`
                : `${formatNumber(bin.x0!)} - ${formatNumber(bin.x1!)}`
            },
            y: {
              name: "Bar Count",
              value: bin.length
            }
        };
        if (aggregateProperty) {
            hoverData.aggregate = {
                name: `Aggregate: ${aggregateProperty}`,
            }
        }
        return hoverData        
    }
    function hoverOnHist(event: any, bin: d3.Bin<number, number> | GroupedBin) {

        tooltip.html(tooltipTemplate(getTooltipData(bin))).transition("opacity").style("opacity", 1);
        positionTooltip(event, tooltip);

        g.selectAll("rect.hist-item")
         .filter((d: any) => groupByProperty
            ? d.group !== (bin as GroupedBin).group
            : d.x0 !== bin.x0 || d.x1 !== bin.x1
         )
         .transition("opacity")
         .duration(200)
         .style("opacity", 0.5);
        if (groupByProperty) {
            key.selectAll(".key")
                .transition("opacity")
                .duration(200)
                .style("opacity", function() { return (this as any).id === (bin as GroupedBin).group ? 1 : 0.3; });
        }
      }

      function moveOnHist(event: any, bin: d3.Bin<number, number>) {
        positionTooltip(event, tooltip);
      }
      
      function leaveHist(event: any, bin: d3.Bin<number, number>) {
        tooltip
          .transition("opacity")
          .style("opacity", 0);
        g.selectAll("rect.hist-item")
          .transition("opacity")
          .duration(200)
          .style("opacity", initialOpacity);
        if (groupByProperty) {
            key.selectAll(".key").transition("opacity").duration(200).style("opacity", 1);
        }
    }
};