"use client";

import * as d3 from "d3";
import { LogProps, LogFieldsResponseProps } from "@/types/interfaces/logs";
import { DataPoint, InfoCardData } from "@/types/interfaces/plot";
import { formatTimeTypeValue } from "../format";
import { getValue, hasProperty } from "./data";
import { drawAxes, generateTicks, reverseOrKeepDomain } from "./axes";
import { getPrimaryColorFromNode } from "./common";
import { renderGroupingKey } from "./key";
import { showFixedTooltip, tooltipTemplate, positionTooltipRelativeToPointer, positionTooltipRelativeToDatapoint } from "./tooltip";

const getTooltipData = (
    data: LogProps, 
    fields: LogFieldsResponseProps, 
    groupBy: string | undefined, 
    aggregate: string | undefined, 
    xTable: string, 
    yTable: string, 
    selectedXAxisProperty: string | undefined, 
    selectedYAxisProperty: string | undefined, 
    xType: string | undefined,
    yType: string | undefined
) => {
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

function onMouseOver (
    event: MouseEvent,
    hoveredDatum: LogProps,
    fields: LogFieldsResponseProps,
    groupBy: string | undefined,
    aggregate: string | undefined,
    xTable: string,
    yTable: string,
    selectedXAxisProperty: string | undefined,
    selectedYAxisProperty: string | undefined,
    xType: string | undefined,
    yType: string | undefined,
    g: d3.Selection<d3.BaseType, unknown, null, undefined>,
    tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    showRegression: string
) {
    // For hover, get data for the single hoveredDatum
    const tooltipDataSingle = getTooltipData(
        hoveredDatum, fields, groupBy, aggregate, xTable, yTable,
        selectedXAxisProperty, selectedYAxisProperty, xType, yType
    );

    const template = tooltipTemplate(tooltipDataSingle); // tooltipTemplate expects single
    tooltip
        .html(template)
        .style("opacity", 1);
    positionTooltipRelativeToPointer(event, tooltip, container);

    const containerNode = container.node();
    if (containerNode) {
        const setHoveredLog = (containerNode as any).__setHoveredLog;
        setHoveredLog(hoveredDatum[`${xTable}.id`]);
    }

    // Highlight the single hovered point strongly, dim others
    const hoveredId = hoveredDatum[`${xTable}.id`];

    g.selectAll<SVGCircleElement, LogProps>("circle.data-point")
        .transition("hover_effect")
        .duration(150)
        .attr("r", d => d[`${xTable}.id`] === hoveredId ? 5 : 3)
        .style("opacity", d => d[`${xTable}.id`] === hoveredId ? 1 : 0.2);

    if (showRegression === "true") {
        if (groupBy) {
            const hoveredGroup = JSON.stringify(getValue(fields, groupBy, hoveredDatum, xTable));
            g.selectAll("path.best-fit")
                .style("opacity", (d: any) => d.groupKey === hoveredGroup ? 1 : 0.1);
            g.selectAll("text.correlation-group")
                .style("opacity", (d: any) => d.groupKey === hoveredGroup ? 1 : 0.1);
        } else {
             g.selectAll("path.best-fit").style("opacity", 1);
             g.selectAll("text.correlation").style("opacity", 1);
        }
    }
}

function onMouseMove(
    event: any,
    tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>
) {
    positionTooltipRelativeToPointer(event, tooltip, container);
}

function onMouseOut (
    g: d3.Selection<d3.BaseType, unknown, null, undefined>,
    tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    showRegression: string
) {
    tooltip.style("opacity", 0);
    g.selectAll("circle.data-point")
        .transition("hover_effect_out")
        .duration(150)
        .attr("r", 3) // Reset radius
        .style("opacity", 1); // Reset opacity

     if (showRegression === "true") {
         g.selectAll("path.best-fit").style("opacity", 1);
         g.selectAll("text.correlation, text.correlation-group").style("opacity", 1);
     }

    const containerNode = container.node();
    if (containerNode) {
        const setHoveredLog = (containerNode as any).__setHoveredLog;
        setHoveredLog(undefined);
    }
}

function onClick (
    event: MouseEvent,
    clickedDatum: LogProps, // The topmost datum clicked
    allPlotData: LogProps[], // All data currently in the plot (sampled or full)
    fields: LogFieldsResponseProps,
    groupBy: string | undefined,
    aggregate: string | undefined,
    xTable: string,
    yTable: string,
    selectedXAxisProperty: string | undefined,
    selectedYAxisProperty: string | undefined,
    xType: string | undefined,
    yType: string | undefined,
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>
) {
    const overlappingPoints = findAllPointsAtCoordinates(
        clickedDatum,
        allPlotData,
        fields,
        selectedXAxisProperty!,
        selectedYAxisProperty!,
        xTable,
        yTable
    );

    let dataForFixedTooltip: InfoCardData | InfoCardData[];
    if (overlappingPoints.length > 1) {
        dataForFixedTooltip = overlappingPoints.map(p =>
            getTooltipData(p, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType)
        );
    } else {
        dataForFixedTooltip = getTooltipData(clickedDatum, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType);
    }
    showFixedTooltip(event, dataForFixedTooltip, settings);
}

function onZoomStart (
    g: d3.Selection<d3.BaseType, unknown, null, undefined>
) {
    d3.select('body').style('overflow', 'hidden')
    // Temporarily disable interaction during zoom   
    g.selectAll("circle.data-point").style("pointer-events", "none");
    g.selectAll("circle.hover-area").style("pointer-events", "none");
    g.selectAll("text.correlation").style("pointer-events", "none");
    g.selectAll("text.correlation-group").style("pointer-events", "none");
    g.selectAll("path.best-fit").style("pointer-events", "none");
}

function onZoomEnd (
    g: d3.Selection<d3.BaseType, unknown, null, undefined>
) {
    d3.select('body').style('overflow', 'auto')
    // Re-enable hover effects after zoom
    g.selectAll("circle.data-point").style("pointer-events", "all");
    g.selectAll("circle.hover-area").style("pointer-events", "all");
    g.selectAll("text.correlation").style("pointer-events", "all");
    g.selectAll("text.correlation-group").style("pointer-events", "all");
    g.selectAll("path.best-fit").style("pointer-events", "all");
}

function onZoom (
    event: any,
    zoomRef: any,
    containerRef: any,
    initialX: d3.ScaleLinear<number, number, never>,
    initialY: d3.ScaleLinear<number, number, never>,
    scaleX: string,
    scaleY: string,
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    dimensions: { width: number; height: number},
    margins: { [key: string]: number },
    reverseX: boolean,
    reverseY: boolean,
    xAxisProperty: string | undefined,
    yAxisProperty: string | undefined,
    xType: string | undefined,
    yType: string | undefined,
    xTable: string,
    yTable: string,
    showRegression: string,
    data: LogProps[],
    fields: LogFieldsResponseProps,
    g: d3.Selection<d3.BaseType, unknown, null, undefined>,
) {
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

    drawAxes("Scatter Plot", svg, dimensions, margins, newX, newY, newXTicks, newYTicks, reverseX, reverseY, xAxisProperty, yAxisProperty, xType, yType);

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

    // Re-run the global hover logic check after zoom changes positions
    // This ensures tooltips reposition correctly during/after zoom
    if (containerRef.current) {
        const hoveredLog = containerRef.current.__hoveredLog;
        const currentTooltip = container.select<HTMLDivElement>(".plotTooltip"); // Get tooltip selection

        if (hoveredLog && currentTooltip.node()) { // Check if tooltip exists
            const hoveredData = data.find(d => d[`${xTable}.id`] === hoveredLog);
            if (hoveredData) {
                 const targetElem = g
                    .selectAll<SVGCircleElement, LogProps>("circle.data-point")
                    .filter(d => d[`${xTable}.id`] === hoveredLog)
                    .node();

                // Check if the tooltip element exists AND is currently meant to be visible
                if (targetElem && parseFloat(currentTooltip.style("opacity")) > 0) {
                     // Position the tooltip using the transform from the current zoom event
                    positionTooltipRelativeToDatapoint(targetElem, currentTooltip, container, svg, event.transform);
                }
            } else {
                // If hovered data not found (e.g., filtered out during zoom), hide tooltip
                if (parseFloat(currentTooltip.style("opacity")) > 0) {
                    currentTooltip.style("opacity", 0); // Optionally hide if data vanishes
                }
            }
        } else {
             // No log hovered or tooltip node doesn't exist, ensure opacity is 0
             if (currentTooltip.node() && parseFloat(currentTooltip.style("opacity")) > 0) {
                currentTooltip.style("opacity", 0); // Optionally hide
             }
        }
    }
}
        
/**
 * Calculates the linear regression parameters (slope, y-intercept) and the correlation coefficient (r)
 * for a given set of data points using the least squares method.
 *
 * @param {Array<[number, number]>} data An array of data points, where each inner array represents a point [x, y].
 * @returns {{m: number, b: number, r: number}} An object containing the slope (m), y-intercept (b),
 *                                              and Pearson correlation coefficient (r) of the regression line.
 *                                              Returns { m: NaN, b: NaN, r: NaN } if calculation is not possible (e.g., denominator is zero).
*/
const calculateRegression = (data: DataPoint[]) => {

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

/**
 * Extracts a random subset of a specified size from an array.
 * Uses the Fisher-Yates (Knuth) shuffle algorithm to ensure randomness.
 *
 * @param {any[]} arr - The original array.
 * @param {number} size - The desired number of elements in the subset.
 * @returns {any[]} A new array containing the random subset. If size is greater than
 * the original array length, a shuffled copy of the original array is returned.
 */
export function sampleData(arr: any[], size: number) {
    let shuffled = arr.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, size);
}

/**
 * Scan through logs data to find all points 
 * overlapping with the hovered data point.
 *
 * @param {LogProps} targetDatum - The hovered log.
 * @param {LogProps[]} allPlotData - All plotted logs.
 * @param {LogFieldsResponseProps[]} fields - Log fields containing field metadata.
 * @param {string} xAxisProperty - The x axis field.
 * @param {string} yAxisProperty - The y axis field.
 * @param {string} xTable - The table from which the x axis is populated.
 * @param {string} yTable - The table from which the y axis is populated.
 * @returns {LogProps[]} A list of logs corresponding to the overlapping points
 */
function findAllPointsAtCoordinates(
    targetDatum: LogProps,
    allPlotData: LogProps[],
    fields: LogFieldsResponseProps,
    xAxisProperty: string,
    yAxisProperty: string,
    xTable: string,
    yTable: string
): LogProps[] {
    const targetX = getValue(fields, xAxisProperty, targetDatum, xTable);
    const targetY = getValue(fields, yAxisProperty, targetDatum, yTable);

    if (targetX === undefined || targetY === undefined) {
        return [targetDatum]; // Or empty array if target itself is invalid
    }

    return allPlotData.filter(p => {
        const currentX = getValue(fields, xAxisProperty, p, xTable);
        const currentY = getValue(fields, yAxisProperty, p, yTable);
        return currentX === targetX && currentY === targetY;
    });
}

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
  containerRef: any,
  zoomRef: any,
  groupByColors: string = "schemeCategory10",
  interactive: boolean = true,
  zoomEnabled: boolean = false
) => {

    // --- Define containers ---
    const g = svg.select(".plotData")
    const zoomContainer = svg.select(".zoom-layer")
    const tooltip = container.select<HTMLDivElement>(".plotTooltip").style("opacity", 0)

    // --- Remove drawings from previous plots ---
    g.selectAll("path.line-item").remove();
    g.selectAll("rect.bar-item").remove();
    g.selectAll("rect.hist-item").remove();
    g.selectAll("text.correlation-group").remove();
    g.selectAll("text.correlation").remove();
    if (showRegression != "true") g.selectAll("path.best-fit").remove()

    // --- Prepare data ---
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
        data = data?.length > 1000 ? sampleData(data, 1000) : data
    }

    // --- Set scales and axes ---
    const [width, height] = [dimensions.width, dimensions.height];
    const [xValues, yValues] = [
        data.map(d => getValue(fields, xAxisProperty as string, d, xTable) as number),
        data.map(d => getValue(fields, yAxisProperty as string, d, yTable) as number)
    ]
    const [[minX = 0, maxX = 0], [minY = 0, maxY = 0]] = [d3.extent(xValues), d3.extent(yValues)];
    const [xScaleFn, yScaleFn] = [ 
        scaleX === "log" ? d3.scaleLog : d3.scaleLinear, 
        scaleY === "log" ? d3.scaleLog : d3.scaleLinear 
    ];
    const [reverseX, reverseY] = [
        scaleX === "log" && xValues.every(v => v < 0),
        scaleY === "log" && yValues.every(v => v < 0)
    ];
    const [xDomain, yDomain] = [
        reverseOrKeepDomain(xValues, [minX, maxX], reverseX), 
        reverseOrKeepDomain(yValues, [minY, maxY], reverseY) 
    ];
    const [xRange, yRange] = [ 
        [margins.left + axisPadding, width - margins.right - axisPadding], 
        [height - margins.bottom - axisPadding, margins.top + axisPadding] 
    ];
    const [ initialX, initialY ] = [ 
        xScaleFn().domain(xDomain).range(xRange), 
        yScaleFn().domain(yDomain).range(yRange)
    ];
    const currentTransform = zoomRef.current;
    const x = currentTransform.rescaleX(initialX);
    const y = currentTransform.rescaleY(initialY);
    const [xTicks, yTicks] = [
        generateTicks(minX, maxX, 10, scaleX === "log"),
        generateTicks(minY, maxY, 10, scaleY === "log")
    ]
    drawAxes("Scatter Plot", svg, dimensions, margins, x, y, xTicks, yTicks, reverseX, reverseY, xAxisProperty, yAxisProperty, xType, yType);

    // --- Define color schemes and handle grouping key ---
    const primary = getPrimaryColorFromNode(svg.node());
    const colorRange = d3[groupByColors as keyof typeof d3] as readonly string[];
    let color = d3.scaleOrdinal<string>().range(colorRange);
    if (groupBy) {
        let domain = data.map(d => JSON.stringify(getValue(fields, groupBy, d, xTable)));
        domain = Array.from(new Set(domain));
        color.domain(domain);
        const colors = domain.map((key) => ({ key: key, color: color(key) as string }));
        renderGroupingKey(settings, colors); 
    } else {
        renderGroupingKey(settings, null);
    }

    // --- Add points and hover areas ---
    const points = g
        .selectAll("circle.data-point")
        .data(data, (d: unknown) => (d as LogProps)[`${xTable}.id`] as string); // Use unique identifier to track point transitions
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
            .on("mouseover", (event, d_datum) => onMouseOver(
                event, d_datum, fields, groupBy, aggregate, xTable, yTable,
                selectedXAxisProperty, selectedYAxisProperty, xType, yType,
                g, tooltip, container, showRegression
            ))
            .on("mousemove", (event, _) => onMouseMove(event, tooltip, container))
            .on("mouseout", (event, d_datum) => onMouseOut(g, tooltip, container, showRegression))
            .on("click", (event, d_datum) => onClick(
                event, d_datum, data, fields, groupBy, aggregate, xTable, yTable,
                selectedXAxisProperty, selectedYAxisProperty, xType, yType, settings
            ))
            .call(
                enter => enter.transition("enter").duration(200).style("opacity", 1)),
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
    g
        .selectAll("circle.hover-area")
        .data(data)
        .join("circle")
        .style("cursor", "pointer")
        .on("mouseover", (event, d_datum) => onMouseOver(
            event, d_datum, fields, groupBy, aggregate, xTable, yTable,
            selectedXAxisProperty, selectedYAxisProperty, xType, yType,
            g, tooltip, container, showRegression
        ))
        .on("mousemove", (event, _) => onMouseMove(event, tooltip, container))
        .on("mouseout", (event, d_datum) => onMouseOut(g, tooltip, container, showRegression))
        .on("click", (event, d_datum) => onClick(
            event, d_datum, data, fields, groupBy, aggregate, xTable, yTable,
            selectedXAxisProperty, selectedYAxisProperty, xType, yType, settings
        ))
        .attr("cx", d => x(reverseX ? Math.abs(getValue(fields, xAxisProperty as string, d, xTable) as number) : getValue(fields, xAxisProperty as string, d, xTable) as number))
        .attr("cy", d => y(reverseY ? Math.abs(getValue(fields, yAxisProperty as string, d, yTable) as number) : getValue(fields, yAxisProperty as string, d, yTable) as number))
        .attr("r", 10)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .style("pointer-events", "all")
        .attr("class", "hover-area");

    // --- Add line of best fit ---
    if (data.length > 1 && showRegression === "true") {
        if (groupBy) {

            // Group the data and calculate regression for each group
            let groups = data.map(d => JSON.stringify(getValue(fields, groupBy, d, xTable)));
            groups = Array.from(new Set(groups))
            const color = d3.scaleOrdinal().domain(groups).range(colorRange);

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

    // --- Setup Zoom Behavior ---
    zoomContainer
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .on("wheel", (event) => {
        event.preventDefault();
        event.stopPropagation();
        })
        .on('dblclick', () => {
        zoomRef.current = d3.zoomIdentity;        
        zoomContainer.transition("zoom").duration(500).call(zoom.transform as any, d3.zoomIdentity);
        })
        .style("fill", "none")
        .style("pointer-events", interactive && zoomEnabled ? "all" : "none")
        .lower()
    const zoom = d3
        .zoom()
        .on('start', () => onZoomStart(g))
        .on('end', () => onZoomEnd(g))
        .on('zoom', (event) => onZoom(event, zoomRef, containerRef, initialX, initialY, scaleX, scaleY, svg, container, dimensions, margins, reverseX, reverseY, xAxisProperty, yAxisProperty, xType, yType, xTable, yTable, showRegression, data, fields, g));
    zoomContainer.call(zoom as any);
    zoom.transform(zoomContainer as any, currentTransform);

    // --- Synchronize hover tooltip across plots ---
    const containerNode = container.node();    
    if (containerNode && interactive) {
        const hoveredLog = (containerNode as any).__hoveredLog;
    
        if (hoveredLog) {
            const hoveredLogData = data.find(d => d[`${xTable}.id`] === hoveredLog);
    
            if (hoveredLogData) {
                const targetSelection = g.selectAll<SVGCircleElement, LogProps>("circle.data-point").filter(d => d[`${xTable}.id`] === hoveredLog);
                const targetNode = targetSelection.node();
    
                // --- If data point exists in this plot ---
                if(targetNode) {
                    const dataValueX = getValue(fields, xAxisProperty as string, hoveredLogData, xTable) as number;
                    const dataValueY = getValue(fields, yAxisProperty as string, hoveredLogData, yTable) as number;
    
                    // Calculate screen coordinates using the *current* scales
                    const targetScreenX = x(reverseX ? Math.abs(dataValueX) : dataValueX);
                    const targetScreenY = y(reverseY ? Math.abs(dataValueY) : dataValueY);
    
                    const isOffScreen = targetScreenX < xRange[0] || targetScreenX > xRange[1] || targetScreenY > yRange[0] || targetScreenY < yRange[1];
    
                    // --- Prepare Tooltip and Highlighting (Always do this if point exists) ---
                    const tooltipData = getTooltipData(hoveredLogData, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType);
                    const template = tooltipTemplate(tooltipData);
                    tooltip.html(template).style("opacity", 1); // Make tooltip visible NOW
    
                    // Highlight the point
                    targetSelection
                        .classed("hovered-point", true)
                        .transition("emphasize_point")
                        .duration(250)
                        .attr("r", 5)
                        .style("opacity", 1);
    
                    // --- Dimming Logic ---
                     if (groupBy) {
                         const hoveredGroupValue = getValue(fields, groupBy, hoveredLogData, xTable);
                         const stringifiedHoveredGroup = JSON.stringify(hoveredGroupValue);
    
                         g.selectAll<SVGCircleElement, LogProps>("circle.data-point:not(.hovered-point)")
                             .filter(d => JSON.stringify(getValue(fields, groupBy, d, xTable)) !== stringifiedHoveredGroup)
                             .transition("dim_other_groups")
                             .duration(200)
                             .style("opacity", 0.2);
                         g.selectAll<SVGCircleElement, LogProps>("circle.data-point:not(.hovered-point)")
                             .filter(d => JSON.stringify(getValue(fields, groupBy, d, xTable)) === stringifiedHoveredGroup)
                             .transition("undim_same_group")
                             .duration(200)
                             .style("opacity", 0.7);
    
                         if (showRegression === "true") {
                             g.selectAll<SVGPathElement, any>("path.best-fit")
                                 .filter(d => d.groupKey !== stringifiedHoveredGroup)
                                 .transition("dim_other_fits")
                                 .duration(200)
                                 .style("opacity", 0.2);
                             g.selectAll<SVGTextElement, any>("text.correlation-group")
                                 .filter(d => d.groupKey !== stringifiedHoveredGroup)
                                 .transition("dim_other_corr_text_g")
                                 .duration(200)
                                 .style("opacity", 0.2);
                             g.selectAll<SVGPathElement, any>("path.best-fit")
                                  .filter(d => d.groupKey === stringifiedHoveredGroup)
                                  .transition("undim_same_fit")
                                  .duration(200)
                                  .style("opacity", 1);
                              g.selectAll<SVGTextElement, any>("text.correlation-group")
                                  .filter(d => d.groupKey === stringifiedHoveredGroup)
                                  .transition("undim_same_corr_text_g")
                                  .duration(200)
                                  .style("opacity", 1);
                         }
                     } else {
                         g.selectAll<SVGCircleElement, LogProps>("circle.data-point:not(.hovered-point)")
                             .transition("dim_others_no_group")
                             .duration(200)
                             .style("opacity", 0.2);
                         if (showRegression === "true") {
                               g.selectAll("path.best-fit")
                                   .transition("undim_single_fit")
                                   .duration(200)
                                   .style("opacity", 1);
                               g.selectAll("text.correlation")
                                   .transition("undim_single_corr_text")
                                   .duration(200)
                                   .style("opacity", 1);
                         }
                    }
    
                    // --- Pan or Position Tooltip ---
                    if (isOffScreen) {
                        // --- Calculate target transform ---
                        const centerX = (xRange[0] + xRange[1]) / 2;
                        const centerY = (yRange[1] + yRange[0]) / 2;
                        const k = currentTransform.k;
                        const dx = centerX - targetScreenX;
                        const dy = centerY - targetScreenY;
                        const targetTransform = d3.zoomIdentity
                            .translate(currentTransform.x + dx, currentTransform.y + dy)
                            .scale(k);
    
                        // --- Temporarily detach zoom listener ---
                        zoomContainer.on('zoom', null);

                        // Interrupt any ongoing zoom/pan before starting new one
                        zoomContainer.interrupt("pan_to_hover");    
                        zoomContainer
                            .transition("pan_to_hover")
                            .duration(500)
                            .call(zoom.transform as any, targetTransform)
                            .on("end", () => {
                                // --- Animation finished ---
                                // 1. Update zoomRef to the final state
                                const finalTransform = d3.zoomTransform(zoomContainer.node()! as any);
                                zoomRef.current = finalTransform; // Update ref

                                // 2. Re-attach the zoom listener
                                    zoomContainer.on('zoom', (event) => onZoom(event, zoomRef, containerRef, initialX, initialY, scaleX, scaleY, svg, container, dimensions, margins, reverseX, reverseY, xAxisProperty, yAxisProperty, xType, yType, xTable, yTable, showRegression, data, fields, g));

                                // 3. Position the tooltip using the final state
                                // Verify hover state hasn't changed during animation
                                const currentHoveredLog = (containerNode as any).__hoveredLog;
                                if (currentHoveredLog === hoveredLog) {
                                    const finalTargetSelection = g
                                        .selectAll<SVGCircleElement, LogProps>("circle.data-point")
                                        .filter(d => d[`${xTable}.id`] === hoveredLog);
                                    const finalTargetNode = finalTargetSelection.node();    
                                    if (finalTargetNode) {
                                        // --- Recalculate scales based on finalTransform ---
                                        const finalXScale = finalTransform.rescaleX(initialX);
                                        const finalYScale = finalTransform.rescaleY(initialY);

                                        // --- Calculate final SVG coordinates using NEW scales ---
                                        const finalSvgX = finalXScale(reverseX ? Math.abs(dataValueX) : dataValueX);
                                        const finalSvgY = finalYScale(reverseY ? Math.abs(dataValueY) : dataValueY);

                                        // --- Convert final SVG coordinates to container coordinates ---
                                        const svgNode =  svg.node();
                                        const svgRect = (svgNode as any).getBoundingClientRect();
                                        const containerRect = containerNode.getBoundingClientRect();
                                        const finalContainerX = finalSvgX + (svgRect.left - containerRect.left);
                                        const finalContainerY = finalSvgY + (svgRect.top - containerRect.top);

                                        // --- Position Tooltip using calculated container coordinates ---
                                        const tooltipNode = tooltip.node();
                                        if(tooltipNode) {
                                            tooltip.style("opacity", 1);
                                            const tooltipRect = (tooltipNode as any).getBoundingClientRect();
                                            const tooltipWidth = tooltipRect.width;
                                            const tooltipHeight = tooltipRect.height;
                                            const offsetX = 15;
                                            const offsetY = 15;
                                            const containerWidth = containerRect.width;
                                            const containerHeight = containerRect.height;

                                            let xPos = finalContainerX + offsetX;
                                            let yPos = finalContainerY + offsetY;

                                            // Adjust position based on container boundaries
                                            if (xPos + tooltipWidth > containerWidth) { xPos = finalContainerX - tooltipWidth - offsetX; }
                                            if (xPos < 0) { xPos = offsetX; }
                                            if (yPos + tooltipHeight > containerHeight) { yPos = finalContainerY - tooltipHeight - offsetY; }
                                            if (yPos < 0) { yPos = offsetY; }

                                            tooltip.style("left", `${xPos}px`).style("top", `${yPos}px`);
                                        } else {
                                            tooltip.style("opacity", 0); // Hide if tooltip node vanished
                                        }
                                    } else {
                                        tooltip.style("opacity", 0); // Hide if target disappeared
                                    }
                                }
                            })
                            .on("interrupt", () => {
                                // Re attach listener
                                zoomContainer.on('zoom', (event) => onZoom(event, zoomRef, containerRef, initialX, initialY, scaleX, scaleY, svg, container, dimensions, margins, reverseX, reverseY, xAxisProperty, yAxisProperty, xType, yType, xTable, yTable, showRegression, data, fields, g));
                                // Update zoomRef with the *current* transform state from d3
                                const interruptedTransform = d3.zoomTransform(zoomContainer.node()! as any);
                                zoomRef.current = interruptedTransform;
                            });
    
                    } else { positionTooltipRelativeToDatapoint(targetNode, tooltip, container, svg, currentTransform);} // Point is ON screen, position tooltip immediately
                } else { tooltip.style("opacity", 0); }  // Hovered log's data point doesn't exist in this plot's current data/filter
            } else { tooltip.style("opacity", 0); } // Hovered log exists but data not found in `logs` array for this plot
        } else { tooltip.style("opacity", 0); } // No log is hovered
    } else { tooltip.style("opacity", 0); } // Not interactive or containerNode not available

};
