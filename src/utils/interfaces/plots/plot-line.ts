'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { DataPoint, GroupedDataPoint, AxisCustomization } from '@/types/interfaces/plot';
import { getValue, hasProperty, inferDisplayType } from './data';
import { drawAxes, generateTicks, reverseOrKeepDomain } from './axes';
import { getPrimaryColorFromNode } from './common';
import { renderGroupingKey } from './key';

function onMouseOver(groupValue: string, g: d3.Selection<d3.BaseType, unknown, null, undefined>) {
  g.selectAll('path.line-item')
    .transition('opacity')
    .duration(200)
    .style('opacity', (d) => ((d as GroupedDataPoint)[0] === groupValue ? 1 : 0.5));
}

function onMouseOut(g: d3.Selection<d3.BaseType, unknown, null, undefined>) {
  g.selectAll('path.line-item').transition('opacity').duration(200).style('opacity', 1);
}

function onZoomStart(g: d3.Selection<d3.BaseType, unknown, null, undefined>) {
  d3.select('body').style('overflow', 'hidden');
  // Temporarily disable interaction during zoom
  g.selectAll('path.line-item').style('pointer-events', 'none');
}

function onZoomEnd(g: d3.Selection<d3.BaseType, unknown, null, undefined>) {
  d3.select('body').style('overflow', 'auto');
  // Re-enable hover effects after zoom
  g.selectAll('path.line-item').style('pointer-events', 'all');
}

function onZoom(
  event: any,
  zoomRef: any,
  initialX: any,
  lineGenerator: d3.Line<number[]>,
  minY: number,
  maxY: number,
  scaleX: string,
  scaleY: string,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  dimensions: { width: number; height: number },
  margins: { [key: string]: number },
  reverseX: boolean,
  reverseY: boolean,
  xAxisProperty: string | undefined,
  yAxisProperty: string | undefined,
  xType: string | undefined,
  y: d3.ScaleLinear<number, number, never>,
  groupBy: string | undefined,
  data: DataPoint[] | GroupedDataPoint[],
  g: d3.Selection<d3.BaseType, unknown, null, undefined>
) {
  event.sourceEvent?.preventDefault();
  event.sourceEvent?.stopPropagation();

  zoomRef.current = event.transform;

  const newX = event.transform.rescaleX(initialX);

  // Update line generator with new scales
  lineGenerator.x((d) => (reverseX ? newX(Math.abs(d[0])) : newX(d[0])));

  // Recalculate ticks based on new domain
  const [minX, maxX] = newX.domain();
  const [xTicks, yTicks] = [
    generateTicks(minX, maxX, 10, scaleX === 'log'),
    generateTicks(minY, maxY, 10, scaleY === 'log'),
  ];

  // Redraw axes with new scales
  drawAxes(
    'Line Chart',
    svg,
    dimensions,
    margins,
    newX,
    y,
    xTicks,
    yTicks,
    reverseX,
    reverseY,
    xAxisProperty,
    yAxisProperty,
    xType
  ); // Note: zoom handler doesn't have access to axisCustomization currently

  // Update line paths
  if (groupBy) {
    g.selectAll('path.line-item')
      .transition('zoom')
      .attr('d', (d) => lineGenerator((d as GroupedDataPoint)[1]));
  } else {
    g.selectAll('path.line-item')
      .transition('zoom')
      .attr('d', lineGenerator(data as DataPoint[]));
  }
}

