"use client";

import * as d3 from "d3";
import { LogProps, LogFieldsResponseProps } from "@/types/evals/logs";
import { DataPoint, InfoCardData } from "@/types/evals/plot";
import { formatTimeTypeValue } from "../format";
import { getValue, hasProperty } from "./data";
import { drawAxes, generateTicks, reverseOrKeepDomain } from "./axes";
import { getPrimaryColorFromNode } from "./common";
import { renderGroupingKey } from "./key";
import { showFixedTooltip, tooltipTemplate, positionTooltip } from "./tooltip";

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
    event: any, 
    data: LogProps, 
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
    tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>
) {
    const tooltipData = getTooltipData(data, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType);
    const template = tooltipTemplate(tooltipData);
    tooltip
        .html(template)
        .transition("opacity")
        .style("opacity", 1)
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
    } else {
        g.selectAll("circle.data-point")
            .filter((d: unknown) => (d as LogProps)[`${xTable}.id`] !== data[`${xTable}.id`])
            .transition("opacity")
            .duration(200)
            .style("opacity", 0.5);
    }

}

function onMouseMove(
    event: any, 
    tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>
) { 
    positionTooltip(event, tooltip);
}

function onMouseOut (
    groupBy: string | undefined,
    g: d3.Selection<d3.BaseType, unknown, null, undefined>,
    tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>
) {
    tooltip.transition("opacity").style("opacity", 0)
    if (groupBy) {
        g.selectAll("circle.data-point")
            .transition("opacity")
            .duration(200)
            .attr("r", 3)
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

function onClick (
    event: any,
    data: LogProps, 
    fields: LogFieldsResponseProps, 
    groupBy: string | undefined, 
    aggregate: string | undefined, 
    xTable: string, 
    yTable: string, 
    selectedXAxisProperty: string | undefined, 
    selectedYAxisProperty: string | undefined, 
    xType: string | undefined,
    yType: string | undefined,
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
) {
    const tooltipData = getTooltipData(data, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType)
    showFixedTooltip(event, tooltipData, settings)
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
    initialX: d3.ScaleLinear<number, number, never>,
    initialY: d3.ScaleLinear<number, number, never>,
    scaleX: string,
    scaleY: string,
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
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
        data = data?.length > 1000 ? sampleData(data, 1000) : data
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

    drawAxes("Scatter Plot", svg, dimensions, margins, x, y, xTicks, yTicks, reverseX, reverseY, xAxisProperty, yAxisProperty, xType, yType);

    // Add tooltip
    const tooltip = container.select(".plotTooltip").style("opacity", 0)

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
        renderGroupingKey(settings, colors); 
    } else {
        renderGroupingKey(settings, null);
    }

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
            .on("mouseover", (event, data) => onMouseOver(event, data, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType, g, tooltip))
            .on("mousemove", (event, _) => onMouseMove(event, tooltip))
            .on("mouseout", (_) => onMouseOut(groupBy, g, tooltip))
            .on("click", (event, data) => onClick(event, data, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType, settings))
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
        .on("mouseover", (event, data) => onMouseOver(event, data, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType, g, tooltip))
        .on("mousemove", (event, _) => onMouseMove(event, tooltip))
        .on("mouseout", (_) => onMouseOut(groupBy, g, tooltip))
        .on("click", (event, data) => onClick(event, data, fields, groupBy, aggregate, xTable, yTable, selectedXAxisProperty, selectedYAxisProperty, xType, yType, settings))
        .attr("cx", d => x(reverseX ? Math.abs(getValue(fields, xAxisProperty as string, d, xTable) as number) : getValue(fields, xAxisProperty as string, d, xTable) as number))
        .attr("cy", d => y(reverseY ? Math.abs(getValue(fields, yAxisProperty as string, d, yTable) as number) : getValue(fields, yAxisProperty as string, d, yTable) as number))
        .attr("r", 10)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .style("pointer-events", "all")
        .attr("class", "hover-area");

    // Add line of best fit
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
        .on('start', () => onZoomStart(g))
        .on('end', () => onZoomEnd(g))
        .on('zoom', (event) => onZoom(event, zoomRef, initialX, initialY, scaleX, scaleY, svg, dimensions, margins, reverseX, reverseY, xAxisProperty, yAxisProperty, xType, yType, xTable, yTable, showRegression, data, fields, g));
    // Attach zoom transform to container and reapply previous zoom if exists
    zoomContainer.call(zoom as any);
    zoomContainer.call(zoom.transform as any, zoomRef.current);
};
