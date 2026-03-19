'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import {
  GroupedDataLabel,
  DataLabel,
  GroupingColors,
  InfoCardData,
  AxisCustomization,
} from '@/types/interfaces/plot';
import { getValue, getRawValue, hasProperty } from './data';
import { drawAxes, generateTicks } from './axes';
import { getPrimaryColorFromNode } from './common';
import { renderGroupingKey } from './key';
import { showFixedTooltip, tooltipTemplate, positionTooltipRelativeToPointer } from './tooltip';
import { toComputableValue, computeStatistic } from '../common';

const getTooltipData = (
  d: GroupedDataLabel | DataLabel,
  xAxisProperty: string | undefined,
  yAxisProperty: string | undefined,
  metric: string,
  groupBy: string | undefined,
  aggregate: string | undefined,
  axisCustomization?: AxisCustomization
) => {
  // Use custom labels for tooltip if provided, otherwise use field names
  const xLabel = axisCustomization?.xAxisLabel || xAxisProperty || 'X';
  const yLabel = axisCustomization?.yAxisLabel || yAxisProperty || 'Y';
  const groupLabel = axisCustomization?.groupByLabel || groupBy || 'Group';
  const aggLabel = axisCustomization?.aggregateLabel || aggregate;

  if (groupBy) {
    const group = (d as GroupedDataLabel)[0];
    const xValue = (d as GroupedDataLabel)[1][0];
    const yValue = (d as GroupedDataLabel)[1][1];
    const data: InfoCardData = {
      group: {
        name: groupLabel,
        value: group,
      },
      x: {
        name: xLabel!,
        value: xValue,
      },
      y: {
        name: `${yLabel} (${metric})`,
        value: yValue,
      },
    };
    if (aggregate && aggLabel) {
      data.aggregate = {
        name: aggLabel,
      };
    }
    return data;
  } else {
    const xValue = (d as DataLabel)[0];
    const yValue = (d as DataLabel)[1];
    const data: InfoCardData = {
      x: {
        name: xLabel,
        value: xValue,
      },
      y: {
        name: `${yLabel} (${metric})`,
        value: yValue,
      },
    };
    if (aggregate && aggLabel) {
      data.aggregate = {
        name: aggLabel,
      };
    }
    return data;
  }
};

function onMouseOver(
  event: any,
  d: GroupedDataLabel | DataLabel,
  xAxisProperty: string | undefined,
  yAxisProperty: string | undefined,
  metric: string,
  groupBy: string | undefined,
  aggregate: string | undefined,
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  tooltip: d3.Selection<d3.BaseType, unknown, null, undefined>,
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  axisCustomization?: AxisCustomization
) {
  const tooltipData = getTooltipData(
    d,
    xAxisProperty,
    yAxisProperty,
    metric,
    groupBy,
    aggregate,
    axisCustomization
  );
  const template = tooltipTemplate(tooltipData);
  tooltip.html(template).transition('opacity').style('opacity', 1);
  positionTooltipRelativeToPointer(event, tooltip, container);
  if (groupBy) {
    // For grouped bar charts, completely hide other groups (opacity 0)
    const group = (d as GroupedDataLabel)[0];
    g.selectAll('rect.bar-item')
      .transition('opacity')
      .duration(200)
      .style('opacity', (barData) => ((barData as GroupedDataLabel)[0] === group ? 1 : 0));
  } else {
    // For ungrouped bar charts, dim other bars (opacity 0.3)
    const xValue = (d as DataLabel)[0];
    g.selectAll('rect.bar-item')
      .transition('opacity')
      .style('opacity', (bar) => ((bar as DataLabel)[0] === xValue ? 1 : 0.3));
  }
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
  g.selectAll('rect.bar-item').transition('opacity').style('opacity', initialOpacity);
}

