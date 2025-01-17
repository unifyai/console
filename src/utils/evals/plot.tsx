"use client";

import * as d3 from "d3";
import { LogProps, LogItemProps, LogFieldsResponseProps } from "@/types/evals/logs";
import { DataLabel, DataPoint, GroupedDataLabel, GroupedDataPoint, GroupingColors } from "@/types/evals/plot";
import { toComputableValue, computeStatistic } from "./common";
import { metrics } from "@/constants/logs";
import { formatNumber } from "../formatNumber";
import { InfoCardData } from "@/types/evals/plot";

const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
const foreground = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim()

/* 
  Draw plot axes lines
*/
export const drawAxes = (
    plotType: string,
    svg: d3.Selection<null, unknown, null, undefined>, 
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    x: d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>,
    y: d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>,
    xTicks: number[], 
    yTicks: number[],
    xTime: boolean,
    xType?: string
) => {

    const width = dimensions.width;
    const height = dimensions.height;
    
    let xAxis : d3.Selection<d3.BaseType, unknown, null, undefined>;
    if (plotType === "Bar Chart") {
        xAxis = svg
            .select(".xAxis")
            .attr("transform", `translate(0,${height - margins.bottom})`)
            .call(
                d3.axisBottom(x as d3.ScaleBand<string>)
                .tickSizeOuter(0)
                .tickFormat(d => 
                    typeof d === "number" 
                        ? formatNumber(d) 
                        : JSON.stringify(d).slice(0, 5).replace(/^"|"$/g, '')
                ) as any
            );
    } else if (plotType === "Histogram") {
        xAxis = svg
            .select(".xAxis")
            .attr("transform", `translate(0,${height - margins.bottom})`)
            .call(
                d3.axisBottom(x as d3.ScaleLinear<number, number, never>)
                .tickSizeOuter(0)
                .tickFormat(d => 
                    xType === "timestamp"
                        ? new Date(d as number).toISOString().replace("Z", "").replace("T", " ")
                        : formatNumber(d as number)
                ) as any
            ); 
    }
    else {
        const allDates = xTicks.map(tick => new Date(tick as number).toLocaleDateString());
        xAxis = svg
            .select(".xAxis")
            .attr("transform", `translate(0,${height - margins.bottom})`)
            .call(
                d3.axisBottom(x as d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>)
                .tickValues(xTicks)
                .tickFormat((d, i) => {
                    if (xTime) {
                        const date = new Date(d as number);
                        if (i != 0 && allDates[i-1] === date.toLocaleDateString())
                            return date.toTimeString().split(" ").at(0) as string;
                        else
                            return date.toLocaleDateString();
                    } else {
                        return formatNumber(parseFloat(d.toString()));
                    }
                }) as any
            );   
    }
    
    xAxis.selectAll("text") // Axis labels style
        .attr("stroke", "black") 
        .attr("stroke-width", 0.1)
        .attr("transform", "rotate(-20) translate(0, 5)") // Combine rotate and translate
        .attr("text-anchor", "end")
        .attr("font-size", "10px");
    xAxis.select("path") // Axis line style
        .attr("stroke", "rgba(243, 244, 246, 1)");        
    xAxis.selectAll("line") // Ticks style
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);
 
    const yAxis = svg
        .select(".yAxis")
        .attr("transform", `translate(${margins.left},0)`)
        .call(
            d3.axisLeft(y as d3.ScaleLinear<number, number, never> | d3.ScaleLinear<number, number, never>)
            .tickValues(plotType === "Bar Chart" || plotType === "Histogram"
                ? yTicks.length > 1 ? yTicks.slice(1) : yTicks 
                : yTicks as number[]
            )
            .tickFormat((d) => formatNumber(parseFloat((d as any)))) as any
        );
    yAxis.selectAll("text") // Axis labels style
        .attr("stroke", "black") 
        .attr("stroke-width", 0.1)
        .attr("text-anchor", "end")
        .attr("font-size", `10px`);
    yAxis.select("path") // Axis line style
        .attr("stroke", "rgba(243, 244, 246, 1)");        
    yAxis.selectAll("line") // Ticks style
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);

    return {xAxis, yAxis}
};

