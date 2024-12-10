"use client";

import * as d3 from "d3";
import { Dispatch, SetStateAction } from "react";
import { LogProps, LogItemProps } from "@/types/projects/logs";
import { DataLabel, DataPoint, GroupedDataLabel, GroupedDataPoint } from "@/types/projects/plot";
import { toComputableValue, computeStatistic } from "./common";
import { stringToColor } from "../misc/color";
import { metrics } from "@/constants/logs";

/* 
    Filter log entries to keep non dictionary, non list items only
*/
export function filterLogsForPlotting(logs: LogProps[]): LogProps[] { 
    return logs.map(log => {
      const entries = log.entries;
      const filteredEntries: LogItemProps = {};
      for (const key in entries) {
        const entry = entries[key];
       if (typeof entry != "object" && !Array.isArray(entry)) {
        filteredEntries[key] = entries[key];
       }
      }
      return {id: log.id, ts: log.ts, entries: filteredEntries, params: log.params};
    });
  }

/* 
  Draw plot axes lines
*/
export const drawAxes = (
    plotType: string,
    svg: d3.Selection<null, unknown, null, undefined>, 
    dimensions: {width: number, height: number},
    margins: number[],
    x: d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>,
    y: d3.ScaleBand<string> | d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>,
    xTicks: number[], 
    yTicks: number[],
    xTime: boolean
) => {

    const width = dimensions.width;
    const height = dimensions.height;
    const [marginTop, marginRight, marginBottom, marginLeft] = margins;

    let xAxis : d3.Selection<d3.BaseType, unknown, null, undefined>;
    if (plotType === "Bar Chart") {
        xAxis = svg.select(".xAxis")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x as d3.ScaleBand<string>).tickSizeOuter(0) as any);
    } else {
        xAxis = svg.select(".xAxis")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(
            d3.axisBottom(x as d3.ScaleLinear<number, number, never> | d3.ScaleLogarithmic<number, number, never>)
            .tickValues(xTicks)
            .tickFormat(d => {
                if (xTime) {
                    const date = new Date(d as number);
                    return `${date.toLocaleDateString()}`;
                } else {
                    return `${(d as number).toFixed(5)}`;
                }
            }) as any
        );   
    }

    xAxis.selectAll("text") // Axis labels style
        .attr("stroke", "black") 
        .attr("stroke-width", 0.1)
        .attr("transform", "rotate(-30)")
        .attr("transform", "translate(0, 5)")
        .attr("text-anchor", "end")
        .attr("font-size", "12px");
    xAxis.select("path") // Axis line style
        .attr("stroke", "rgba(243, 244, 246, 1)");        
    xAxis.selectAll("line") // Ticks style
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);

    const yAxis = svg.select(".yAxis")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(
            d3.axisLeft(y as d3.ScaleLinear<number, number, never> | d3.ScaleLinear<number, number, never>)
            .tickValues(yTicks as number[])
            .tickFormat(d => `${(d as number).toFixed(5)}`) as any
        );
    yAxis.selectAll("text") // Axis labels style
        .attr("stroke", "black") 
        .attr("stroke-width", 0.1)
        .attr("text-anchor", "end")
        .attr("font-size", "12px");
    yAxis.select("path") // Axis line style
        .attr("stroke", "rgba(243, 244, 246, 1)");        
    yAxis.selectAll("line") // Ticks style
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);
};

/* 
  Draw plot borders 
*/
export const drawBorders = (
  svg: d3.Selection<null, unknown, null, undefined>,
  height: number,
  width: number,
  marginBottom: number,
  marginLeft: number,
  marginTop: number, marginRight: number
) => {
  svg.select(".bottomLine")
      .attr("x1", 0)
      .attr("y1", height - marginBottom )
      .attr("x2", width + marginLeft)
      .attr("y2", height - marginBottom)
      .attr("stroke", "rgba(243, 244, 246, 1)")
      .attr("stroke-width", 5);
  svg.select(".leftLine")
      .attr("x1", marginLeft)
      .attr("y1", marginTop)
      .attr("x2", marginLeft)
      .attr("y2", height - marginBottom)
      .attr("stroke", "rgba(243, 244, 246, 1)")
      .attr("stroke-width", 5);
  svg.select(".topLine")
      .attr("x1", 0)
      .attr("y1", marginTop)
      .attr("x2", width + marginLeft)
      .attr("y2", marginTop)
      .attr("stroke", "rgba(243, 244, 246, 1)")
      .attr("stroke-width", 5);
};

