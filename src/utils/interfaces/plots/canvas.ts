"use client";

import * as d3 from "d3";

/**
 * Clears the content axes and zero lines from the canvas
 * @param settingsRef ref element for the svg canvas.
*/
export function clearCanvas (svgRef: any, containerRef: any) {
    const svg = d3.select(svgRef.current)
    const g = svg.select(".plotData")
    const xAxis = svg.select(".xAxis")
    const yAxis = svg.select(".yAxis")
    const xZero = svg.select(".x-zero")
    const yZero = svg.select(".y-zero")

    g.selectAll("*").remove();
    xAxis.selectAll("*").remove();
    yAxis.selectAll("*").remove();
    xZero.style("opacity", 0)
    yZero.style("opacity", 0)

}

/**
 * Draw left and bottom border for the plot canvas
 * @param svg d3.Selection for the svg canvas.
 * @param height computed height of the svg canvas.
 * @param width computed width of the svg canvas.
 * @param margins border margins for the svg canvas.
*/

export const drawBorders = (
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
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