/* 
  Draw plot borders 
*/
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
      .attr("stroke", foreground)
      .attr("stroke-width", 0.5);
    svg.select(".leftLine")
      .attr("x1", margins.left)
      .attr("y1", margins.top)
      .attr("x2", margins.left)
      .attr("y2", height - margins.bottom)
      .attr("stroke", foreground)
      .attr("stroke-width", 0.5);
    svg.select(".topLine")
      .attr("x1", 0)
      .attr("y1", margins.top)
      .attr("x2", width + margins.left)
      .attr("y2", margins.top)
      .attr("stroke", foreground)
      .attr("stroke-width", 0.5);
};

/* 
  Calculate tick spacing for x and y axes
*/
export const calculateTicks = (length: number, scale: string, minY: number, maxY: number, minX: number = 0, maxX: number = 0) => {
    let xTicks = [];
    let yTicks = [];
    const numTicks = length >= 2 ? Math.min(30, length) : 3;

    if (scale === "log") {
        const xTickSpacing = (Math.log10(maxX) - Math.log10(minX)) / (numTicks - 1);
        for (let i = 0; i < numTicks; i++) {
            const xTick = Math.pow(10, Math.log10(minX) + i * xTickSpacing);
            xTicks.push(xTick);
        }
        const yTickSpacing = (Math.log10(maxY) - Math.log10(minY)) / (numTicks - 1);
        for (let i = 0; i < numTicks; i++) {
            const yTick = Math.pow(10, Math.log10(minY) + i * yTickSpacing);
            yTicks.push(yTick);
        }
    } else {
        const xTickSpacing = (maxX - minX) / (numTicks - 1);
        for (let i = 0; i < numTicks; i++) {
            const xTick = minX + i * xTickSpacing;
            xTicks.push(xTick);
        }
        const yTickSpacing = (maxY - minY) / (numTicks - 1);
        for (let i = 0; i < numTicks; i++) {
            const yTick = minY + i * yTickSpacing;
            yTicks.push(yTick);
        }
    }
    return {xTicks, yTicks};
};

/* 
    Hover tooltip and grouping key templates
    NB: Styling should use regular HTML notation (class instead of className, etc.)
        since the components are parsed through the .html method
*/
export const hoverTooltip = (data: InfoCardData) => {
    let template = `
    <p>${data.x.name}</p>
    <p class="font-bold">
        ${data.x.value}
    </p>
    <p>${data.y.name}</p>
    <p class="font-bold">
        ${data.y.value}
    </p>
    `
    if (data.group) {
        const groupTemplate = `
        <p>${data.group.name}</p>
        <p class="font-bold">
            ${data.group.value}
        </p>
        `
        template = groupTemplate + template
    }
    return template
}

export const keyTemplate = (keys: GroupingColors) => {
    return (`
    <p class="font-bold text-sm">Grouping values</p>
    ${keys.map((entry, index) => `
    <div id=${entry.key} class="key flex flex-row gap-2 items-center">
        <div class="rounded-full h-2 w-2" style="background-color: ${entry.color}; color: ${entry.color}"></div>
        <p class="text-xs text-foreground">${entry.key.slice(0, 7)}</p>
    </div>
    `).join("\n")}`)
}

