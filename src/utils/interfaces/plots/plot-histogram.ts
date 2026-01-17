'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import {
  DataRange,
  GroupedDataRange,
  GroupedBin,
  GroupingColors,
  InfoCardData,
  AxisCustomization,
} from '@/types/interfaces/plot';
import { formatTimeTypeValue } from '../format';
import { getValue, hasProperty, inferDisplayType } from './data';
import { drawAxes, generateTicks } from './axes';
import { getPrimaryColorFromNode } from './common';
import { renderGroupingKey } from './key';
import { showFixedTooltip, tooltipTemplate, positionTooltipRelativeToPointer } from './tooltip';
import { formatNumber } from '@/utils/interfaces/formatNumber';

const getTooltipData = (
  data: GroupedDataRange | DataRange,
  bin: d3.Bin<number, number> | GroupedBin,
  groupBy: string | undefined,
  aggregate: string | undefined,
  xType: string | undefined,
  minX: number,
  maxX: number,
  axisCustomization?: AxisCustomization
) => {
  const [localMinX, localMaxX] = groupBy // Compute group boundaries if group by is set
    ? d3.extent(
        (data as GroupedDataRange)
          .filter((d) => d[0] === (bin as GroupedBin).group)
          .flatMap((d) => d[1]) as DataRange
      )
    : [minX, maxX];

  // Use custom labels if provided
  const groupLabel = axisCustomization?.groupByLabel || 'Group';
  const aggLabel = axisCustomization?.aggregateLabel || aggregate;

  const hoverData: InfoCardData = {
    group: {
      name: 'Data Range',
      value:
        xType === 'timestamp' || xType === 'timedelta' || xType === 'time' || xType === 'date'
          ? `${groupBy ? groupLabel + ': ' + (bin as GroupedBin).group + ', ' : ''}Min: ${formatTimeTypeValue(localMinX as number, xType)}, Max: ${formatTimeTypeValue(localMaxX as number, xType)}`
          : `${groupBy ? groupLabel + ': ' + (bin as GroupedBin).group + ', ' : ''}Min: ${formatNumber(minX)}, Max: ${formatNumber(maxX)}`,
    },
    x: {
      name: 'Bar Range',
      value:
        xType === 'timestamp' || xType === 'timedelta' || xType === 'time' || xType === 'date'
          ? `${formatTimeTypeValue(bin.x0!, xType)} - ${formatTimeTypeValue(bin.x1!, xType)}`
          : `${formatNumber(bin.x0!)} - ${formatNumber(bin.x1!)}`,
    },
    y: {
      name: 'Bar Count',
      value: bin.length,
    },
  };
  if (aggregate && aggLabel) {
    hoverData.aggregate = {
      name: aggLabel,
    };
  }
  return hoverData;
};

function onMouseOver(
  event: any,
  data: GroupedDataRange | DataRange,
  bin: d3.Bin<number, number> | GroupedBin,
  groupBy: string | undefined,
  aggregate: string | undefined,
  xType: string | undefined,
  minX: number,
  maxX: number,
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>,
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  axisCustomization?: AxisCustomization
) {
  const tooltipData = getTooltipData(
    data,
    bin,
    groupBy,
    aggregate,
    xType,
    minX,
    maxX,
    axisCustomization
  );
  const template = tooltipTemplate(tooltipData);
  tooltip.html(template).transition('opacity').style('opacity', 1);
  positionTooltipRelativeToPointer(event, tooltip, container);

  g.selectAll('rect.hist-item')
    .filter((d: any) =>
      groupBy ? d.group !== (bin as GroupedBin).group : d.x0 !== bin.x0 || d.x1 !== bin.x1
    )
    .transition('opacity')
    .duration(200)
    .style('opacity', 0.5);
}

function onMouseMove(
  event: any,
  tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>,
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>
) {
  positionTooltipRelativeToPointer(event, tooltip, container);
}

function onMouseOut(
  initialOpacity: number,
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>
) {
  tooltip.transition('opacity').style('opacity', 0);
  g.selectAll('rect.hist-item')
    .transition('opacity')
    .duration(200)
    .style('opacity', initialOpacity);
}

function onClick(
  event: any,
  data: GroupedDataRange | DataRange,
  bin: d3.Bin<number, number> | GroupedBin,
  groupBy: string | undefined,
  aggregate: string | undefined,
  xType: string | undefined,
  minX: number,
  maxX: number,
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  axisCustomization?: AxisCustomization
) {
  const tooltipData = getTooltipData(
    data,
    bin,
    groupBy,
    aggregate,
    xType,
    minX,
    maxX,
    axisCustomization
  );
  showFixedTooltip(event, tooltipData, settings);
}