export const drawLineChart = (
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  scaleX: string,
  scaleY: string,
  dimensions: { width: number; height: number },
  margins: { [key: string]: number },
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
  groupByColors: string = 'schemeCategory10',
  interactive: boolean = true,
  zoomEnabled: boolean = false,
  axisCustomization?: AxisCustomization
) => {
  // Remove drawings from previous plots
  const g = svg.select('.plotData');
  g.selectAll('circle.data-point').remove();
  g.selectAll('circle.hover-area').remove();
  g.selectAll('rect.bar-item').remove();
  g.selectAll('rect.hist-item').remove();
  g.selectAll('text.correlation').remove();
  g.selectAll('text.correlation-group').remove();
  g.selectAll('path.best-fit').remove();

  // Prepare data:
  // 1- Auto set y axis property to the first property if changing plots from bar chart to line chart
  // 2- Filter data for logs that have the x and y properties, and the groupBy property if grouping
  // 3- Convert non numeric values to numeric values if applicable
  // 4- Sort logs by x axis value
  // 5- Return plotting data as arrays of x / y values, or arrays of groupedBy x / y values if grouping
  let data: DataPoint[] | GroupedDataPoint[] = [];
  const properties = Object.entries(fields || {})
    .filter(
      ([name, { dataType, fieldType }]) =>
        dataType === 'float' ||
        dataType === 'int' ||
        dataType === 'timestamp' ||
        dataType === 'time' ||
        dataType === 'timedelta' ||
        dataType === 'date' ||
        dataType === 'bool' ||
        dataType === 'Any'
    )
    .map(([name]) => name);
  const xAxisProperty =
    selectedXAxisProperty && properties.includes(selectedXAxisProperty)
      ? selectedXAxisProperty
      : properties.at(0);
  const yAxisProperty =
    selectedYAxisProperty && properties.includes(selectedYAxisProperty)
      ? selectedYAxisProperty
      : properties.at(0);
  let xType: string | undefined;
  if (xAxisProperty && yAxisProperty) {
    xType = inferDisplayType(fields, xAxisProperty, logs, xTable);
    const filteredData = logs.filter((log) => {
      const hasGroup = groupBy ? hasProperty(fields, groupBy, log, xTable) : true;
      const hasX = hasProperty(fields, xAxisProperty, log, xTable);
      const hasY = hasProperty(fields, yAxisProperty, log, yTable);
      return hasGroup && hasX && hasY;
    });
    const sortedData = filteredData.sort((a, b) => {
      const valueA = getValue(fields, xAxisProperty, a, xTable);
      const valueB = getValue(fields, xAxisProperty, b, xTable);
      if (xType === 'timedelta') return valueB - valueA;
      return valueA - valueB;
    });
    const getData = (logs: LogProps[]) =>
      logs.map((d) => [
        getValue(fields, xAxisProperty, d, xTable),
        getValue(fields, yAxisProperty, d, yTable),
      ]) as DataPoint[];
    data = groupBy
      ? (d3
          .groups(sortedData, (d) => getValue(fields, groupBy, d, xTable))
          .map(([groupKey, groupData]) => {
            const group = groupKey as string;
            const values = getData(groupData);
            return [group, values];
          }) as GroupedDataPoint[])
      : getData(sortedData);
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
    groupBy
      ? (data as GroupedDataPoint[]).flatMap((group) => group[1].map((d) => d[0]))
      : (data as DataPoint[]).map((d) => d[0]),
    groupBy
      ? (data as GroupedDataPoint[]).flatMap((group) => group[1].map((d) => d[1]))
      : (data as DataPoint[]).map((d) => d[1]),
  ];
  const [[minX = 0, maxX = 0], [minY = 0, maxY = 0]] = [d3.extent(xValues), d3.extent(yValues)];
  const [xAxisScale, yAxisScale] = [
    scaleX === 'log' ? d3.scaleLog : (d3.scaleLinear as any),
    scaleY === 'log' ? d3.scaleLog : d3.scaleLinear,
  ];
  const reverseX = scaleX === 'log' && xValues.every((v) => v < 0);
  const reverseY = scaleY === 'log' && yValues.every((v) => v < 0);
  const [xDomain, yDomain] = [
    reverseOrKeepDomain(xValues, [minX, maxX], reverseX),
    reverseOrKeepDomain(yValues, [minY, maxY], reverseY),
  ];
  const [xRange, yRange] = [
    [margins.left + axisPadding, width - margins.right - axisPadding],
    [height - margins.bottom - axisPadding, margins.top + axisPadding],
  ];
  const [x, y] = [
    xAxisScale().domain(xDomain).range(xRange),
    yAxisScale().domain(yDomain).range(yRange),
  ];

  // Draw axes with optional custom labels
  const [xTicks, yTicks] = [
    generateTicks(minX, maxX, 10, scaleX === 'log'),
    generateTicks(minY, maxY, 10, scaleY === 'log'),
  ];

  const showXLabel = axisCustomization?.showXAxisLabel !== false;
  const showYLabel = axisCustomization?.showYAxisLabel !== false;
  const xLabel = showXLabel ? axisCustomization?.xAxisLabel || xAxisProperty : undefined;
  const yLabel = showYLabel ? axisCustomization?.yAxisLabel || yAxisProperty : undefined;

  drawAxes(
    'Line Chart',
    svg,
    dimensions,
    margins,
    x,
    y,
    xTicks,
    yTicks,
    reverseX,
    reverseY,
    xLabel,
    yLabel,
    xType,
    undefined,
    axisCustomization?.xTickFormatter,
    axisCustomization?.yTickFormatter
  );

  // Plot lines.
  // If grouping, plot one line per group, each with their color, and attach the grouping key.
  // Else plot a single line
  const lineGenerator = d3
    .line<number[]>()
    .curve(d3.curveLinear)
    .x((d) => {
      const value = d[0];
      return reverseX ? x(Math.abs(value)) : x(value);
    })
    .y((d) => {
      const value = d[1];
      return reverseY ? y(Math.abs(value)) : y(value);
    });
  if (groupBy) {
    let domain = (data as GroupedDataPoint[]).map((d) => JSON.stringify(d[0]));
    domain = Array.from(new Set(domain));
    const colorRange = d3[groupByColors as keyof typeof d3] as readonly string[];
    const color = d3.scaleOrdinal().domain(domain).range(colorRange);
    const colors = domain.map((key) => ({ key: key, color: color(key) as string }));
    renderGroupingKey(settings, colors);
    // Notify parent about groups (for external drawer)
    axisCustomization?.onGroupsChange?.(colors);
    g.selectAll('path.line-item')
      .data(
        data as GroupedDataPoint[],
        (d) => `${(d as GroupedDataPoint)[0]}-${(d as GroupedDataPoint)[1]}` // Setting a unique identifier)
      )
      .join('path')
      .on('mouseover', (event, d) => onMouseOver(d[0], g))
      .on('mouseout', (event, d) => onMouseOut(g))
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', (d) => color(JSON.stringify(d[0])) as string)
      .attr('stroke-width', 2)
      .attr('d', (d) => lineGenerator(d[1]))
      .attr('class', 'line-item');
  } else {
    const primary = getPrimaryColorFromNode(svg.node());
    renderGroupingKey(settings, null);
    // Clear groups in parent (no grouping)
    axisCustomization?.onGroupsChange?.([]);
    g.selectAll('path.line-item')
      .data(
        [data as DataPoint[]],
        (d) => `${(d as DataPoint)[0]}-${(d as DataPoint)[1]}` // Setting a unique identifier)
      )
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('class', 'line-item line')
            .attr('fill', 'none')
            .attr('stroke', primary)
            .attr('stroke-width', 2)
            .attr('d', lineGenerator),
        (update) =>
          update
            .attr('stroke', primary)
            .transition('update')
            .duration(500)
            .attr('d', lineGenerator),
        (exit) => exit.remove()
      );
  }

  // Handle panning and zooming
  const initialX = x.copy();
  const zoomContainer = svg
    .select('.zoom-layer')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', dimensions.width)
    .attr('height', dimensions.height)
    .style('fill', 'none')
    .style('pointer-events', interactive && zoomEnabled ? 'all' : 'none')
    .lower();
  zoomContainer.on('wheel', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  zoomContainer.on('dblclick', () => {
    zoomRef.current = d3.zoomIdentity;
    zoomContainer
      .transition('zoom')
      .duration(500)
      .call(zoom.transform as any, d3.zoomIdentity);
  });
  const zoom = d3
    .zoom()
    .on('start', () => onZoomStart(g))
    .on('end', () => onZoomEnd(g))
    .on('zoom', (event) =>
      onZoom(
        event,
        zoomRef,
        initialX,
        lineGenerator,
        minY,
        maxY,
        scaleY,
        scaleY,
        svg,
        dimensions,
        margins,
        reverseX,
        reverseY,
        xAxisProperty,
        yAxisProperty,
        xType,
        y,
        groupBy,
        data,
        g
      )
    );
  // Attach zoom transform to container and reapply previous zoom if exists
  zoomContainer.call(zoom as any);
  zoomContainer.call(zoom.transform as any, zoomRef.current);
};