/* 
  Draw bar chart plot
*/
export const drawBarChart = (
  svg: d3.Selection<null, unknown, null, undefined>,
  scale: string,
  dimensions: {width: number, height: number},
  margins: {[key: string]: number},
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  isAggregated: string | undefined,
  logs: LogProps[],
  fields: LogFieldsResponseProps
) => {

    // Remove drawings from other plots:
    const g = svg.select(".plotData")
    g.selectAll("circle.data-point").remove();
    g.selectAll("path.line-item").remove();
    g.selectAll("rect.hist-item").remove();

    // Prepare data
    let data : DataLabel[] = [];
    const properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => field_type != "param")
            .map(([name]) => name);
    const xAxis = selectedXAxisProperty === "Log Time" ? properties.at(0)! : selectedXAxisProperty;
    const yAxis = selectedYAxisProperty && !metrics.includes(selectedYAxisProperty) ? metrics.at(0) : selectedYAxisProperty;
    if (xAxis && yAxis) {
        const filteredData = logs.filter((log) => log.entries[xAxis] != undefined);
        const statistic = (values: LogProps[]) => computeStatistic(yAxis, values.map(d => toComputableValue(d.entries[xAxis]))) 
        data = isAggregated === "true"
            ? [ [xAxis, parseFloat(statistic(filteredData))] ]
            : d3
            .groups(filteredData, d => d.entries[xAxis])
            .map(([groupKey, groupData]) => {
                const label = groupKey.toString();
                const value = d3.rollups(groupData, v => statistic(v));
                return [label, parseFloat(value)];
            }) as DataLabel[];
    }

    // Define scales
    // We also adjust the y scale with by adding an extra lower / higher bound increment
    // Or, when there is only one value, specifying an arbitrary range,
    // accounting for negative values when using a log scale
    const [width, height] = [dimensions.width, dimensions.height];
    let [xDomain, [minY = 0, maxY = 0]] = [
        data.map(d => d[0]),
        d3.extent((data as DataLabel[]).map((d) => d[1]))
    ];
    if (minY === maxY) {
        [minY, maxY] = [0.001, maxY * 2]
    } else {
        let step = (maxY - minY) / (Math.min(30, data.length))
        minY -= step
        maxY += step
        minY = scale === "log" ? 0.001 : minY
    }
    const [xRange, yRange] = [
        [margins.left, width - margins.right],
        [height - margins.bottom, margins.top + 2 * axisPadding]
    ];
    const [xScale, yScale] = [
        d3.scaleBand,
        scale === "log" ? d3.scaleLog : d3.scaleLinear
    ];
    const [x, y] = [
        xScale().domain(xDomain).range(xRange).padding(0.2),
        yScale().domain([minY, maxY]).range(yRange)
    ];

    // Draw axes
    const {xTicks, yTicks} = calculateTicks(data.length, scale, minY, maxY);
    drawAxes("Bar Chart", svg, dimensions, margins, x, y, [], yTicks, false);

    // Draw rectangles
    g
        .selectAll("rect.bar-item")
        .data(data, (d) => `${(d as DataLabel)[0]}-${(d as DataLabel)[1]}`)
        .join("rect") 
        .on("mouseover", (event, data) => hoverOnBar(event, data))
        .on("mouseout", (event, data) => leaveBar(event, data))
        .transition()
        .duration(500)
        .attr("x", d => x((d as DataLabel)[0]) as number)
        .attr("y", d => y((d as DataLabel)[1]) as number)
        .attr("height", (d) => y(minY) - y((d as DataLabel)[1]))
        .attr("width", x.bandwidth())
        .attr("bar-id", d => `bar-${d[0]}-${d[1]}`)
        .attr("fill", primary)
        .attr("class", "bar-item");;

    // Add tooltip and hide key
    const tooltip = d3.select(".plotTooltip").style("opacity", 0)
    const key = d3.select(".groupingKey").style("opacity", 0)

    // When hovering on a bar. Update tooltip data and add striped contour around the bar
    function hoverOnBar (event: any, data: DataLabel) {
        
        const hoverData = {
            "x" : {
                "name": selectedXAxisProperty as string,
                "value": data[0]
            },
            "y" : {
                "name": selectedYAxisProperty as string, 
                "value": data[1]
            }
        }
        const position = { x: x(data[0]) as number, y: y(data[1]) as number }
        const leftPadding = position.x >= width * 0.8 ? -100 : position.x < width * 0.2 ? 100 : 0;
        const topPadding = position.y < height * 0.2 ? 100 : 0;
        tooltip
            .html(hoverTooltip(hoverData))
            .style("left", `${position.x - 50 + leftPadding}px`)
            .style("top", `${position.y - 100 + topPadding}px`)
            .transition()
            .style("opacity", 1)
        g.selectAll(`[bar-id="bar-${data[0]}-${data[1]}"]`)
            .each(function() {
                d3.select(this)
                    .style("stroke", foreground)
                    .style("stroke-width", "5px")
                    .style("stroke-dasharray", "5, 5");
            });
        }

    // When leaving a bar, hide tooltip and remove striped contour
    function leaveBar (event: any, data: DataLabel) {
        tooltip.transition().style("opacity", 0)
        g.selectAll(`[bar-id="bar-${data[0]}-${data[1]}"]`)
            .each(function() {
                d3.select(this)
                .style("stroke", "none")
                .style("stroke-dasharray", "none");
            });

    }

};

