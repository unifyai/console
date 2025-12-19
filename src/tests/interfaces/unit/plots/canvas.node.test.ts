/**
 * Unit tests for the Canvas module (canvas.ts)
 * Tests the clearCanvas and drawBorders functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as d3 from "d3";
import { JSDOM } from "jsdom";
import { clearCanvas, drawBorders } from "@/utils/interfaces/plots/canvas";

describe("Canvas Module", () => {
    const meta = {
        scenario: "Testing canvas clearing and border drawing utilities",
        behavior: "Verifies that canvas elements are properly cleared and borders are correctly positioned"
    };

    let dom: JSDOM;
    let document: Document;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="container">
                    <svg class="plotSvg">
                        <g class="plotData">
                            <circle class="data-point" cx="10" cy="10" r="5"></circle>
                            <circle class="data-point" cx="20" cy="20" r="5"></circle>
                            <path class="line-item" d="M0,0 L100,100"></path>
                        </g>
                        <g class="xAxis">
                            <line x1="0" y1="0" x2="100" y2="0"></line>
                            <text>X Label</text>
                        </g>
                        <g class="yAxis">
                            <line x1="0" y1="0" x2="0" y2="100"></line>
                            <text>Y Label</text>
                        </g>
                        <line class="x-zero" style="opacity: 1"></line>
                        <line class="y-zero" style="opacity: 1"></line>
                        <line class="bottomLine"></line>
                        <line class="leftLine"></line>
                        <line class="topLine"></line>
                    </svg>
                </div>
            </body>
            </html>
        `);
        document = dom.window.document;
        (global as any).document = document;
    });

    afterEach(() => {
        delete (global as any).document;
    });

    describe("clearCanvas", () => {
        const meta = {
            scenario: "Clearing all plot elements from the SVG canvas",
            behavior: "Removes data points, lines, axes content, and hides zero lines"
        };

        it("removes all elements from plotData group", () => {
            const meta = {
                scenario: "Clearing plot data elements",
                behavior: "All children of plotData group should be removed"
            };

            const svgElement = document.querySelector(".plotSvg");
            const containerElement = document.querySelector(".container");
            
            const svgRef = { current: svgElement };
            const containerRef = { current: containerElement };

            // Verify elements exist before clearing
            const plotData = svgElement?.querySelector(".plotData");
            expect(plotData?.children.length).toBeGreaterThan(0);

            clearCanvas(svgRef, containerRef);

            // Verify elements are removed
            expect(plotData?.children.length).toBe(0);
        });

        it("removes all elements from xAxis group", () => {
            const meta = {
                scenario: "Clearing X axis elements",
                behavior: "All children of xAxis group should be removed"
            };

            const svgElement = document.querySelector(".plotSvg");
            const containerElement = document.querySelector(".container");
            
            const svgRef = { current: svgElement };
            const containerRef = { current: containerElement };

            // Verify elements exist before clearing
            const xAxis = svgElement?.querySelector(".xAxis");
            expect(xAxis?.children.length).toBeGreaterThan(0);

            clearCanvas(svgRef, containerRef);

            // Verify elements are removed
            expect(xAxis?.children.length).toBe(0);
        });

        it("removes all elements from yAxis group", () => {
            const meta = {
                scenario: "Clearing Y axis elements",
                behavior: "All children of yAxis group should be removed"
            };

            const svgElement = document.querySelector(".plotSvg");
            const containerElement = document.querySelector(".container");
            
            const svgRef = { current: svgElement };
            const containerRef = { current: containerElement };

            // Verify elements exist before clearing
            const yAxis = svgElement?.querySelector(".yAxis");
            expect(yAxis?.children.length).toBeGreaterThan(0);

            clearCanvas(svgRef, containerRef);

            // Verify elements are removed
            expect(yAxis?.children.length).toBe(0);
        });

        it("hides x-zero line (opacity 0)", () => {
            const meta = {
                scenario: "Hiding X zero reference line",
                behavior: "X zero line should have opacity 0"
            };

            const svgElement = document.querySelector(".plotSvg");
            const containerElement = document.querySelector(".container");
            
            const svgRef = { current: svgElement };
            const containerRef = { current: containerElement };

            clearCanvas(svgRef, containerRef);

            const xZero = svgElement?.querySelector(".x-zero") as HTMLElement;
            expect(xZero?.style.opacity).toBe("0");
        });

        it("hides y-zero line (opacity 0)", () => {
            const meta = {
                scenario: "Hiding Y zero reference line",
                behavior: "Y zero line should have opacity 0"
            };

            const svgElement = document.querySelector(".plotSvg");
            const containerElement = document.querySelector(".container");
            
            const svgRef = { current: svgElement };
            const containerRef = { current: containerElement };

            clearCanvas(svgRef, containerRef);

            const yZero = svgElement?.querySelector(".y-zero") as HTMLElement;
            expect(yZero?.style.opacity).toBe("0");
        });
    });

    describe("drawBorders", () => {
        const meta = {
            scenario: "Drawing border lines around the plot area",
            behavior: "Positions bottom, left, and top lines correctly based on dimensions and margins"
        };

        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };

        it("positions bottom line at correct y coordinate", () => {
            const meta = {
                scenario: "Positioning bottom border line",
                behavior: "Bottom line should be at (height - margins.bottom)"
            };

            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, dimensions.height, dimensions.width, margins);

            const bottomLine = svgElement.querySelector(".bottomLine");
            expect(bottomLine?.getAttribute("y1")).toBe((dimensions.height - margins.bottom).toString());
            expect(bottomLine?.getAttribute("y2")).toBe((dimensions.height - margins.bottom).toString());
        });

        it("positions left line at correct x coordinate", () => {
            const meta = {
                scenario: "Positioning left border line",
                behavior: "Left line should be at margins.left"
            };

            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, dimensions.height, dimensions.width, margins);

            const leftLine = svgElement.querySelector(".leftLine");
            expect(leftLine?.getAttribute("x1")).toBe(margins.left.toString());
            expect(leftLine?.getAttribute("x2")).toBe(margins.left.toString());
        });

        it("positions top line at correct y coordinate", () => {
            const meta = {
                scenario: "Positioning top border line",
                behavior: "Top line should be at margins.top"
            };

            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, dimensions.height, dimensions.width, margins);

            const topLine = svgElement.querySelector(".topLine");
            expect(topLine?.getAttribute("y1")).toBe(margins.top.toString());
            expect(topLine?.getAttribute("y2")).toBe(margins.top.toString());
        });

        it("bottom line spans correct width based on dimensions", () => {
            const meta = {
                scenario: "Bottom line width calculation",
                behavior: "Bottom line should span from x1=0 to x2=(width + margins.left)"
            };

            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, dimensions.height, dimensions.width, margins);

            const bottomLine = svgElement.querySelector(".bottomLine");
            expect(bottomLine?.getAttribute("x1")).toBe("0");
            expect(bottomLine?.getAttribute("x2")).toBe((dimensions.width + margins.left).toString());
        });

        it("left line spans correct height based on dimensions", () => {
            const meta = {
                scenario: "Left line height calculation",
                behavior: "Left line should span from y1=margins.top to y2=(height - margins.bottom)"
            };

            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, dimensions.height, dimensions.width, margins);

            const leftLine = svgElement.querySelector(".leftLine");
            expect(leftLine?.getAttribute("y1")).toBe(margins.top.toString());
            expect(leftLine?.getAttribute("y2")).toBe((dimensions.height - margins.bottom).toString());
        });

        it("top line spans correct width based on dimensions", () => {
            const meta = {
                scenario: "Top line width calculation",
                behavior: "Top line should span from x1=0 to x2=(width + margins.left)"
            };

            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, dimensions.height, dimensions.width, margins);

            const topLine = svgElement.querySelector(".topLine");
            expect(topLine?.getAttribute("x1")).toBe("0");
            expect(topLine?.getAttribute("x2")).toBe((dimensions.width + margins.left).toString());
        });

        it("respects different margin values", () => {
            const meta = {
                scenario: "Border drawing with custom margins",
                behavior: "Lines should be positioned according to provided margins"
            };

            const customMargins = { top: 10, right: 15, bottom: 25, left: 30 };
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, dimensions.height, dimensions.width, customMargins);

            const bottomLine = svgElement.querySelector(".bottomLine");
            const leftLine = svgElement.querySelector(".leftLine");
            const topLine = svgElement.querySelector(".topLine");

            expect(bottomLine?.getAttribute("y1")).toBe((dimensions.height - customMargins.bottom).toString());
            expect(leftLine?.getAttribute("x1")).toBe(customMargins.left.toString());
            expect(topLine?.getAttribute("y1")).toBe(customMargins.top.toString());
        });

        it("handles zero margins", () => {
            const meta = {
                scenario: "Border drawing with zero margins",
                behavior: "Lines should be at edges of SVG"
            };

            const zeroMargins = { top: 0, right: 0, bottom: 0, left: 0 };
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, dimensions.height, dimensions.width, zeroMargins);

            const bottomLine = svgElement.querySelector(".bottomLine");
            const leftLine = svgElement.querySelector(".leftLine");
            const topLine = svgElement.querySelector(".topLine");

            expect(bottomLine?.getAttribute("y1")).toBe(dimensions.height.toString());
            expect(leftLine?.getAttribute("x1")).toBe("0");
            expect(topLine?.getAttribute("y1")).toBe("0");
        });

        it("handles small dimensions", () => {
            const meta = {
                scenario: "Border drawing with small dimensions",
                behavior: "Lines should still be positioned correctly"
            };

            const smallDimensions = { width: 100, height: 80 };
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const svg = d3.select(svgElement) as d3.Selection<SVGSVGElement | null, unknown, null, undefined>;

            drawBorders(svg, smallDimensions.height, smallDimensions.width, margins);

            const bottomLine = svgElement.querySelector(".bottomLine");
            expect(bottomLine?.getAttribute("y1")).toBe((smallDimensions.height - margins.bottom).toString());
        });
    });
});


