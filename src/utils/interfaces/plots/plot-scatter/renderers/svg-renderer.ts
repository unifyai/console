'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue } from '../../data';
import { ScatterRenderer, ScatterPlotOptions, ScaleContext, ColorContext } from '../types';
import { getConfig } from '../config';

/**
 * SVG-based scatter plot renderer using D3.js.
 * Best for datasets up to ~2000 points where rich interactivity is needed.
 */
export class SVGScatterRenderer implements ScatterRenderer {
  private g: d3.Selection<d3.BaseType, unknown, null, undefined>;
  private data: LogProps[] = [];
  private options: ScatterPlotOptions | null = null;
  private scaleContext: ScaleContext | null = null;
  private colorContext: ColorContext | null = null;
  private visible: boolean = true;

  constructor(private svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>) {
    this.g = svg.select('.plotData');
  }

  render(
    data: LogProps[],
    options: ScatterPlotOptions,
    scaleContext: ScaleContext,
    colorContext: ColorContext,
    highlightIndex?: number
  ): void {
    this.data = data;
    this.options = options;
    this.scaleContext = scaleContext;
    this.colorContext = colorContext;

    const {
      fields,
      xAxisProperty,
      yAxisProperty,
      xTable,
      yTable,
      groupBy,
      aggregate,
      showRegression,
      settings,
    } = options;
    const { x, y, reverseX, reverseY } = scaleContext;
    const { primary, colorScale } = colorContext;
    const config = getConfig();

    // Remove other plot type elements
    this.g.selectAll('path.line-item').remove();
    this.g.selectAll('rect.bar-item').remove();
    this.g.selectAll('rect.hist-item').remove();

    // Render data points
    const points = this.g
      .selectAll('circle.data-point')
      .data(data, (d: unknown) => (d as LogProps)[`${xTable}.id`] as string);

    points.join(
      (enter) =>
        enter
          .append('circle')
          .attr('class', 'data-point')
          .attr(
            'fill',
            groupBy
              ? (d) => colorScale(JSON.stringify(getValue(fields, groupBy, d, xTable)))
              : primary
          )
          .attr(
            'stroke',
            groupBy
              ? (d) => colorScale(JSON.stringify(getValue(fields, groupBy, d, xTable)))
              : primary
          )
          .attr('cx', (d) => {
            const val = getValue(fields, xAxisProperty, d, xTable) as number;
            return x(reverseX ? Math.abs(val) : val);
          })
          .attr('cy', (d) => {
            const val = getValue(fields, yAxisProperty, d, yTable) as number;
            return y(reverseY ? Math.abs(val) : val);
          })
          .attr('r', config.POINT_SIZE)
          .style('opacity', 0)
          .style('cursor', 'pointer')
          .call((enter) => enter.transition('enter').duration(200).style('opacity', 1)),
      (update) =>
        update
          .attr(
            'fill',
            groupBy
              ? (d) => colorScale(JSON.stringify(getValue(fields, groupBy, d, xTable)))
              : primary
          )
          .attr(
            'stroke',
            groupBy
              ? (d) => colorScale(JSON.stringify(getValue(fields, groupBy, d, xTable)))
              : primary
          )
          .call((update) =>
            update
              .transition('update')
              .duration(250)
              .attr('cx', (d) => {
                const val = getValue(fields, xAxisProperty, d, xTable) as number;
                return x(reverseX ? Math.abs(val) : val);
              })
              .attr('cy', (d) => {
                const val = getValue(fields, yAxisProperty, d, yTable) as number;
                return y(reverseY ? Math.abs(val) : val);
              })
              .attr('r', config.POINT_SIZE)
              .style('opacity', 1)
          ),
      (exit) => exit.call((exit) => exit.transition('exit').duration(200).attr('r', 0).remove())
    );

    // Render invisible hover areas for better interaction
    this.g
      .selectAll('circle.hover-area')
      .data(data)
      .join('circle')
      .style('cursor', 'pointer')
      .attr('cx', (d) => {
        const val = getValue(fields, xAxisProperty, d, xTable) as number;
        return x(reverseX ? Math.abs(val) : val);
      })
      .attr('cy', (d) => {
        const val = getValue(fields, yAxisProperty, d, yTable) as number;
        return y(reverseY ? Math.abs(val) : val);
      })
      .attr('r', 10)
      .attr('fill', 'transparent')
      .attr('stroke', 'none')
      .style('pointer-events', 'all')
      .attr('class', 'hover-area');

    // Apply highlight if specified
    if (highlightIndex !== undefined && highlightIndex >= 0) {
      this.applyHighlight(highlightIndex);
    }
  }