/* 
  Draw line chart plot
*/

export const drawLineChart = (
  svg: d3.Selection<null, unknown, null, undefined>,
  scale: string,
  dimensions: {width: number, height: number},
  margins: {[key: string]: number},
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  groupBy: string | undefined,
  logs: LogProps[],
  fields: LogFieldsResponseProps
) => {
    
    // Remove drawings from previous plots
    const g = svg.select(".plotData")
    g.selectAll("circle.data-point").remove();
    g.selectAll("rect.bar-item").remove();
    g.selectAll("rect.hist-item").remove();

    // Prepare data:
    // 1- Auto set y axis property to the first property if changing plots from bar chart to line chart 
    // 2- Filter data for logs that have the x and y properties, and the groupBy property if grouping
    // 3- Convert non numeric values to numeric values if applicable
    // 4- Sort logs by x axis value
    // 5- Return plotting data as arrays of x / y values, or arrays of groupedBy x / y values if grouping
    let data : DataPoint[] | GroupedDataPoint[] = [];
    const properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => field_type != "param" && (data_type === "float" || data_type === "int"))
            .map(([name]) => name);
    const xAxis = selectedXAxisProperty;
    const yAxis = selectedYAxisProperty && metrics.includes(selectedYAxisProperty) ? properties.at(0) : selectedYAxisProperty;
    const xTime = xAxis === "Log Time";
    if (xAxis && yAxis) {
        const filteredData = logs.filter((log) => {
            const hasGroup = groupBy ? log.entries[groupBy] : true;
            const hasX = xTime ? true : log.entries[xAxis];
            const hasY = log.entries[yAxis];
            return hasGroup && hasX && hasY;
        });
        const convertedData = filteredData.map((log) => {
            let entries = log.entries;
            entries[yAxis] = parseFloat(entries[yAxis]);
            if (!xTime) entries[xAxis] = parseFloat(entries[xAxis]); 
            return ({...log, entries});
        });
        const sortedData = convertedData.sort((a, b) => {
            const valueA = xTime ? new Date(a.ts).getTime() : a.entries[xAxis];
            const valueB = xTime ? new Date(b.ts).getTime() : b.entries[xAxis];
            return valueA - valueB;
        });
        const getData = (logs: LogProps[]) => logs.map(d => [
            xTime ? new Date(d.ts).getTime() : d.entries[xAxis], 
            d.entries[yAxis] as number
        ])  as DataPoint[]
        data = groupBy 
            ?   d3  .groups(sortedData, d => d.entries[groupBy])
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
    // 4- Map x and y values to the plot pixel range
    const width = dimensions.width;
    const height = dimensions.height;
    const [xValues, yValues] = [
        groupBy ? (data as GroupedDataPoint[]).flatMap((group) => group[1].map((d) => d[0])) : (data as DataPoint[]).map((d) => d[0]),
        groupBy ? (data as GroupedDataPoint[]).flatMap((group) => group[1].map((d) => d[1])) : (data as DataPoint[]).map((d) => d[1])
    ]
    const [minX = 0, maxX = 0] = d3.extent(xValues);
    const [minY = 0, maxY = 0] = d3.extent(yValues);
    const [xAxisScale, yAxisScale] = [
        xTime ? d3.scaleTime : scale === "log" ? d3.scaleLog : d3.scaleLinear as any,
        scale === "log" ? d3.scaleLog : d3.scaleLinear
    ];
    const [x, y] = [
        xAxisScale().domain([minX, maxX]).range([margins.left + axisPadding, width - margins.right - axisPadding]),
        yAxisScale().domain([minY, maxY]).range([height - margins.bottom - axisPadding, margins.top + axisPadding])
    ];

    // Draw axes
    const {xTicks, yTicks} = calculateTicks(xValues.length, scale, minY, maxY, minX, maxX);
    drawAxes("Line Chart", svg, dimensions, margins, x, y, xTicks, yTicks, xTime);

    // Add grouping key and hide tooltip
    const key = d3.select(".groupingKey").style("opacity", 0)
    const tooltip = d3.select(".plotTooltip").style("opacity", 0)

    // Plot lines.
    // If grouping, plot one line per group, each with their color, and attach the grouping key.
    // Else plot a single line
    const lineGenerator = d3.line().curve(d3.curveLinear).x(d => x(d[0])).y(d => y(d[1]));
    if (groupBy) {        
        let domain = (data as GroupedDataPoint[]).map((d) => JSON.stringify(d[0]));
        domain = Array.from(new Set(domain))
        const color = d3.scaleOrdinal().domain(domain).range(d3.schemeSet3);
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
            .attr("stroke", d => color(d[0]) as string)
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
            .duration(500)
            .style("opacity", d => (d as GroupedDataPoint)[0] === groupValue ? 1 : 0.5);
        key.selectAll(".key")
            .each(function (d, i) {
                const id = d3.select(this).attr("id")
                const opacity = id.toString() === groupValue ? 1 : 0.5
                d3.select(this)
                .transition()
                .duration(500)
                .style("opacity", opacity)
            })
    }

    // When leaving a line, restore opacity of all line groups and their corresponding key
    function leaveLine () {
        g.selectAll("path.line-item").transition().duration(500).style("opacity", 1)
        key.selectAll(".key").transition().duration(500).style("opacity", 1)
    }
};

