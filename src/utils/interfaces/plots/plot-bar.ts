"use client";

import * as d3 from "d3";
import { LogProps, LogFieldsResponseProps } from "@/types/interfaces/logs";
import { GroupedDataLabel, DataLabel, GroupingColors, InfoCardData } from "@/types/interfaces/plot";
import { getValue, hasProperty } from "./data";
import { drawAxes, generateTicks } from "./axes";
import { getPrimaryColorFromNode } from "./common";
import { renderGroupingKey } from "./key";
import { showFixedTooltip, tooltipTemplate, positionTooltipRelativeToPointer } from "./tooltip";
import { toComputableValue, computeStatistic } from "../common";

const getTooltipData = (
    d: GroupedDataLabel | DataLabel, 
    xAxisProperty: string | undefined, 
    yAxisProperty: string | undefined,
    metric: string,
    groupBy: string | undefined, 
    aggregate: string | undefined
) => {
    if (groupBy) {
        const group = (d as GroupedDataLabel)[0];            
        const xValue = (d as GroupedDataLabel)[1][0];
        const yValue = (d as GroupedDataLabel)[1][1];
        const data : InfoCardData =  {
            group: { 
                name: `Group: ${groupBy}`, 
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
        if (aggregate) {
            data.aggregate = {
                name: `Aggregate: ${aggregate}`,
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
        if (aggregate) {
            data.aggregate = {
                name: `Aggregate: ${aggregate}`,
            }
        }
        return data
    }
}

function onMouseOver (
    event: any,
    d: GroupedDataLabel | DataLabel, 
    xAxisProperty: string | undefined, 
    yAxisProperty: string | undefined,
    metric: string,
    groupBy: string | undefined, 
    aggregate: string | undefined,
    g: d3.Selection<d3.BaseType, unknown, null, undefined>, 
    tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>,
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>
) {
    const tooltipData = getTooltipData(d, xAxisProperty, yAxisProperty, metric, groupBy, aggregate);
    const template = tooltipTemplate(tooltipData)
    tooltip
        .html(template)
        .transition("opacity")
        .style("opacity", 1);
    positionTooltipRelativeToPointer(event, tooltip, container);
    if (groupBy) {
        const group = (d as GroupedDataLabel)[0];
        g.selectAll("rect.bar-item")
          .transition("opacity").duration(200)
          .style("opacity", barData => (barData as GroupedDataLabel)[0] === group ? 1 : 0);
    }
    else {
        const xValue = (d as DataLabel)[0];
        g.selectAll("rect.bar-item")
            .transition("opacity")
            .style("opacity", bar => (bar as DataLabel)[0] === xValue ? 1 : 0.3);
    }
};

function onMouseMove (
    event: any, 
    tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>,
    container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>
) {
    positionTooltipRelativeToPointer(event, tooltip, container);
};

function onMouseOut  (
    initialOpacity: number,
    g: d3.Selection<d3.BaseType, unknown, null, undefined>, 
    tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>
) {
    tooltip.transition("opacity").style("opacity", 0);
    g.selectAll("rect.bar-item").transition("opacity").style("opacity", initialOpacity);
};

function onClick (
    event: any,
    d: GroupedDataLabel | DataLabel, 
    xAxisProperty: string | undefined, 
    yAxisProperty: string | undefined,
    metric: string,
    groupBy: string | undefined, 
    aggregate: string | undefined,
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
) {
    const tooltipData = getTooltipData(d, xAxisProperty, yAxisProperty, metric, groupBy, aggregate);
    showFixedTooltip(event, tooltipData, settings)
}

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
    groupBy: string | undefined,
    aggregate: string | undefined,
    metric: string,
    sortBars: string | undefined,
    xTable: string,
    yTable: string,
    logs: LogProps[],
    fields: LogFieldsResponseProps,
    zoomRef: any,
    groupByColors: string = "schemeCategory10",
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
            const hasGroup = groupBy ? hasProperty(fields, groupBy, log, xTable) : true
            return hasX && hasY && hasGroup
        });
        const statistic = (vals: number[]) => parseFloat(computeStatistic(metric, vals));
        if (groupBy) {
            const groupsMap = d3.groups(filteredData, d => getValue(fields, groupBy, d, xTable));
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
        if (!groupBy && sortBars != "unsorted") {
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
            groupBy
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
    const xDomain = groupBy
    ? Array.from(new Set((data as GroupedDataLabel[]).flatMap(d => d[1][0])))
    : Array.from(new Set((data as DataLabel[]).map(d => d[0])))
    const xRange = [margins.left, width - margins.right]
    const yValues = groupBy
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
    drawAxes("Bar Chart", svg, dimensions, margins, xScale, yScale, xTicks, yTicks, undefined, undefined, xAxisProperty, yAxisProperty ? `${yAxisProperty} (${metric})` : undefined);

    // Tooltip and grouping key
    const tooltip = container.select(".plotTooltip").style("opacity", 0);

    // Draw bars
    const initialOpacity = groupBy ? 0.7 : 1.0;
    if (groupBy){
        const groupDomain = Array.from(new Set((data as GroupedDataLabel[]).map(d => d[0])))
        const colorRange = d3[groupByColors as keyof typeof d3] as readonly string[];
        const colorScale = d3.scaleOrdinal<string>(d3.schemeCategory10).domain(colorRange);
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
        renderGroupingKey(settings, colors);
    }
    else {
        const primary = getPrimaryColorFromNode(svg.node());
        renderGroupingKey(settings, null); 
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

    // Attach event handlers to the bars
    g.selectAll("rect.bar-item")
        .on("mouseover", (e, d) => onMouseOver(e, (d as GroupedDataLabel | DataLabel), xAxisProperty, yAxisProperty, metric, groupBy, aggregate, g, tooltip, container))
        .on("mousemove", (e, _) => onMouseMove(e, tooltip, container))
        .on("mouseout", (_) => onMouseOut(initialOpacity, g, tooltip))
        .on("click", (e,d) => onClick(e, (d as GroupedDataLabel | DataLabel), xAxisProperty, yAxisProperty, metric, groupBy, aggregate, settings));
};