export const drawHistogram = (
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  scaleX: string,
  scaleY: string,
  dimensions: { width: number; height: number },
  margins: { [key: string]: number },
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  groupBy: string | undefined,
  aggregate: string | undefined,
  binCount: number,
  setbinCount: (binCount: string) => void,
  binCounts: number[],
  setbinCounts: (binCounts: number[]) => void,
  table: string,
  logs: LogProps[],
  fields: LogFieldsResponseProps,
  groupByColors: string = 'schemeCategory10',
  axisCustomization?: AxisCustomization
) => {
  // Remove drawings from previous plots
  const g = svg.select('.plotData');
  g.selectAll('circle.data-point').remove();
  g.selectAll('circle.hover-area').remove();
  g.selectAll('path.line-item').remove();
  g.selectAll('rect.bar-item').remove();
  g.selectAll('text.correlation').remove();
  g.selectAll('text.correlation-group').remove();
  g.selectAll('path.best-fit').remove();
  container.select('.groupingKey');

  // Prepare data
  let data: DataRange | GroupedDataRange = [];
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
  let xType: string | undefined;
  if (xAxisProperty) {
    xType = inferDisplayType(fields, xAxisProperty, logs, table);
    const filteredData = logs.filter((log) => {
      const hasX = hasProperty(fields, xAxisProperty, log, table);
      const hasGroup = groupBy ? hasProperty(fields, groupBy, log, table) : true;
      return hasX && hasGroup;
    });
    if (groupBy) {
      data = d3
        .groups(filteredData, (d) => getValue(fields, groupBy, d, table))
        .map(([group, values]) => [
          group,
          values.map((log) => getValue(fields, xAxisProperty, log, table)),
        ]) as GroupedDataRange;
    } else {
      data = filteredData.map((log) => getValue(fields, xAxisProperty, log, table)) as DataRange;
    }
  }

  // Define scales
  const [width, height] = [dimensions.width, dimensions.height];
  const [xRange, yRange] = [
    [margins.left, width - margins.right],
    [height - margins.bottom, margins.top + 2 * axisPadding],
  ];
  const xValues = groupBy ? (data as GroupedDataRange).flatMap((d) => d[1]) : (data as DataRange);
  const [minX = 0, maxX = 0] = d3.extent(xValues);
  const [xScale, yScale] = [d3.scaleLinear, d3.scaleLinear];
  const x = xScale().domain([minX, maxX]).range(xRange);

  // Set bins
  const step = (maxX - minX) / binCount;
  const thresholds = d3.range(minX, maxX, step);
  const binGenerator = d3.bin().domain([minX, maxX]).thresholds(thresholds);
  const buckets: d3.Bin<number, number>[] | GroupedBin[] = groupBy
    ? (data as GroupedDataRange).flatMap(([group, values]) => {
        const binsArray: d3.Bin<number, number>[] = binGenerator(values);
        const groupedBinsForThisGroup: GroupedBin[] = binsArray.map((bin) => {
          const groupedBin = bin as GroupedBin; // Assert the type
          groupedBin.group = group; // Add the property
          return groupedBin; // Return the modified bin
        });
        return groupedBinsForThisGroup;
      })
    : binGenerator(data as number[]);

  // For grouped data, use total data point count, not group count
  const totalDataCount = groupBy
    ? (data as GroupedDataRange).reduce((sum, [_, values]) => sum + values.length, 0)
    : (data as DataRange).length;

  if (binCounts[1] != totalDataCount) {
    const newBinCounts = [1, totalDataCount];
    setbinCounts(newBinCounts);
    if (totalDataCount > 0 && binCount === 0) {
      const newCount = Math.min(10, totalDataCount);
      setbinCount(newCount.toString());
    }
    return;
  }
  if (binCount > binCounts[1]) {
    const count = Math.min(10, totalDataCount);
    setbinCount(count.toString());
    return;
  }

  const [minY, maxY] = [0, d3.max(buckets, (d) => d.length) ?? 0];
  const y = yScale().domain([minY, maxY]).range(yRange);

  // Draw axes with optional custom labels
  const [xTicks, yTicks] = [
    generateTicks(minX, maxX, 10, scaleX === 'log'),
    generateTicks(minY, maxY, 10, scaleY === 'log'),
  ];

  const showXLabel = axisCustomization?.showXAxisLabel !== false;
  const showYLabel = axisCustomization?.showYAxisLabel !== false;
  const xLabel = showXLabel ? axisCustomization?.xAxisLabel || xAxisProperty : undefined;
  const yLabel = showYLabel ? axisCustomization?.yAxisLabel || 'Count' : undefined;

  drawAxes(
    'Histogram',
    svg,
    dimensions,
    margins,
    x,
    y,
    xTicks,
    yTicks,
    false,
    false,
    xLabel,
    yLabel,
    xType,
    undefined,
    axisCustomization?.xTickFormatter,
    axisCustomization?.yTickFormatter
  );

  // Tooltip and grouping key
  const tooltip = container.select('.plotTooltip').style('opacity', 0);

  // Add histogram
  const initialOpacity = groupBy ? 0.7 : 1.0;
  if (groupBy) {
    const groupDomain = Array.from(new Set((buckets as GroupedBin[]).map((d) => d.group)));
    const colorRange = d3[groupByColors as keyof typeof d3] as readonly string[];
    const colorScale = d3.scaleOrdinal<string>(colorRange).domain(groupDomain);
    const bars = g
      .selectAll('rect.hist-item')
      .data(
        buckets as GroupedBin[],
        (d) => `${(d as GroupedBin).group}-${(d as GroupedBin).x0}-${(d as GroupedBin).x1}`
      ); // Use bin boundaries as key
    const enteringBars = bars
      .enter()
      .append('rect')
      .attr('class', 'hist-item')
      .attr('fill', (d) => colorScale(d.group))
      .attr('x', (d) => x(d.x0 as number))
      .attr('width', (d) => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
      .attr('y', y(0)) // Start at base
      .attr('height', 0) // Start with 0 height
      .style('opacity', initialOpacity)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) =>
        onMouseOver(
          event,
          data,
          d,
          groupBy,
          aggregate,
          xType,
          minX,
          maxX,
          g,
          tooltip,
          container,
          axisCustomization
        )
      )
      .on('mousemove', (event, _) => onMouseMove(event, tooltip, container))
      .on('mouseout', (_) => onMouseOut(initialOpacity, g, tooltip))
      .on('click', (event, d) =>
        onClick(event, data, d, groupBy, aggregate, xType, minX, maxX, settings, axisCustomization)
      );
    enteringBars
      .merge(bars as any)
      .transition('enter')
      .duration(500)
      .attr('fill', (d) => colorScale(d.group))
      .attr('x', (d) => x(d.x0 as number))
      .attr('width', (d) => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
      .attr('y', (d) => y(d.length))
      .attr('height', (d) => y(0) - y(d.length))
      .style('opacity', initialOpacity);
    bars.exit().transition('exit').duration(500).attr('y', y(0)).attr('height', 0).remove();

    // Grouping Key
    const colors: GroupingColors = groupDomain.map((groupKey) => ({
      key: groupKey,
      color: colorScale(groupKey),
    }));
    renderGroupingKey(settings, colors);
  } else {
    const primary = getPrimaryColorFromNode(svg.node());
    renderGroupingKey(settings, null);
    const bars = g
      .selectAll('rect.hist-item')
      .data(buckets as d3.Bin<number, number>[], (d: any) => `${d.x0}-${d.x1}`); // Use bin boundaries as key
    bars.join(
      (enter) =>
        enter
          .append('rect')
          .attr('class', 'hist-item')
          .attr('fill', primary)
          .attr('x', (d) => x(d.x0 as number))
          .attr('width', (d) => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
          .attr('y', y(0)) // Start at base
          .attr('height', 0) // Start with 0 height
          .style('opacity', initialOpacity)
          .style('cursor', 'pointer')
          .on('mouseover', (event, d) =>
            onMouseOver(
              event,
              data,
              d,
              groupBy,
              aggregate,
              xType,
              minX,
              maxX,
              g,
              tooltip,
              container,
              axisCustomization
            )
          )
          .on('mousemove', (event, _) => onMouseMove(event, tooltip, container))
          .on('mouseout', (_) => onMouseOut(initialOpacity, g, tooltip))
          .on('click', (event, d) =>
            onClick(
              event,
              data,
              d,
              groupBy,
              aggregate,
              xType,
              minX,
              maxX,
              settings,
              axisCustomization
            )
          )
          .call((enter) =>
            enter
              .transition('enter')
              .duration(500)
              .attr('y', (d) => y(d.length))
              .attr('height', (d) => y(0) - y(d.length))
          ),
      (update) =>
        update.attr('fill', primary).call((update) =>
          update
            .transition('update')
            .duration(500)
            .attr('x', (d) => x(d.x0 as number))
            .attr('width', (d) => Math.max(0, x(d.x1 as number) - x(d.x0 as number) - 1))
            .attr('y', (d) => y(d.length))
            .attr('height', (d) => y(0) - y(d.length))
        ),
      (exit) =>
        exit.call((exit) =>
          exit.transition('exit').duration(500).attr('y', y(0)).attr('height', 0).remove()
        )
    );
  }
};