/* 
  Draw scatter plot
*/
export const drawScatterPlot = (
  svg: d3.Selection<null, unknown, null, undefined>,
  scale: string,
  dimensions: {width: number, height: number},
  margins: {[key: string]: number},
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  groupBy: string | undefined,
  logs: LogProps[],
  fields: LogFieldsResponseProps
) => {
  
    // Remove drawings from previous plots
    const g = svg.select(".plotData")
    g.selectAll("path.line-item").remove();
    g.selectAll("rect.bar-item").remove();
    g.selectAll("rect.hist-item").remove();

    // Prepare data
    let data : LogProps[] = [];
    const properties = Object
            .entries(fields)
            .filter(([name, { data_type, field_type }]) => field_type != "param" && (data_type === "float" || data_type === "int"))
            .map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty === "Log Time" ? properties.at(0) : selectedXAxisProperty;
    const yAxisProperty = selectedYAxisProperty && metrics.includes(selectedYAxisProperty) ? properties.at(0) : selectedYAxisProperty;            

    if (xAxisProperty && yAxisProperty) {
        const filteredData = logs.filter((log) => log.entries[xAxisProperty as keyof LogItemProps] && log.entries[yAxisProperty as keyof LogItemProps]);
        data = filteredData.map((log) => {
            let entries = log.entries;
            entries[yAxisProperty] = parseFloat(entries[yAxisProperty]);
            entries[xAxisProperty] = parseFloat(entries[xAxisProperty]); 
            return ({...log, entries});
        })
    }

    // Define scales
    const [width, height] = [dimensions.width, dimensions.height];
    const [minX = 0, maxX = 0] = d3.extent(data, d => d.entries[xAxisProperty as keyof LogItemProps] as number);
    const [minY = 0, maxY = 0] = d3.extent(data, d =>  d.entries[yAxisProperty as keyof LogItemProps] as number); 
    const [xScale, yScale] = [
        scale === "log" ? d3.scaleLog : d3.scaleLinear,
        scale === "log" ? d3.scaleLog : d3.scaleLinear
    ]
    const [x, y] = [
        xScale().domain([minX, maxX]).range([margins.left + axisPadding, width - margins.right - axisPadding]),
        yScale().domain([minY, maxY]).range([height - margins.bottom - axisPadding, margins.top + axisPadding])
    ]

    // Draw axes
    const {xTicks, yTicks} = calculateTicks(data.length, scale, minY, maxY, minX, maxX);
    drawAxes("Scatter Plot", svg, dimensions, margins, x, y, xTicks, yTicks, false);

    // Add data points
    const points = g
        .selectAll("circle.data-point")
        .data(data)
        .join("circle")
        .on("mouseover", (event, data) => hoverOnPoint(event, data))
        .on("mousemove", (event, data) => moveOnPoint(event, data))
        .on("mouseout", (event, data) => leavePoint(event, data))
        .transition()
        .duration(500)
        .attr("cx", d => x(d.entries[xAxisProperty as keyof LogItemProps] as number))
        .attr("cy", d => y(d.entries[yAxisProperty as keyof LogItemProps] as number))
        .attr("r", 3)
        .attr("fill", primary)
        .attr("stroke", primary)
        .attr("class", "data-point");

    // Add tooltip and grouping key
    const tooltip = d3.select(".plotTooltip").style("opacity", 0)
    const key = d3.select(".groupingKey").style("opacity", 0)

    // If grouping is set. 
    // Generate a color scheme based on the grouping values
    // Color the points based on their groupBy value
    // Pass the color info to the grouping key
    if (groupBy) {

        let domain = data.map(d => JSON.stringify(d.entries[groupBy]) as string);
        domain = Array.from(new Set(domain));
        const color = d3.scaleOrdinal().domain(domain).range(d3.schemeSet3);
        const colors = domain.map((key) => ({key: key, color: color(key) as string}));
        key
            .html(keyTemplate(colors))
            .transition()
            .style("opacity", 1)

        points
            .attr("fill", (d: LogProps) => color(JSON.stringify(d.entries[groupBy])) as string)
            .attr("stroke", (d: LogProps) => color(JSON.stringify(d.entries[groupBy])) as string)

    }

    // When hovering on point.
    // - Set info card position and content
    // - If grouping is set, lower the opacity and radius of all points and groupding keys that don't belong to the same category
    function hoverOnPoint (event: any, data: LogProps) {

        const logData = logs ? logs.find((log)=>log.id === data.id)! : data;
        const hoverData : InfoCardData = {
            "x" : {
                "name": selectedXAxisProperty as string,
                "value": selectedXAxisProperty === "Log Time" 
                    ?   data.ts
                    :   logData.entries[selectedXAxisProperty as keyof LogItemProps]
            },
            "y" : {
                "name": selectedYAxisProperty as string, 
                "value": logData.entries[selectedYAxisProperty as keyof LogItemProps]
            }
        }
        if (groupBy) hoverData["group"] = {"name": groupBy, value: logData.entries[groupBy]}

        const [x, y] = d3.pointer(event, svg);
        const leftPadding = x >= width * 0.8 ? -100 : x < width * 0.2 ? 100 : 0;
        const topPadding = y < height * 0.2 ? 100 : 0;
        tooltip
            .html(hoverTooltip(hoverData))
            .style("left", `${x - 50 + leftPadding}px`)
            .style("top", `${y - 100 + topPadding}px`)
            .transition()
            .style("opacity", 1)

        if (groupBy) {
            g.selectAll("circle.data-point")
                .transition()
                .duration(500)
                .attr("r", d => (d as LogProps).entries[groupBy] === data.entries[groupBy] ? 4 : 2)
                .style("opacity", d => (d as LogProps).entries[groupBy] === data.entries[groupBy] ? 1 : 0.5);
            key.selectAll(".key")
                .each(function (d, i) {
                    const id = d3.select(this).attr("id")
                    const opacity = id.toString() === data.entries[groupBy].toString() ? 1 : 0.5
                    d3.select(this)
                      .transition()
                      .duration(500)
                      .style("opacity", opacity)
                })
        }
    
    }

    // When moving on point. Update info card position
    function moveOnPoint (event: any, data: LogProps) {
        const [x, y] = d3.pointer(event);
        const leftPadding = x >= width * 0.8 ? -100 : x < width * 0.2 ? 100 : 0;
        const topPadding = y < height * 0.2 ? 100 : 0;
        tooltip
            .style("left", `${x - 50 + leftPadding}px`)
            .style("top", `${y - 100 + topPadding}px`)
    }

    // When leaving a point. Reset info card data and reset point opacity if grouped
    function leavePoint (event: any, data: LogProps) {
        tooltip.transition().style("opacity", 0)
        if (groupBy) {
            g.selectAll("circle.data-point")
                .transition()
                .duration(500)
                .attr("r", 3)
                .style("opacity", 1)
            g.selectAll(".key")
               .transition()
               .duration(500)
               .style("opacity", 1)
        }        
    }

};