/* 
  Calculate tick spacing for x and y axes
*/
export const calculateTicks = (length: number, scale: string, minY: number, maxY: number, minX: number = 0, maxX: number = 0) => {
  let xTicks = [];
  let yTicks = [];
  const numTicks = Math.min(10, length);

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
  Draw bar chart plot
*/
export const drawBarChart = (
  svg: d3.Selection<null, unknown, null, undefined>,
  scale: string,
  dimensions: {width: number, height: number},
  margins: number[],
  axisPadding: number,
  selectedXAxisProperty: string | null,
  selectedYAxisProperty: string | null,
  groupBy: string | null,
  filteredLogs: LogProps[],
  axisProperties: string[]
) => {

  // Remove drawings from other plots:
  svg.selectAll("circle.data-point").remove();
  svg.selectAll("circle.hover-area").remove();
  svg.selectAll("path.line").remove();
  svg.selectAll("circle.line-hover").remove();
  svg.selectAll("text.line-hover").remove();

  // Prepare data
  const width = dimensions.width;
  const height = dimensions.height;
  const [marginTop, marginRight, marginBottom, marginLeft] = margins;

  let data : DataLabel[] | GroupedDataLabel[] = [];
  const xAxis = selectedXAxisProperty === "Log Time" ? axisProperties.at(0)! : selectedXAxisProperty;
  const yAxis = selectedYAxisProperty && !metrics.includes(selectedYAxisProperty) ? metrics.at(0) : selectedYAxisProperty;

  if (xAxis && yAxis) {

      // Filter for entries with all necessary values
      const filteredData = filteredLogs.filter((log) => {
          const hasGroup = groupBy ? log.entries[groupBy] : true;
          const hasX = log.entries[xAxis];
          return hasGroup && hasX;
      });

      // Group data once or twice
      data = groupBy
          ?  d3.groups(filteredData, d => d.entries[groupBy])
              .map(([groupKey, groupData]) => {
                  const group = groupKey.toString();
                  const values = axisProperties.filter(property => property != xAxis)
                  .map(property => {
                      const propertyData = groupData.map(data => toComputableValue(data.entries[property]));
                      const metric = computeStatistic(yAxis, propertyData);
                      return [property, metric];
                  });
                  return [group, values];
              }) as GroupedDataLabel[]
          :  d3.groups(filteredData, d => d.entries[xAxis])
              .map(([groupKey, groupData]) => {
                  const label = groupKey.toString();
                  const value = d3.rollups(
                      groupData,
                      v => computeStatistic(yAxis, v.map(d => toComputableValue(d.entries[xAxis])))
                  );
                  return [label, value];
              }) as DataLabel[];

  }

  // Define scales
  const xDomain = data.map(d => d[0]);
  const xRange = [marginLeft, width - marginRight];
  const xAxisScale = d3.scaleBand;
  const x = xAxisScale().domain(xDomain).range(xRange).padding(0.2);

  const yValues = groupBy ? (data as GroupedDataLabel[]).flatMap((group) => group[1].map((d) => d[1])) : (data as DataLabel[]).map((d) => d[1]);
  const [minY = 0, maxY = 0] = d3.extent(yValues);
  const yRange = [height - marginBottom, marginTop + axisPadding];
  const yAxisScale = scale === "log" ? d3.scaleLog : d3.scaleLinear;
  const y = yAxisScale().domain([minY, maxY]).range(yRange);

  // Draw axes and borders
  const {xTicks, yTicks} = calculateTicks(data.length, scale, minY, maxY);
  drawAxes("Bar Chart", svg, dimensions, margins, x, y, [], yTicks, false);
  drawBorders(svg, height, width, marginBottom, marginLeft, marginTop, marginRight);

  // Draw rectangles
  if (groupBy) {
      const color = d3.scaleOrdinal().domain(axisProperties).range(d3.schemeSpectral[axisProperties.length]).unknown("#ccc");
      const subX = xAxisScale()
          .domain(axisProperties.filter(property => property != xAxis))
          .range([0, x.bandwidth()]);
      
      svg.selectAll("g.rect-group")
          .data(
              data as GroupedDataLabel[],
              (d) => `${(d as GroupedDataLabel)[0]}-${(d as GroupedDataLabel)[1]}` // Setting a unique identifier
          )
          .join("g")
          .attr("class", "rect-group")
          .attr("transform", d => `translate(${x(d[0])! + x.bandwidth() / 2},0)`)
          .selectAll("rect")
          .data(d => 
              d[1],
              (d) => `${(d as DataLabel)[0]}-${(d as DataLabel)[1]}` // Setting a unique identifier
          )
          .join("rect")
          .transition()
          .duration(500)
          .attr("x", d => subX(d[0])! - x.bandwidth() / 2)
          .attr("y", d => y(d[1]))
          .attr("height", (d) => y(minY) - y(d[1]))
          .attr("width", subX.bandwidth())
          .attr("fill", d => color(d[0]) as string);
  } else {            
      svg.selectAll("g.rect-group")
          .data(data as DataLabel[])
          .join("g")
          .attr("class", "rect-group")
          .attr("transform", d => `translate(${x(d[0])},0)`)
          .selectAll("rect")
          .data(d => 
              [d], // create a new array with the single data point
              (d) => `${(d as DataLabel)[0]}-${(d as DataLabel)[1]}` // Setting a unique identifier
          ) 
          .join("rect")
          .transition()
          .duration(500)
          .attr("x", 0) // x.bandwidth below handles the horizontal positioning
          .attr("y", d => y((d as DataLabel)[1]))
          .attr("height", (d) => y(minY) - y((d as DataLabel)[1]))
          .attr("width", x.bandwidth())
          .attr("fill", "green");
  }

};

/* 
  Draw line chart plot
*/

export const drawLineChart = (
  svg: d3.Selection<null, unknown, null, undefined>,
  scale: string,
  dimensions: {width: number, height: number},
  margins: number[],
  axisPadding: number,
  selectedXAxisProperty: string | null,
  selectedYAxisProperty: string | null,
  groupBy: string | null,
  filteredLogs: LogProps[],
  axisProperties: string[]
) => {

  // Remove previous drawings
  svg.selectAll("circle.data-point").remove();
  svg.selectAll("circle.hover-area").remove();
  svg.selectAll("g.rect-group").remove();
  svg.selectAll("path.line").remove();
  svg.selectAll("circle.line-hover").remove();
  svg.selectAll("text.line-hover").remove();

  // Prepare data
  const width = dimensions.width;
  const height = dimensions.height;
  const [marginTop, marginRight, marginBottom, marginLeft] = margins;

  let data : DataPoint[] | GroupedDataPoint[] = [];
  const xAxis = selectedXAxisProperty;
  const yAxis = selectedYAxisProperty && metrics.includes(selectedYAxisProperty) ? axisProperties.at(0) : selectedYAxisProperty;
  const xTime = xAxis === "Log Time";

  if (xAxis && yAxis) {

      // Filter for entries with all necessary values
      const filteredData = filteredLogs.filter((log) => {
          const hasGroup = groupBy ? log.entries[groupBy] : true;
          const hasX = xTime ? true : log.entries[xAxis];
          const hasY = log.entries[yAxis];
          return hasGroup && hasX && hasY;
      });

      // Convert non numeric values
      const convertedData = filteredData.map((log) => {
          let entries = log.entries;
          entries[yAxis] = toComputableValue(entries[yAxis]);
          if (!xTime) entries[xAxis] = toComputableValue(entries[xAxis]); 
          return ({...log, entries});
      });

      // Sort by x-axis value
      const sortedData = convertedData.sort((a, b) => {
          const valueA = xTime ? new Date(a.ts).getTime() : toComputableValue(a.entries[xAxis]);
          const valueB = xTime ? new Date(b.ts).getTime() : toComputableValue(b.entries[xAxis]);
          return valueA - valueB;
      });

      // Group data if needed or handle identical x values if plotting a single line
      data = groupBy 
          ? d3.groups(sortedData, d => d.entries[groupBy])
              .map(([groupKey, groupData]) => {
                  const group = groupKey.toString().slice(0, 10);
                  const values = d3.rollups(
                      groupData,
                      v => d3.mean(v, d => toComputableValue(d.entries[yAxis])),
                      d => xTime ? new Date(d.ts).getTime() : toComputableValue(d.entries[xAxis])
                  );
                  return [group, values];
              }) as GroupedDataPoint[]
          : d3.rollups(
              sortedData,
              v => d3.mean(v, d => toComputableValue(d.entries[yAxis])) as number,
              d => xTime ? new Date(d.ts).getTime() : toComputableValue(d.entries[xAxis])
          ) as DataPoint[];
  }

  // Define scales
  const xValues = groupBy ? (data as GroupedDataPoint[]).flatMap((group) => group[1].map((d) => d[0])) : (data as DataPoint[]).map((d) => d[0]);
  const yValues = groupBy ? (data as GroupedDataPoint[]).flatMap((group) => group[1].map((d) => d[1])) : (data as DataPoint[]).map((d) => d[1]);

  const [minX = 0, maxX = 0] = d3.extent(xValues);
  const [minY = 0, maxY = 0] = d3.extent(yValues);

  const xAxisScale = xTime ? d3.scaleTime : scale === "log" ? d3.scaleLog : d3.scaleLinear as any;
  const x = xAxisScale().domain([minX, maxX]).range([marginLeft + axisPadding, width - marginRight - axisPadding]);

  const yAxisScale = scale === "log" ? d3.scaleLog : d3.scaleLinear;
  const y = yAxisScale().domain([minY, maxY]).range([height - marginBottom - axisPadding, marginTop + axisPadding]);

  // Draw axes and borders
  const {xTicks, yTicks} = calculateTicks(xValues.length, scale, minY, maxY, minX, maxX);
  drawAxes("Line Chart", svg, dimensions, margins, x, y, xTicks, yTicks, xTime);
  drawBorders(svg, height, width, marginBottom, marginLeft, marginTop, marginRight);

  // Plot lines
  const lineGenerator = d3.line().curve(d3.curveLinear).x(d => x(d[0])).y(d => y(d[1]));

  if (groupBy) {
      
      // Create a color scale for different groups
      const domain = (data as GroupedDataPoint[]).map((d) => d[0]);
      const color = d3.scaleOrdinal(d3.schemeCategory10).domain(domain);

      const points = (data as GroupedDataPoint[]).flatMap((group) => group[1].map(d => [x(d[0]) as number, y(d[1]) as number, group[0] as string]));
      
      // Plot a line for each group
      const path = svg.selectAll("path.line")
          .data(
              data as GroupedDataPoint[], 
              (d) => `${(d as GroupedDataPoint)[0]}-${(d as GroupedDataPoint)[1]}` // Setting a unique identifier)
          ) 
          .join("path")
          .attr("class", "line")
          .attr("fill", "none")
          .attr("stroke", d => color(d[0]))
          .attr("stroke-width", 1.5)
          .attr("d", d => lineGenerator(d[1]));

      const dot = svg.selectAll("circle.line-hover")
          .data([null]) // dummy data to create a single element
          .join("circle")
          .attr("class", "line-hover")
          .attr("r", 2.5);

      const text = svg.selectAll("text.line-hover")
          .data([null]) // dummy data to create a single element
          .join("text")
          .attr("class", "line-hover")
          .attr("text-anchor", "middle")
          .attr("y", -8);

      svg.on("pointerenter", e => pointerentered(path, dot, text))
          .on("pointermove", e => pointermoved(e, points, path, dot, text, color))
          .on("pointerleave", e => pointerleft(path, dot, text))
          .on("touchstart", event => event.preventDefault());
  } else {
      
      // Plot a single line
      svg.selectAll("path.line")
          .data(
              [data as DataPoint[]],
              (d) => `${(d as { id: string; key: string; }).id}-${(d as { id: string; key: string; }).key}` // Setting a unique identifier)
          )
          .join("path")
          .attr("class", "line")
          .attr("fill", "none")
          .attr("stroke", "#69b3a2")
          .attr("stroke-width", 1.5)
          .attr("d", lineGenerator);
  }

  function pointermoved(
      event: Event, 
      points: (string | number)[][], 
      path: d3.Selection<d3.BaseType | SVGPathElement, GroupedDataPoint, null, unknown>,
      dot: d3.Selection<d3.BaseType | SVGCircleElement, null, null, unknown>,
      text: d3.Selection<d3.BaseType | SVGTextElement, null, null, unknown>,
      color: d3.ScaleOrdinal<string, string, never>
  ) {
      const [xm, ym] = d3.pointer(event);
      const i = d3.leastIndex(points, ([x, y]) => Math.hypot((x as number) - xm, (y as number) - ym))!;
      const [x, y, k] = points[i];
      path.style("stroke", (d) => d[0] === k ? null : "#ddd").filter(d => d[0] === k).raise();
      dot.attr("transform", `translate(${x},${y})`).attr("fill", d => color(k as string));
      text.attr("transform", `translate(${x},${y})`).attr("fill", d => color(k as string)).text(k);
  }

  function pointerentered(
      path: d3.Selection<d3.BaseType | SVGPathElement, GroupedDataPoint, null, unknown>,
      dot: d3.Selection<d3.BaseType | SVGCircleElement, null, null, unknown>,
      text: d3.Selection<d3.BaseType | SVGTextElement, null, null, unknown>
  ) {
      path.style("mix-blend-mode", null).style("stroke", "#ddd");
      dot.attr("display", null);
      text.attr("display", null);
  }

  function pointerleft(
      path: d3.Selection<d3.BaseType | SVGPathElement, GroupedDataPoint, null, unknown>,
      dot: d3.Selection<d3.BaseType | SVGCircleElement, null, null, unknown>,
      text: d3.Selection<d3.BaseType | SVGTextElement, null, null, unknown>
  ) {
      path.style("mix-blend-mode", "multiply").style("stroke", null);
      dot.attr("display", "none");
      text.attr("display", "none");
  }
};

/* 
  Draw scatter plot
*/
export const drawScatterPlot = (
  svg: d3.Selection<null, unknown, null, undefined>,
  logs: LogProps[] | undefined,
  scale: string,
  setInfoCardData: Dispatch<SetStateAction<LogProps | null>>,
  setInfoCardPosition:Dispatch<SetStateAction<{x: number, y: number}>>,
  dimensions: {width: number, height: number},
  margins: number[],
  axisPadding: number,
  selectedXAxisProperty: string | null,
  selectedYAxisProperty: string | null,
  groupBy: string | null,
  filteredLogs: LogProps[],
  axisProperties: string[]
) => {
  
  // Remove drawings from other plots
  svg.selectAll("path.line").remove();
  svg.selectAll("g.rect-group").remove();
  svg.selectAll("circle.line-hover").remove();
  svg.selectAll("text.line-hover").remove();

  // Prepare data
  const width = dimensions.width;
  const height = dimensions.height;
  const [marginTop, marginRight, marginBottom, marginLeft] = margins;

  let data : LogProps[] = [];
  const xAxis = selectedXAxisProperty === "Log Time" ? axisProperties.at(0) : selectedXAxisProperty;
  const yAxis = selectedYAxisProperty && metrics.includes(selectedYAxisProperty) ? axisProperties.at(0) : selectedYAxisProperty;            

  if (xAxis && yAxis) {
      const filteredData = filteredLogs.filter((log) => log.entries[xAxis as keyof LogItemProps] && log.entries[yAxis as keyof LogItemProps]);
      const convertedData = filteredData.map((log) => {
          let entries = log.entries;
          entries[xAxis] = toComputableValue(entries[xAxis]); 
          entries[yAxis] = toComputableValue(entries[yAxis]);
          return ({...log, entries});
      });
      data = convertedData.sort((a, b) => {
          const valueA = toComputableValue(a.entries[xAxis]);
          const valueB = toComputableValue(b.entries[xAxis]);
          return valueA - valueB;
      });
  }

  // Define scales
  const [minX = 0, maxX = 0] = d3.extent(data, d => d.entries[xAxis as keyof LogItemProps] as number);
  const xAxisScale = scale === "log" ? d3.scaleLog : d3.scaleLinear as any;
  const x = xAxisScale().domain([minX, maxX]).range([marginLeft + axisPadding, width - marginRight - axisPadding]);

  const [minY = 0, maxY = 0] = d3.extent(data, d =>  d.entries[yAxis as keyof LogItemProps] as number); 
  const yAxisScale = scale === "log" ? d3.scaleLog : d3.scaleLinear;
  const y = yAxisScale().domain([minY, maxY]).range([height - marginBottom - axisPadding, marginTop + axisPadding]);

  // Draw axes and borders
  const {xTicks, yTicks} = calculateTicks(data.length, scale, minY, maxY, minX, maxX);
  drawAxes("Scatter Plot", svg, dimensions, margins, x, y, xTicks, yTicks, false);
  drawBorders(svg, height, width, marginBottom, marginLeft, marginTop, marginRight);

  // Add data points
  svg.selectAll("circle.hover-area")
      .data(data)
      .join("circle")
      .on("mouseover", (event, data) => hoverOnPoint(event, data))
      .on("mousemove", (event, data) => moveOnPoint(event, data))
      .on("mouseout", (event, data) => leavePoint(event, data))
              .transition()
              .duration(500)
              .attr("cx", d => x(d.entries[xAxis as keyof LogItemProps] as number))
              .attr("cy", d => y(d.entries[yAxis as keyof LogItemProps] as number))
              .attr("r", 10)
              .attr("fill", "none")
              .attr("log-hover-id", d => `${d.id}-hover-area`)                    
              .attr("class", "hover-area");

  svg.selectAll("circle.data-point")
      .data(data)
      .join("circle")
      .on("mouseover", (event, data) => hoverOnPoint(event, data))
      .on("mousemove", (event, data) => moveOnPoint(event, data))
      .on("mouseout", (event, data) => leavePoint(event, data))
          .transition()
          .duration(500)
          .attr("cx", d => x(d.entries[xAxis as keyof LogItemProps] as number))
          .attr("cy", d => y(d.entries[yAxis as keyof LogItemProps] as number))
          .attr("r", 3)
          .attr("fill", d => {
              const logEntry = logs && groupBy ? logs.find((log) => log.id === d.id)!.entries[groupBy] : undefined; 
              return logs && groupBy 
                      ? logEntry
                          ? stringToColor(JSON.stringify(logEntry))
                          : "transparent"
                      : "black";
          })
          .attr("stroke", d => {
              const logEntry = logs && groupBy ? logs.find((log) => log.id === d.id)!.entries[groupBy] : undefined; 
              return logs && groupBy 
                      ? logEntry
                          ? stringToColor(JSON.stringify(logEntry))
                          : "transparent"
                      : "black";
          })
          .attr("class", "data-point");

  // Point interaction functions
  function hoverOnPoint (event: any, data: LogProps) {
      setInfoCardData(logs ? logs.find((log)=>log.id === data.id)! : data);
      const [x, y] = d3.pointer(event);
      setInfoCardPosition({x, y});
      svg.selectAll(`[log-hover-id="${data.id}-hover-area"]`)
          .each(function() {
              d3.select(this)
                  .attr("stroke", d => {
                      const logEntry = logs && groupBy ? logs.find((log) => log.id === data.id)!.entries[groupBy] : undefined; 
                      return logs && groupBy 
                              ? logEntry
                                  ? stringToColor(JSON.stringify(logEntry)) 
                                  : "transparent"
                              : "black";
                  })
                  .style("stroke-width", "1px")
                  .style("stroke-dasharray", "3, 3");
          });
  }

  function moveOnPoint (event: any, data: LogProps) {
      const [x, y] = d3.pointer(event);
      setInfoCardPosition({x, y});   
  }

  function leavePoint (event: any, data: LogProps) {
      setInfoCardData(null);
      svg.selectAll(`[log-hover-id="${data.id}-hover-area"]`)
          .each(function() {
              d3.select(this)
              .style("stroke", "none")
              .style("stroke-dasharray", "none");
          });
  }
};