function onClick(
  event: any,
  d: GroupedDataLabel | DataLabel,
  xAxisProperty: string | undefined,
  yAxisProperty: string | undefined,
  metric: string,
  groupBy: string | undefined,
  aggregate: string | undefined,
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  axisCustomization?: AxisCustomization
) {
  const tooltipData = getTooltipData(
    d,
    xAxisProperty,
    yAxisProperty,
    metric,
    groupBy,
    aggregate,
    axisCustomization
  );

  // Call external drawer callback if provided
  if (axisCustomization?.onDatapointPin) {
    const xLabel = axisCustomization.xAxisLabel || xAxisProperty || 'X';
    const yLabel = axisCustomization.yAxisLabel || yAxisProperty || 'Y';
    const groupLabel = axisCustomization.groupByLabel || groupBy || 'Group';

    if (groupBy) {
      const group = (d as GroupedDataLabel)[0];
      const xValue = (d as GroupedDataLabel)[1][0];
      const yValue = (d as GroupedDataLabel)[1][1];
      axisCustomization.onDatapointPin({
        id: `${group}-${xValue}-${yValue}`,
        x: { label: xLabel, value: xValue },
        y: { label: `${yLabel} (${metric})`, value: yValue },
        group: { label: groupLabel, value: String(group) },
      });
    } else {
      const xValue = (d as DataLabel)[0];
      const yValue = (d as DataLabel)[1];
      axisCustomization.onDatapointPin({
        id: `${xValue}-${yValue}`,
        x: { label: xLabel, value: xValue },
        y: { label: `${yLabel} (${metric})`, value: yValue },
      });
    }
  } else {
    // Fallback to old fixed tooltip behavior
    showFixedTooltip(event, tooltipData, settings);
  }
}