/* 
  Draw scatter plot
*/
export const drawHistogram = (
    svg: d3.Selection<null, unknown, null, undefined>,
    scale: string,
    dimensions: {width: number, height: number},
    margins: {[key: string]: number},
    axisPadding: number,
    selectedXAxisProperty: string | undefined,
    binCount: number,
    setbinCounts: (binCounts: number[]) => void,
    logs: LogProps[],
    fields: LogFieldsResponseProps,
) => {

    // Remove drawings from previous plots
    const g = svg.select(".plotData")
    g.selectAll("circle.data-point").remove();
    g.selectAll("path.line-item").remove();
    g.selectAll("rect.bar-item").remove();

    // Prepare data
    let data : number[] = [];
    const properties = Object
        .entries(fields)
        .filter(([name, { data_type, field_type }]) => field_type != "param" && (data_type === "float" || data_type === "int" || data_type === "timestamp"))
        .map(([name]) => name);
    const xAxisProperty = selectedXAxisProperty === "Log Time" ? properties.at(0) : selectedXAxisProperty;
    let xType : string | undefined;
    if (xAxisProperty) {
        xType = fields[xAxisProperty].data_type
        const filteredData = logs.filter((log) => log.entries[xAxisProperty as keyof LogItemProps]);
        data = filteredData.map((log) => {
            let entries = log.entries;
            const entry = xType === "timestamp"
                ? new Date(entries[xAxisProperty]).getTime()
                : parseFloat(entries[xAxisProperty])
            return entry;
        })
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
    const bins = d3.bin().thresholds(binCount)
    const buckets = bins(data)
    setbinCounts([1, data.length])

    const [minY, maxY] = [0, d3.max(buckets, d => d.length) ?? 0]
    const y = yScale().domain([minY, maxY]).range(yRange)

    // Draw axes
    const {xTicks, yTicks} = calculateTicks(data.length, scale, minY, maxY, minX, maxX);
    drawAxes("Histogram", svg, dimensions, margins, x, y, xTicks, yTicks, false, xType);

    // Add histogram
    g
        .selectAll("rect.hist-item")
        .data(buckets)
        .join("rect")
        .transition()
        .duration(500)
        .attr("x", d => x(d.x0 as number))
        .attr("y", d => y(d.length))
        .attr("height", d => y(minY) - y(d.length))
        .attr("width", d => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
        .attr("fill", primary)
        .attr("class", "hist-item");
};
  
/* 
    ToDo:
        Scatter:
            - Better enter / exit / updating of point positions
            - Add zooming
        Line: 
            - Better enter / exit / updating of lines
            - Add vertical scrolling
        Bar: 
            - Better enter / exit / updating of bars
            - Add vertical scolling
        Historgram:
            - Better enter / exit / updating of bars
*/