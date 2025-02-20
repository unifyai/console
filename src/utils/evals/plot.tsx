"use client";

import * as d3 from "d3";
import { LogProps, LogItemProps, LogFieldsResponseProps } from "@/types/evals/logs";
import { DataLabel, DataPoint, GroupedDataPoint, GroupingColors, InfoCardData } from "@/types/evals/plot";
import { toComputableValue, computeStatistic } from "./common";
import { formatNumber } from "../formatNumber";

const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()

/** Utility functions to draw UI elements shared across plot types, including: 
 * X and Y axes and ticks
 * Plot border lines
 * Hover tooltip card and positioning
 * Grouped values legend
*/
const drawAxes = (
    plotType: string,
    svg: d3.Selection<null, unknown, null, undefined>, 
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    x: d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>,
    y: d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>,
    xTicks: number[], 
    yTicks: number[],
    reverseX: boolean = false,
    reverseY: boolean = false,
    xType?: string
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
    } else if (plotType === "Histogram" || plotType === "Line Chart") {
        xTickFormatter = d3.axisBottom(x as d3.ScaleLinear<number, number, never>).tickSizeOuter(0).tickFormat(d => {
            if (xType === "timestamp") return new Date(d as number).toISOString().replace("Z", "").replace("T", " ")
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
        .tickFormat((d) => {
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
    xAxis.selectAll("line").attr("stroke", "black").attr("stroke-width", 0.5);
    yAxis.selectAll("line").attr("stroke", "black").attr("stroke-width", 0.5);
    xAxis.select("path").attr("stroke", "rgba(243, 244, 246, 1)");
    yAxis.select("path").attr("stroke", "rgba(243, 244, 246, 1)");

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
  svg: d3.Selection<null, unknown, null, undefined>,
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
    return template
}

const keyTemplate = (keys: GroupingColors) => {
    return (`
    <p class="font-bold text-sm">Grouping values</p>
    ${keys.map((entry, index) => `
    <div id=${entry.key} class="key flex flex-row gap-2 items-center">
        <div class="rounded-full h-2 w-2" style="background-color: ${entry.color}; color: ${entry.color}"></div>
        <p class="text-xs text-foreground">${entry.key.split(".").length > 1 ? entry.key.split(".")[1].slice(0, 7) : entry.key}</p>
    </div>
    `).join("\n")}`)
}

const positionTooltip = (event: any, target: any, tooltip: any) => {
    const [x, y] = d3.pointer(event, target);  
    tooltip.style("left", `${x - 100}px`).style("top", `${y - 50}px`)
};

/** Utility functions to process plot data, including:
 * Calculating the x and y axis tick values
 * Checking if an axis data range can be turned to log scale
 * Reversing the axis domain to compute log scaled values if all numbers in the range are strictly negative
 * Checking if a table's logs has values for a given axis property, and getting those values, if applicable
 * Combine plot logs data across tables
*/
const calculateTicks = (length: number, scaleX: string, scaleY: string, minY: number, maxY: number, minX: number = 0, maxX: number = 0, forceIntegerYTicks: boolean = false) => {
    
    let xTicks = [];
    let yTicks = [];
    const [absMinX, absMaxX] = [Math.abs(minX), Math.abs(maxX)]
    const [absMinY, absMaxY] = [Math.abs(minY), Math.abs(maxY)]
    const numTicks = length >= 2 ? Math.min(30, length) : 3;

    if (scaleX === "log") {
        const xTickSpacing = (Math.log10(absMaxX) - Math.log10(absMinX)) / (numTicks - 1);
        for (let i = 0; i < numTicks; i++) {
            const xTick = Math.pow(10, Math.log10(absMinX) + i * xTickSpacing);
            xTicks.push(xTick);
        }
    } else {
        const xTickSpacing = (maxX - minX) / (numTicks - 1);
        for (let i = 0; i < numTicks; i++) {
            const xTick = minX + i * xTickSpacing;
            xTicks.push(xTick);
        }
    }

    if (scaleY === "log") {
        const yTickSpacing = (Math.log10(absMaxY) - Math.log10(absMinY)) / (numTicks - 1);
        for (let i = 0; i < numTicks; i++) {
            const yTick = Math.pow(10, Math.log10(absMinY) + i * yTickSpacing);
            yTicks.push(yTick);
        }
    } else {
        if (forceIntegerYTicks) {
            const step = Math.ceil(maxY / (numTicks - 1)) || 1;
            yTicks = [];
            for (let current = 0; current <= maxY; current += step) {
                yTicks.push(current);
            }
            if (yTicks[yTicks.length - 1] < maxY) {
                yTicks.push(maxY);
            }
        } else {
            const yTickSpacing = (maxY - minY) / (numTicks - 1);
            for (let i = 0; i < numTicks; i++) {
                const yTick = minY + i * yTickSpacing;
                yTicks.push(yTick);
            }    
        }
    }
    return {xTicks, yTicks};
};

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
    if (dataType === "timestamp") value = new Date(value).getTime()
    return value
}

/** Main plot functions including:
 * Bar chart: Group data by x-axis key and compute a reduction metric value for the y-axis property per x-axis value. Accepts any data type.
 * Line chart: Plot single y-axis versus x-axis line, or one line per group. Accepts floats, ints or timestamps.
 * Scatter plot: Plot y-axis versus x-axis dots with a single color or one color per grouped value. Accepts floats or ints.
 * Histogram: Plot frequency per x-axis value for given bin size. Accepts floats, ints or timestamps. 
*/
export const drawBarChart = (
    svg: d3.Selection<null, unknown, null, undefined>,
    scaleX: string,
    scaleY: string,
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    axisPadding: number,
    selectedXAxisProperty: string | undefined,
    selectedYAxisProperty: string | undefined,
    metric: string,
    xTable: string,
    yTable: string,
    logs: LogProps[],
    fields: LogFieldsResponseProps
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
    d3.select(".groupingKey").style("opacity", 0)

    // Prepare data
    const properties = Object.entries(fields).map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties.at(0);
    const yAxisProperty = selectedYAxisProperty && properties.includes(selectedYAxisProperty) ? selectedYAxisProperty : properties.at(0);
    let data: DataLabel[] = [];
    if (xAxisProperty && yAxisProperty) {
        const filteredData = logs.filter(log => {
            const hasX = hasProperty(fields, xAxisProperty, log, xTable)
            const hasY = hasProperty(fields, yAxisProperty, log, yTable)
            return hasX && hasY
        });
        const statistic = (vals: number[]) => parseFloat(computeStatistic(metric, vals));
        const groups = d3.rollup(
            filteredData,
            v => statistic(v.map(log => toComputableValue(getValue(fields, yAxisProperty, log, yTable)))),
            d => JSON.stringify(getValue(fields, xAxisProperty, d, xTable))
        );
        data = Array.from(groups, ([group, value]) => [group, value]) as DataLabel[];
        data.sort((a, b) => {
            const aStr = a[0];
            const bStr = b[0];
            const isANumeric = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(aStr);
            const isBNumeric = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(bStr);
            if (isANumeric && isBNumeric) {
              const aNum = Number(aStr);
              const bNum = Number(bStr);
              return aNum - bNum;
            } else if (isANumeric) {
              return -1;
            } else if (isBNumeric) {
              return 1;
            } else {
              return aStr.localeCompare(bStr);
            }
        });
    }

    // Define scales
    const [width, height] = [dimensions.width, dimensions.height];
    const xDomain = data.map(d => d[0])
    const xRange = [margins.left, width - margins.right]
    let [minY, maxY] = d3.extent(data.map(d => d[1])) as [number, number];
    if (minY === maxY) {
        minY = minY - 1
        maxY = maxY + 1
    }
    let yDomain = [minY, maxY]
    const xScale = d3.scaleBand().domain(xDomain).range(xRange).padding(0.2);
    const yRange = [
        height - margins.bottom - axisPadding * Number(data.some(d => d[1] < 0)), 
        margins.top + axisPadding * Number(data.some(d => d[1] > 0))
    ]
    const yScale = (scaleY === "log" ? d3.scaleLog() : d3.scaleLinear()).domain(yDomain).range(yRange);

    // Draw axes
    const {xTicks, yTicks} = calculateTicks(data.length, scaleX, scaleY, minY, maxY);
    drawAxes("Bar Chart", svg, dimensions, margins, xScale, yScale, xTicks, yTicks);

    // Draw bars
    const t = svg.transition().duration(500);
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
                .call(
                    enter => enter.transition(t as any)
                        .attr("y", d => yScale(Math.max(0, d[1])))
                        .attr("height", d => Math.abs(yScale(d[1]) - yScale(0)))
                ),
            update => update
                .call(update => update.transition(t as any)
                    .attr("x", d => xScale(d[0])!)
                    .attr("width", xScale.bandwidth())
                    .attr("y", d => yScale(Math.max(0, d[1])))
                    .attr("height", d => Math.abs(yScale(d[1]) - yScale(0)))),
            exit => exit.transition(t as any)
                .attr("height", 0)
                .attr("y", yScale(0))
                .remove()
        );

    // Hover events
    const tooltip = d3.select(".plotTooltip").style("opacity", 0);
    const handleMouseOver = (event: any, d: DataLabel) => {
        const currentKey = d[0];
        tooltip.html(tooltipTemplate({
            x: { 
                name: xAxisProperty!, 
                value: d[0] 
            },
            y: { 
                name: `${yAxisProperty}(${metric})`,
                value: d[1] 
            }
        })).transition().style("opacity", 1);

        // Dim all bars except hovered one
        g.selectAll("rect.bar-item")
            .transition()
            .style("opacity", bar => (bar as DataLabel)[0] === currentKey ? 1 : 0.3);

    };
    const handleMouseOut = () => {
        tooltip.transition().style("opacity", 0);
        g.selectAll("rect.bar-item").transition().style("opacity", 1);
    };
    g.selectAll("rect.bar-item")
        .on("mouseover", (event, d) => handleMouseOver(event, d as DataLabel))
        .on("mousemove", (event) => positionTooltip(event, event.target, tooltip))
        .on("mouseout", handleMouseOut);
};

export const drawLineChart = (
  svg: d3.Selection<null, unknown, null, undefined>,
  scaleX: string,
  scaleY: string,
  dimensions: {width: number, height: number},
  margins: {[key: string]: number},
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  groupBy: string | undefined,
  xTable: string,
  yTable: string,
  logs: LogProps[],
  fields: LogFieldsResponseProps
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
            .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int" || data_type === "timestamp"))
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
    const {xTicks, yTicks} = calculateTicks(xValues.length, scaleX, scaleY, minY, maxY, minX, maxX);
    drawAxes("Line Chart", svg, dimensions, margins, x, y, xTicks, yTicks, reverseX, reverseY, xType);

    // Add grouping key and hide tooltip
    const key = d3.select(".groupingKey").style("opacity", 0)
    const tooltip = d3.select(".plotTooltip").style("opacity", 0)

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
            .transition()
            .style("opacity", 1)
    } else {
        g.selectAll("path.line-item")
            .data(
                [data as DataPoint[]],
                (d) => `${(d as DataPoint)[0]}-${(d as DataPoint)[1]}` // Setting a unique identifier)
            )
            .join("path")
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", primary)
            .attr("stroke-width", 2)
            .attr("d", lineGenerator)
            .attr("class", "line-item")
    }

    // When hovering on a line, lower opacity of other line groups and their corresponding key
    function hoverOnLine (groupValue: string) {
        g.selectAll("path.line-item")
            .transition()
            .duration(200)
            .style("opacity", d => (d as GroupedDataPoint)[0] === groupValue ? 1 : 0.5);
        key.selectAll(".key")
            .each(function (d, i) {
                const id = d3.select(this).attr("id")
                const opacity = id.toString() === groupValue ? 1 : 0.5
                d3.select(this)
                .transition()
                .duration(200)
                .style("opacity", opacity)
            })
    }

    // When leaving a line, restore opacity of all line groups and their corresponding key
    function leaveLine () {
        g.selectAll("path.line-item").transition().duration(200).style("opacity", 1)
        key.selectAll(".key").transition().duration(200).style("opacity", 1)
    }
};

export const drawScatterPlot = (
  svg: d3.Selection<null, unknown, null, undefined>,
  scaleX: string,
  scaleY: string,
  dimensions: {width: number, height: number},
  margins: {[key: string]: number},
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  groupBy: string | undefined,
  showRegression: string,
  xTable: string,
  yTable: string,
  logs: LogProps[],
  fields: LogFieldsResponseProps
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
            .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int"))
            .map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties.at(0);
    const yAxisProperty = selectedYAxisProperty && properties.includes(selectedYAxisProperty) ? selectedYAxisProperty : properties.at(0);
    if (xAxisProperty && yAxisProperty) {
        data = logs.filter((log) => {
            const hasGroup = groupBy ? hasProperty(fields, groupBy, log, xTable) : true
            const hasX = hasProperty(fields, xAxisProperty, log, xTable)
            const hasY = hasProperty(fields, yAxisProperty, log, yTable)
            return hasGroup && hasX && hasY
        })
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
    const {xTicks, yTicks} = calculateTicks(data.length, scaleX, scaleY, minY, maxY, minX, maxX);
    drawAxes("Scatter Plot", svg, dimensions, margins, x, y, xTicks, yTicks, reverseX, reverseY);

    // Add data points
    const points = g
        .selectAll("circle.data-point")
        .data(data, (d: unknown) => (d as LogProps).id); // Use unique identifier to track point transitions
    const enteringPoints = points
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("fill", primary)
        .attr("stroke", primary)
        .attr("cx", d => x(reverseX ? Math.abs(getValue(fields, xAxisProperty as string, d, xTable) as number) : getValue(fields, xAxisProperty as string, d, xTable) as number))
        .attr("cy", d => y(reverseY ? Math.abs(getValue(fields, yAxisProperty as string, d, yTable) as number) : getValue(fields, yAxisProperty as string, d, yTable) as number))
        .attr("r", 0)
        .on("mouseover", (event, data) => hoverOnPoint(event, data, xTable, yTable))
        .on("mouseout", (event, data) => leavePoint(event, data));
    enteringPoints
        .merge(points as any)
        .transition()
        .duration(500)
        .attr("cx", d => x(reverseX ? Math.abs(getValue(fields, xAxisProperty as string, d, xTable) as number) : getValue(fields, xAxisProperty as string, d, xTable) as number))
        .attr("cy", d => y(reverseY ? Math.abs(getValue(fields, yAxisProperty as string, d, yTable) as number) : getValue(fields, yAxisProperty as string, d, yTable) as number))
        .attr("r", 3);
    points.exit()
        .transition()
        .duration(500)
        .attr("r", 0)
        .remove();

    // Add hover areas
    g
        .selectAll("circle.hover-area")
        .data(data)
        .join("circle")
        .on("mouseover", (event, data) => hoverOnPoint(event, data, xTable, yTable))
        .on("mousemove", (event, data) => moveOnPoint(event, data))
        .on("mouseout", (event, data) => leavePoint(event, data))
        .attr("cx", d => x(reverseX ? Math.abs(getValue(fields, xAxisProperty as string, d, xTable) as number) : getValue(fields, xAxisProperty as string, d, xTable) as number))
        .attr("cy", d => y(reverseY ? Math.abs(getValue(fields, yAxisProperty as string, d, yTable) as number) : getValue(fields, yAxisProperty as string, d, yTable) as number))
        .attr("r", 10)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .style("pointer-events", "all")
        .attr("class", "hover-area");

    // Add tooltip and grouping key
    const tooltip = d3.select(".plotTooltip").style("opacity", 0)
    const key = d3.select(".groupingKey").style("opacity", 0)

    // If grouping is set. 
    // Generate a color scheme based on the grouping values
    // Color the points based on their groupBy value
    // Pass the color info to the grouping key
    if (groupBy) {

        let domain = data.map(d => JSON.stringify(getValue(fields, groupBy, d, xTable) as string));
        domain = Array.from(new Set(domain));
        const color = d3.scaleOrdinal().domain(domain).range(d3.schemeCategory10);
        const colors = domain.map((key) => ({key: key, color: color(key) as string}));
        key
            .html(keyTemplate(colors))
            .transition()
            .style("opacity", 1)

        g.selectAll("circle.data-point")
            .transition()
            .duration(500)
            .attr("fill", (d) => color(JSON.stringify(getValue(fields, groupBy, d as LogProps, xTable))) as string)
            .attr("stroke", (d) => color(JSON.stringify(getValue(fields, groupBy, d as LogProps, xTable))) as string)

    }

    // When hovering on point.
    // - Set info card position and content
    // - If grouping is set, lower the opacity and radius of all points and groupding keys that don't belong to the same category
    function hoverOnPoint (event: any, data: LogProps, xTable: string, yTable: string) {

        const hoverData : InfoCardData = {
            "x" : {
                "name":  selectedXAxisProperty as string,
                "value": getValue(fields, selectedXAxisProperty as string, data, xTable)
            },
            "y" : {
                "name":  selectedYAxisProperty as string, 
                "value": getValue(fields, selectedYAxisProperty as string, data, yTable)
            }
        }
        if (groupBy) hoverData["group"] = {
            "name": groupBy, 
            value: getValue(fields, groupBy as string, data, xTable)
        }

        tooltip.html(tooltipTemplate(hoverData)).transition().style("opacity", 1)
        positionTooltip(event, event.target, tooltip);

        if (groupBy) {
            g.selectAll("circle.data-point")
                .transition()
                .duration(200)
                .attr("r", d => getValue(fields, groupBy, d as LogProps, xTable) === getValue(fields, groupBy, data, xTable) ? 4 : 2)
                .style("opacity", d => getValue(fields, groupBy, d as LogProps, xTable) === getValue(fields, groupBy, data, xTable) ? 1 : 0.5);
            g.selectAll("path.best-fit")
                .transition()
                .duration(200)
                .style("opacity", (d: any) => d.groupKey === groupBy ? 1 : 0.5
            );
            g.selectAll("text.correlation-group")
                .transition()
                .duration(200)
                .style("opacity", (d: any) => d.groupKey === groupBy ? 1 : 0.5);
            key.selectAll(".key")
                .each(function (d, i) {
                    const id = d3.select(this).attr("id")
                    const opacity = id.toString() === getValue(fields, groupBy, data, xTable).toString() ? 1 : 0.5
                    d3.select(this)
                      .transition()
                      .duration(200)
                      .style("opacity", opacity)
                })
        } else {
            g.selectAll("circle.data-point")
                .filter((d: unknown) => (d as LogProps).id !== data.id)
                .transition()
                .duration(200)
                .style("opacity", 0.5);
        }
    
    }

    function moveOnPoint(event: any, data: LogProps) {
        positionTooltip(event, event.target, tooltip);
    }

    // When leaving a point. Reset info card data and reset point opacity if grouped
    function leavePoint (event: any, data: LogProps) {
        tooltip.transition().style("opacity", 0)
        if (groupBy) {
            g.selectAll("circle.data-point")
                .transition()
                .duration(200)
                .attr("r", 3)
                .style("opacity", 1)
            g.selectAll(".key")
               .transition()
               .duration(200)
               .style("opacity", 1)
            key.selectAll(".key")
                .transition()
                .duration(200)
                .style("opacity", 1)
            g.selectAll("path.best-fit, text.correlation-group")
                .transition()
                .duration(200)
                .style("opacity", 1);
        } else {
            g.selectAll("circle.data-point")
            .transition()
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
                    const textX = xEndPx + (dx / Math.hypot(dx, dy)) * textOffset;
                    const textY = yEndPx + (dy / Math.hypot(dx, dy)) * textOffset - 20;
    
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
                .join("path")
                .attr("d", d => {
                    const xMin = x.domain()[0];
                    const xMax = x.domain()[1];
                    return line([
                    [xMin, d.m * xMin + d.b],
                    [xMax, d.m * xMax + d.b]
                    ]);
                })
                .attr("stroke", primary)
                .attr("stroke-width", 2)
                .attr("fill", "none")
                .attr("class", "best-fit");

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
            const textX = xEndPx + (dx / Math.hypot(dx, dy)) * textOffset;
            const textY = yEndPx + (dy / Math.hypot(dx, dy)) * textOffset - 20;
            g
                .selectAll("text.correlation")
                .data([0])
                .join("text")
                .attr("x", textX)
                .attr("y", textY)
                .attr("transform", `rotate(${angleDeg},${textX},${textY})`)
                .attr("text-anchor", dx < 0 ? "end" : "start")
                .attr("dominant-baseline", "middle")
                .attr("fill", primary)
                .text(`r = ${regression.r.toFixed(2)}`)
                .attr("class", "correlation");
        }
    }
};

export const drawHistogram = (
    svg: d3.Selection<null, unknown, null, undefined>,
    scaleX: string,
    scaleY: string,
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    axisPadding: number,
    selectedXAxisProperty: string | undefined,
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
    d3.select(".groupingKey").style("opacity", 0)

    // Prepare data
    let data : number[] = [];
    const properties = Object
        .entries(fields)
        .filter(([name, { data_type, field_type }]) => (data_type === "float" || data_type === "int" || data_type === "timestamp"))
        .map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty && properties.includes(selectedXAxisProperty) ? selectedXAxisProperty : properties.at(0);
    let xType : string | undefined;
    if (xAxisProperty) {
        xType = fields[xAxisProperty].data_type
        const filteredData = logs.filter((log) => hasProperty(fields, xAxisProperty, log, table));
        data = filteredData.map((log) => getValue(fields, xAxisProperty, log, table))
    }

    // Define scales
    const [width, height] = [dimensions.width, dimensions.height];
    const [xRange, yRange] = [
        [margins.left, width - margins.right],
        [height - margins.bottom, margins.top + 2 * axisPadding]
    ];
    const [minX = 0, maxX = 0] = d3.extent(data);
    const [xScale, yScale] = [d3.scaleLinear, d3.scaleLinear]
    const x = xScale().domain([minX, maxX]).range(xRange)
    
    // Set bins
    const step = (maxX - minX)/binCount 
    const thresholds = d3.range(minX, maxX, step)
    const binGenerator = d3.bin().domain([minX, maxX]).thresholds(thresholds);
    const buckets = binGenerator(data);
    if (binCounts[1] != data.length) {
        const newBinCounts = [1, data.length]
        setbinCounts(newBinCounts)
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
    const {xTicks, yTicks} = calculateTicks(data.length, scaleX, scaleY, minY, maxY, minX, maxX, true);
    drawAxes("Histogram", svg, dimensions, margins, x, y, xTicks, yTicks, false, false, xType);

    // Add histogram
    const bars = g
    .selectAll("rect.hist-item")
    .data(buckets, (d: any) => `${d.x0}-${d.x1}`); // Use bin boundaries as key
    const enteringBars = bars.enter()
        .append("rect")
        .attr("class", "hist-item")
        .attr("fill", primary)
        .attr("x", d => x(d.x0 as number))
        .attr("width", d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
        .attr("y", y(0)) // Start at base
        .attr("height", 0) // Start with 0 height
        .on("mouseover", (event, d) => hoverOnHist(event, d))
        .on("mousemove", (event, d) => moveOnHist(event, d))
        .on("mouseout", (event, d) => leaveHist(event, d));
    enteringBars
        .merge(bars as any)
        .transition()
        .duration(500)
        .attr("x", d => x(d.x0 as number))
        .attr("width", d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
        .attr("y", d => y(d.length))
        .attr("height", d => y(0) - y(d.length));
    bars.exit()
        .transition()
        .duration(500)
        .attr("y", y(0))
        .attr("height", 0)
        .remove();

    // Add tooltip
    const tooltip = d3.select(".plotTooltip").style("opacity", 0)

    // Add mouse event handlers
    function hoverOnHist(event: any, bin: d3.Bin<number, number>) {
        
        const hoverData = {
          group: {
            name: "Data Range",
            value: xType === "timestamp"
              ? `Min: ${new Date(minX).toLocaleString()}, Max: ${new Date(maxX).toLocaleString()}`
              : `Min: ${formatNumber(minX)}, Max: ${formatNumber(maxX)}`
          },
          x: {
            name: "Bar Range",
            value: xType === "timestamp" 
              ? `${new Date(bin.x0!).toLocaleString()} - ${new Date(bin.x1!).toLocaleString()}`
              : `${formatNumber(bin.x0!)} - ${formatNumber(bin.x1!)}`
          },
          y: {
            name: "Bar Count",
            value: bin.length
          }
        };
  
        tooltip.html(tooltipTemplate(hoverData)).transition().style("opacity", 1);
        positionTooltip(event, event.target, tooltip);

        g.selectAll("rect.hist-item")
         .filter((d: any) => d.x0 !== bin.x0 || d.x1 !== bin.x1)
         .transition()
         .duration(200)
         .style("opacity", 0.5);
      }

      function moveOnHist(event: any, bin: d3.Bin<number, number>) {
        positionTooltip(event, event.target, tooltip);
      }
      
      function leaveHist(event: any, bin: d3.Bin<number, number>) {
        tooltip
          .transition()
          .style("opacity", 0);
        g.selectAll("rect.hist-item")
          .transition()
          .duration(200)
          .style("opacity", 1);
    }
};