export const drawBarChart = (
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
  metric: string,
  sortBars: string | undefined,
  xTable: string,
  yTable: string,
  logs: LogProps[],
  fields: LogFieldsResponseProps,
  zoomRef: any,
  groupByColors: string = 'schemeCategory10',
  interactive: boolean = true,
  preAggregatedData?: DataLabel[] | GroupedDataLabel[],
  axisCustomization?: AxisCustomization
) => {
  // Clear previous elements
  const g = svg.select('.plotData');
  g.selectAll('circle.data-point').remove();
  g.selectAll('circle.hover-area').remove();
  g.selectAll('path.line-item').remove();
  g.selectAll('rect.hist-item').remove();
  g.selectAll('text.correlation').remove();
  g.selectAll('text.correlation-group').remove();
  g.selectAll('path.best-fit').remove();

  // Prepare data
  const properties = Object.entries(fields || {}).map(([name]) => name);
  const xAxisProperty =
    selectedXAxisProperty && properties.includes(selectedXAxisProperty)
      ? selectedXAxisProperty
      : properties.at(0);
  const yAxisProperty =
    selectedYAxisProperty && properties.includes(selectedYAxisProperty)
      ? selectedYAxisProperty
      : selectedYAxisProperty
        ? properties.at(0)
        : undefined;
  const isCountOnly = !selectedYAxisProperty;
  let data: DataLabel[] | GroupedDataLabel[] = [];

  // Use pre-aggregated data if available (from backend), otherwise compute client-side
  if (preAggregatedData && preAggregatedData.length > 0) {
    data = preAggregatedData;
    // Apply sorting to pre-aggregated data
    if (!groupBy && sortBars && sortBars !== 'unsorted') {
      (data as DataLabel[]).sort((a, b) => {
        const yA = a[1];
        const yB = b[1];
        switch (sortBars) {
          case 'asc':
            return yA - yB;
          case 'desc':
            return yB - yA;
          default:
            return yA - yB;
        }
      });
    } else {
      // Sort by x-axis value (category)
      if (groupBy) {
        // For grouped data: sort by x-axis first, then by y-value descending
        // This ensures taller bars are drawn first (underneath) and shorter bars last (on top)
        const isNumericX = (data as GroupedDataLabel[]).every((item) => !isNaN(Number(item[1][0])));
        (data as GroupedDataLabel[]).sort((a, b) => {
          // Primary sort: by x-axis value
          const xCompare = isNumericX
            ? Number(a[1][0]) - Number(b[1][0])
            : a[1][0].localeCompare(b[1][0]);
          if (xCompare !== 0) return xCompare;
          // Secondary sort: by y-value descending (taller bars first, shorter last)
          return b[1][1] - a[1][1];
        });
      } else {
        (data as DataLabel[]).every((item) => !isNaN(Number(item[0])))
          ? (data as DataLabel[]).sort((a, b) => Number(a[0]) - Number(b[0]))
          : (data as DataLabel[]).sort((a, b) => a[0].localeCompare(b[0]));
      }
    }
  } else if (xAxisProperty && isCountOnly) {
    // Count-only aggregation: no yAxis, count rows per xAxis category
    const filteredData = logs.filter((log) => {
      const hasX = hasProperty(fields, xAxisProperty, log, xTable);
      const hasGroup = groupBy ? hasProperty(fields, groupBy, log, xTable) : true;
      return hasX && hasGroup;
    });
    if (groupBy) {
      const groupsMap = d3.groups(filteredData, (d) => getRawValue(fields, groupBy, d, xTable));
      for (const [groupKey, groupLogs] of groupsMap) {
        const subGroups = d3.rollup(
          groupLogs,
          (v) => v.length,
          (d) => String(getRawValue(fields, xAxisProperty, d, xTable) ?? '')
        );
        for (const subGroup of Array.from(subGroups)) {
          (data as GroupedDataLabel[]).push([String(groupKey), subGroup]);
        }
      }
    } else {
      const groups = d3.rollup(
        filteredData,
        (v) => v.length,
        (d) => String(getRawValue(fields, xAxisProperty, d, xTable) ?? '')
      );
      data = Array.from(groups, ([group, value]) => [group, value]) as DataLabel[];
    }
    if (!groupBy && sortBars && sortBars !== 'unsorted') {
      (data as DataLabel[]).sort((a, b) => {
        switch (sortBars) {
          case 'asc':
            return a[1] - b[1];
          case 'desc':
            return b[1] - a[1];
          default:
            return a[1] - b[1];
        }
      });
    }
  } else if (xAxisProperty && yAxisProperty) {
    // Client-side computation fallback
    const filteredData = logs.filter((log) => {
      const hasX = hasProperty(fields, xAxisProperty, log, xTable);
      const hasY = hasProperty(fields, yAxisProperty, log, yTable);
      const hasGroup = groupBy ? hasProperty(fields, groupBy, log, xTable) : true;
      return hasX && hasY && hasGroup;
    });
    const statistic = (vals: number[]) => parseFloat(computeStatistic(metric, vals));
    if (groupBy) {
      // Use getRawValue for groupBy to keep string values (e.g., model names)
      const groupsMap = d3.groups(filteredData, (d) => getRawValue(fields, groupBy, d, xTable));
      for (const [groupKey, groupLogs] of groupsMap) {
        const subGroups = d3.rollup(
          groupLogs,
          (v) =>
            statistic(
              v.map((log) => toComputableValue(getValue(fields, yAxisProperty, log, yTable)))
            ),
          // Use getRawValue for x-axis to keep date strings as-is (not converted to timestamps)
          (d) => String(getRawValue(fields, xAxisProperty, d, xTable) ?? '')
        );
        for (const subGroup of Array.from(subGroups)) {
          (data as GroupedDataLabel[]).push([String(groupKey), subGroup]);
        }
      }
    } else {
      const groups = d3.rollup(
        filteredData,
        (v) =>
          statistic(
            v.map((log) => toComputableValue(getValue(fields, yAxisProperty, log, yTable)))
          ),
        // Use getRawValue for x-axis to keep date strings as-is (not converted to timestamps)
        (d) => String(getRawValue(fields, xAxisProperty, d, xTable) ?? '')
      );
      data = Array.from(groups, ([group, value]) => [group, value]) as DataLabel[];
    }
    if (!groupBy && sortBars != 'unsorted') {
      (data as DataLabel[]).sort((a, b) => {
        const yA = a[1];
        const yB = b[1];
        switch (sortBars) {
          case 'asc':
            return yA - yB;
          case 'desc':
            return yB - yA;
          default:
            return yA - yB;
        }
      });
    } else {
      if (groupBy) {
        // For grouped data: sort by x-axis first, then by y-value descending
        // This ensures taller bars are drawn first (underneath) and shorter bars last (on top)
        const isNumericX = (data as GroupedDataLabel[]).every((item) => !isNaN(Number(item[1][0])));
        (data as GroupedDataLabel[]).sort((a, b) => {
          // Primary sort: by x-axis value
          const xCompare = isNumericX
            ? Number(a[1][0]) - Number(b[1][0])
            : a[1][0].localeCompare(b[1][0]);
          if (xCompare !== 0) return xCompare;
          // Secondary sort: by y-value descending (taller bars first, shorter last)
          return b[1][1] - a[1][1];
        });
      } else {
        (data as DataLabel[]).every((item) => !isNaN(Number(item[0])))
          ? (data as DataLabel[]).sort((a, b) => Number(a[0]) - Number(b[0]))
          : (data as DataLabel[]).sort((a, b) => a[0].localeCompare(b[0]));
      }
    }
  }

  // Define scales
  const [width, height] = [dimensions.width, dimensions.height];
  const xDomain = groupBy
    ? Array.from(new Set((data as GroupedDataLabel[]).flatMap((d) => d[1][0])))
    : Array.from(new Set((data as DataLabel[]).map((d) => d[0])));
  const xRange = [margins.left, width - margins.right];
  const yValues = groupBy
    ? (data as GroupedDataLabel[]).flatMap((d) => d[1][1])
    : (data as DataLabel[]).map((d) => d[1]);
  let [minY, maxY] = d3.extent(yValues) as [number, number];
  if (minY === undefined || maxY === undefined) {
    minY = 0;
    maxY = 1;
  } else if (minY === maxY) {
    minY = minY - 1;
    maxY = maxY + 1;
  } else if (minY > 0 && maxY > 0) {
    minY = Math.min(0, minY);
  } else if (minY < 0 && maxY < 0) {
    minY = Math.min(0, minY);
  }
  let yDomain = [minY, maxY];
  const xScale = d3.scaleBand().domain(xDomain).range(xRange).padding(0.2);
  const yRange = [
    height - margins.bottom - axisPadding * Number(yValues.some((d) => d < 0)),
    margins.top + axisPadding * Number(yValues.some((d) => d > 0)),
  ];
  const yScale = (scaleY === 'log' ? d3.scaleLog() : d3.scaleLinear())
    .domain(yDomain)
    .range(yRange);

  // Draw axes with optional custom labels
  const [xTicks, yTicks] = [
    generateTicks(0, 0, 10, scaleX === 'log'),
    generateTicks(minY, maxY, 10, scaleY === 'log'),
  ];

  // Determine axis labels - use custom labels if provided, otherwise use field names
  const showXLabel = axisCustomization?.showXAxisLabel !== false;
  const showYLabel = axisCustomization?.showYAxisLabel !== false;
  const xLabel = showXLabel ? axisCustomization?.xAxisLabel || xAxisProperty : undefined;
  const yLabel = showYLabel
    ? axisCustomization?.yAxisLabel ||
      (isCountOnly ? 'Count' : yAxisProperty ? `${yAxisProperty} (${metric})` : undefined)
    : undefined;

  drawAxes(
    'Bar Chart',
    svg,
    dimensions,
    margins,
    xScale,
    yScale,
    xTicks,
    yTicks,
    undefined,
    undefined,
    xLabel,
    yLabel,
    undefined, // xType
    undefined, // yType
    axisCustomization?.xTickFormatter,
    axisCustomization?.yTickFormatter
  );

  // Tooltip and grouping key
  const tooltip = container.select('.plotTooltip').style('opacity', 0);

  // Draw bars
  const initialOpacity = groupBy ? 0.7 : 1.0;
  if (groupBy) {
    const groupDomain = Array.from(new Set((data as GroupedDataLabel[]).map((d) => d[0])));
    const colorRange = d3[groupByColors as keyof typeof d3] as readonly string[];
    const colorScale = d3.scaleOrdinal<string>(d3.schemeCategory10).domain(colorRange);
    g.selectAll<SVGRectElement, GroupedDataLabel>('rect.bar-item')
      .data(
        data as GroupedDataLabel[],
        (d) => `${(d as GroupedDataLabel)[0]}-${(d as GroupedDataLabel)[1][0]}`
      )
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('class', 'bar-item')
            .attr('x', (d) => xScale(d[1][0])!)
            .attr('width', xScale.bandwidth())
            .attr('y', yScale(0))
            .attr('height', 0)
            .attr('fill', (d) => colorScale(d[0]))
            .style('opacity', 0)
            .style('cursor', 'pointer')
            .call((enter) =>
              enter
                .transition('enter')
                .duration(500)
                .attr('y', (d) => yScale(Math.max(0, d[1][1])))
                .attr('height', (d) => Math.abs(yScale(d[1][1]) - yScale(0)))
                .style('opacity', initialOpacity)
            ),
        (update) =>
          update.call((update) =>
            update
              .transition('update')
              .duration(500)
              .attr('x', (d) => xScale(d[1][0])!)
              .attr('width', xScale.bandwidth())
              .attr('y', (d) => yScale(Math.max(0, d[1][1])))
              .attr('height', (d) => Math.abs(yScale(d[1][1]) - yScale(0)))
              .attr('fill', (d) => colorScale(d[0]))
              .style('opacity', initialOpacity)
          ),
        (exit) =>
          exit
            .transition('exit')
            .duration(500)
            .attr('height', 0)
            .attr('y', yScale(0))
            .style('opacity', 0)
            .remove()
      );
    // Grouping Key
    const colors: GroupingColors = groupDomain.map((groupKey) => ({
      key: groupKey,
      color: colorScale(groupKey),
    }));
    renderGroupingKey(settings, colors);
    // Notify parent about groups (for external drawer)
    axisCustomization?.onGroupsChange?.(colors);
  } else {
    const primary = getPrimaryColorFromNode(svg.node());
    renderGroupingKey(settings, null);
    // Clear groups in parent (no grouping)
    axisCustomization?.onGroupsChange?.([]);
    g.selectAll<SVGRectElement, DataLabel>('rect.bar-item')
      .data(data as DataLabel[], (d) => d[0])
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('class', 'bar-item')
            .attr('x', (d) => xScale(d[0])!)
            .attr('width', xScale.bandwidth())
            .attr('y', yScale(0))
            .attr('height', 0)
            .attr('fill', primary)
            .style('cursor', 'pointer')
            .call((enter) =>
              enter
                .transition('enter')
                .duration(500)
                .attr('y', (d) => yScale(Math.max(0, d[1])))
                .attr('height', (d) => Math.abs(yScale(d[1]) - yScale(0)))
            ),
        (update) =>
          update
            .call((update) =>
              update
                .transition('update')
                .duration(500)
                .attr('x', (d) => xScale(d[0])!)
                .attr('width', xScale.bandwidth())
                .attr('y', (d) => yScale(Math.max(0, d[1])))
                .attr('height', (d) => Math.abs(yScale(d[1]) - yScale(0)))
            )
            .attr('fill', primary),
        (exit) =>
          exit.transition('exit').duration(500).attr('height', 0).attr('y', yScale(0)).remove()
      );
  }

  // Attach event handlers to the bars
  g.selectAll('rect.bar-item')
    .on('mouseover', (e, d) =>
      onMouseOver(
        e,
        d as GroupedDataLabel | DataLabel,
        xAxisProperty,
        yAxisProperty,
        metric,
        groupBy,
        aggregate,
        g,
        tooltip,
        container,
        axisCustomization
      )
    )
    .on('mousemove', (e, _) => onMouseMove(e, tooltip, container))
    .on('mouseout', (_) => onMouseOut(initialOpacity, g, tooltip))
    .on('click', (e, d) =>
      onClick(
        e,
        d as GroupedDataLabel | DataLabel,
        xAxisProperty,
        yAxisProperty,
        metric,
        groupBy,
        aggregate,
        settings,
        axisCustomization
      )
    );

  // Note: External highlight from drawer is handled by PlotCanvas useEffect
  // to avoid full redraws on highlight changes
};