  /**
   * Apply hover highlight effect to a specific point
   */
  applyHighlight(index: number): void {
    if (!this.options || !this.data.length) return;

    const { fields, xTable, groupBy, showRegression } = this.options;
    const config = getConfig();
    const datum = this.data[index];
    const hoveredId = datum[`${xTable}.id`];

    this.g
      .selectAll<SVGCircleElement, LogProps>('circle.data-point')
      .transition('hover_effect')
      .duration(150)
      .attr('r', (d) => (d[`${xTable}.id`] === hoveredId ? config.HOVER_SIZE : config.POINT_SIZE))
      .style('opacity', (d) => (d[`${xTable}.id`] === hoveredId ? 1 : config.DIM_OPACITY));

    // Handle grouped dimming
    if (groupBy && showRegression === 'true') {
      const hoveredGroup = JSON.stringify(getValue(fields, groupBy, datum, xTable));
      this.g
        .selectAll('path.best-fit')
        .style('opacity', (d: any) => (d.groupKey === hoveredGroup ? 1 : 0.1));
      this.g
        .selectAll('text.correlation-group')
        .style('opacity', (d: any) => (d.groupKey === hoveredGroup ? 1 : 0.1));
    }
  }

  /**
   * Clear all highlight effects
   */
  clearHighlight(): void {
    if (!this.options) return;

    const config = getConfig();

    this.g
      .selectAll('circle.data-point')
      .transition('hover_effect_out')
      .duration(150)
      .attr('r', config.POINT_SIZE)
      .style('opacity', 1);

    if (this.options.showRegression === 'true') {
      this.g.selectAll('path.best-fit').style('opacity', 1);
      this.g.selectAll('text.correlation, text.correlation-group').style('opacity', 1);
    }
  }

  findPointAt(clientX: number, clientY: number): number {
    // SVG elements handle their own hit detection via DOM events
    // This method is used for external callers
    if (!this.data.length || !this.options || !this.scaleContext) return -1;

    const { fields, xAxisProperty, yAxisProperty, xTable, yTable } = this.options;
    const { x, y, reverseX, reverseY } = this.scaleContext;
    const config = getConfig();

    // Get container position for coordinate conversion
    const svgNode = this.svg.node();
    if (!svgNode) return -1;

    const rect = svgNode.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    let closestIndex = -1;
    let closestDist = config.HIT_THRESHOLD;

    for (let i = 0; i < this.data.length; i++) {
      const d = this.data[i];
      const xVal = getValue(fields, xAxisProperty, d, xTable) as number;
      const yVal = getValue(fields, yAxisProperty, d, yTable) as number;

      const screenX = x(reverseX ? Math.abs(xVal) : xVal);
      const screenY = y(reverseY ? Math.abs(yVal) : yVal);

      const dist = Math.hypot(mouseX - screenX, mouseY - screenY);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  resize(width: number, height: number): void {
    // SVG resizing is handled by the parent container
    // Re-render will be triggered by dimension change
  }

  dispose(): void {
    this.g.selectAll('circle.data-point').remove();
    this.g.selectAll('circle.hover-area').remove();
    this.data = [];
  }

  getData(): LogProps[] {
    return this.data;
  }

  isActive(): boolean {
    return this.visible && this.data.length > 0;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) {
      this.g.selectAll('circle.data-point').style('display', 'none');
      this.g.selectAll('circle.hover-area').style('display', 'none');
    } else {
      this.g.selectAll('circle.data-point').style('display', null);
      this.g.selectAll('circle.hover-area').style('display', null);
    }
  }

  /**
   * Get the D3 selection for the plot data group (for event binding)
   */
  getPlotGroup(): d3.Selection<d3.BaseType, unknown, null, undefined> {
    return this.g;
  }

  /**
   * Get point positions for external use
   */
  getPointScreenPosition(index: number): { x: number; y: number } | null {
    if (!this.options || !this.scaleContext || index < 0 || index >= this.data.length) {
      return null;
    }

    const { fields, xAxisProperty, yAxisProperty, xTable, yTable } = this.options;
    const { x, y, reverseX, reverseY } = this.scaleContext;
    const d = this.data[index];

    const xVal = getValue(fields, xAxisProperty, d, xTable) as number;
    const yVal = getValue(fields, yAxisProperty, d, yTable) as number;

    return {
      x: x(reverseX ? Math.abs(xVal) : xVal),
      y: y(reverseY ? Math.abs(yVal) : yVal),
    };
  }
}
