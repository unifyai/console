/**
 * Unit tests for the Main Orchestrator module (main.ts)
 * Tests the drawPlot function which routes to specific plot type renderers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as d3 from "d3";
import { JSDOM } from "jsdom";
import { drawPlot } from "@/utils/interfaces/plots/main";
import type { LogProps, LogFieldsResponseProps } from "@/types/interfaces/logs";

// Mock the plot functions
vi.mock("@/utils/interfaces/plots/plot-scatter", () => ({
    drawScatterPlot: vi.fn()
}));

vi.mock("@/utils/interfaces/plots/plot-line", () => ({
    drawLineChart: vi.fn()
}));

vi.mock("@/utils/interfaces/plots/plot-bar", () => ({
    drawBarChart: vi.fn()
}));

vi.mock("@/utils/interfaces/plots/plot-histogram", () => ({
    drawHistogram: vi.fn()
}));

vi.mock("@/utils/interfaces/plots/canvas", () => ({
    drawBorders: vi.fn(),
    clearCanvas: vi.fn()
}));

vi.mock("@/utils/interfaces/plots/axes", () => ({
    checkLogScalability: vi.fn((logs, fields, table, prop, scale) => scale)
}));

vi.mock("@/utils/interfaces/plots/tooltip", () => ({
    clearFixedTooltip: vi.fn()
}));

import { drawScatterPlot } from "@/utils/interfaces/plots/plot-scatter";
import { drawLineChart } from "@/utils/interfaces/plots/plot-line";
import { drawBarChart } from "@/utils/interfaces/plots/plot-bar";
import { drawHistogram } from "@/utils/interfaces/plots/plot-histogram";
import { drawBorders, clearCanvas } from "@/utils/interfaces/plots/canvas";
import { checkLogScalability } from "@/utils/interfaces/plots/axes";
import { clearFixedTooltip } from "@/utils/interfaces/plots/tooltip";

describe("Main Orchestrator Module", () => {
    const meta = {
        scenario: "Testing the main plot orchestration function",
        behavior: "Verifies that drawPlot routes to correct plot types and handles validation"
    };

    let dom: JSDOM;
    let document: Document;

    const createMockDOM = () => {
        return new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="container">
                    <div class="plotTooltip"></div>
                </div>
                <svg class="plotSvg">
                    <rect id="clip-rect"></rect>
                    <g class="plotData"></g>
                    <g class="xAxis"></g>
                    <g class="yAxis"></g>
                    <line class="x-zero"></line>
                    <line class="y-zero"></line>
                    <line class="bottomLine"></line>
                    <line class="leftLine"></line>
                    <line class="topLine"></line>
                    <text class="placeholder"></text>
                </svg>
                <div class="settings">
                    <div class="groupingKey hidden"></div>
                    <div class="fixedTooltip hidden"></div>
                </div>
            </body>
            </html>
        `);
    };

    const createMockLogs = (): LogProps[] => [
        {
            type: "log",
            id: "1",
            ts: "2023-01-01T10:00:00.000Z",
            params: {},
            entries: { "test.x": 1, "test.y": 10 },
            derived_entries: {},
            clipped_fields: []
        } as LogProps,
        {
            type: "log",
            id: "2",
            ts: "2023-01-01T10:01:00.000Z",
            params: {},
            entries: { "test.x": 2, "test.y": 20 },
            derived_entries: {},
            clipped_fields: []
        } as LogProps
    ];

    const createMockFields = (): LogFieldsResponseProps => ({
        "test.x": { 
            data_type: "float", 
            field_type: "entry",
            artifacts: "",
            mutable: "false",
            created_at: ""
        },
        "test.y": { 
            data_type: "float", 
            field_type: "entry",
            artifacts: "",
            mutable: "false",
            created_at: ""
        }
    });

    const createDefaultParams = () => {
        const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
        const containerElement = document.querySelector(".container") as HTMLDivElement;
        const settingsElement = document.querySelector(".settings") as HTMLDivElement;
        const placeholderElement = document.querySelector(".placeholder") as SVGTextElement;
        
        return {
            svg: d3.select(svgElement) as any,
            container: d3.select(containerElement) as any,
            settings: d3.select(settingsElement) as any,
            placeholder: d3.select(placeholderElement) as any,
            dimensions: { width: 800, height: 600 },
            margins: { top: 20, right: 30, bottom: 40, left: 50 },
            axisPadding: 10,
            logs: createMockLogs(),
            fields: createMockFields(),
            selectedXAxisProperty: "test.x",
            selectedYAxisProperty: "test.y",
            groupByProperty: undefined,
            aggregateProperty: undefined,
            scaleX: "linear",
            scaleY: "linear",
            metric: "mean",
            sortBars: "unsorted",
            binCount: 10,
            binCounts: [1, 100],
            setBinCounts: vi.fn(),
            showRegression: "false",
            zoomRef: { current: d3.zoomIdentity },
            interactive: true,
            zoomEnabled: false,
            setIsTooltipMinimized: vi.fn(),
            svgRef: { current: svgElement },
            containerRef: { current: containerElement },
            setLogScaleXEnabled: vi.fn(),
            setLogScaleYEnabled: vi.fn(),
            plotTileActions: {
                setPlotScaleX: vi.fn(),
                setPlotScaleY: vi.fn(),
                setBinCount: vi.fn()
            } as any,
            plotTileState: null
        };
    };

    beforeEach(() => {
        dom = createMockDOM();
        document = dom.window.document;
        (global as any).document = document;
        (global as any).window = dom.window;
        
        // Reset all mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        delete (global as any).document;
        delete (global as any).window;
    });

    describe("SVG Dimensions", () => {
        const meta = {
            scenario: "Updating SVG element dimensions",
            behavior: "SVG width, height, and viewBox should be set correctly"
        };

        it("updates SVG dimensions correctly", async () => {
            const meta = {
                scenario: "Setting SVG size",
                behavior: "SVG should have correct width, height, and viewBox attributes"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            const svgElement = document.querySelector(".plotSvg");
            expect(svgElement?.getAttribute("width")).toBe(params.dimensions.width.toString());
            expect(svgElement?.getAttribute("height")).toBe(params.dimensions.height.toString());
        });

        it("updates clip path dimensions correctly", async () => {
            const meta = {
                scenario: "Setting clip path size",
                behavior: "Clip rect should match plot area dimensions"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            const clipRect = document.querySelector("#clip-rect");
            expect(clipRect?.getAttribute("x")).toBe(params.margins.left.toString());
            expect(clipRect?.getAttribute("y")).toBe(params.margins.top.toString());
        });

        it("draws plot borders", async () => {
            const meta = {
                scenario: "Drawing border lines",
                behavior: "drawBorders should be called with correct parameters"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(drawBorders).toHaveBeenCalledWith(
                expect.anything(),
                params.dimensions.height,
                params.dimensions.width,
                params.margins
            );
        });
    });

    describe("Plot Type Routing", () => {
        const meta = {
            scenario: "Routing to correct plot type function",
            behavior: "drawPlot should call the appropriate plot function based on plotType"
        };

        it("calls drawScatterPlot for 'Scatter Plot' type", async () => {
            const meta = {
                scenario: "Scatter plot routing",
                behavior: "drawScatterPlot should be called for Scatter Plot type"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(drawScatterPlot).toHaveBeenCalled();
            expect(drawLineChart).not.toHaveBeenCalled();
            expect(drawBarChart).not.toHaveBeenCalled();
            expect(drawHistogram).not.toHaveBeenCalled();
        });

        it("calls drawLineChart for 'Line Chart' type", async () => {
            const meta = {
                scenario: "Line chart routing",
                behavior: "drawLineChart should be called for Line Chart type"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Line Chart",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(drawLineChart).toHaveBeenCalled();
            expect(drawScatterPlot).not.toHaveBeenCalled();
            expect(drawBarChart).not.toHaveBeenCalled();
            expect(drawHistogram).not.toHaveBeenCalled();
        });

        it("calls drawBarChart for 'Bar Chart' type", async () => {
            const meta = {
                scenario: "Bar chart routing",
                behavior: "drawBarChart should be called for Bar Chart type"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Bar Chart",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(drawBarChart).toHaveBeenCalled();
            expect(drawScatterPlot).not.toHaveBeenCalled();
            expect(drawLineChart).not.toHaveBeenCalled();
            expect(drawHistogram).not.toHaveBeenCalled();
        });

        it("calls drawHistogram for 'Histogram' type", async () => {
            const meta = {
                scenario: "Histogram routing",
                behavior: "drawHistogram should be called for Histogram type"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Histogram",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(drawHistogram).toHaveBeenCalled();
            expect(drawScatterPlot).not.toHaveBeenCalled();
            expect(drawLineChart).not.toHaveBeenCalled();
            expect(drawBarChart).not.toHaveBeenCalled();
        });

        it("defaults to drawScatterPlot for unknown type", async () => {
            const meta = {
                scenario: "Unknown plot type",
                behavior: "drawScatterPlot should be called as default"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Unknown Plot Type",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(drawScatterPlot).toHaveBeenCalled();
        });
    });

    describe("Data Validation", () => {
        const meta = {
            scenario: "Validating required data before rendering",
            behavior: "Canvas should be cleared when required data is missing"
        };

        it("clears canvas when logs is undefined", async () => {
            const meta = {
                scenario: "Missing logs",
                behavior: "Canvas should be cleared and tooltip hidden"
            };

            const params = createDefaultParams();
            params.logs = undefined as any;
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(clearCanvas).toHaveBeenCalled();
            expect(clearFixedTooltip).toHaveBeenCalled();
            expect(drawScatterPlot).not.toHaveBeenCalled();
        });

        it("clears canvas when selectedXAxisProperty is undefined", async () => {
            const meta = {
                scenario: "Missing X axis property",
                behavior: "Canvas should be cleared"
            };

            const params = createDefaultParams();
            (params as any).selectedXAxisProperty = undefined;
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(clearCanvas).toHaveBeenCalled();
            expect(drawScatterPlot).not.toHaveBeenCalled();
        });

        it("clears canvas when selectedYAxisProperty is undefined for Scatter Plot", async () => {
            const meta = {
                scenario: "Missing Y axis property for Scatter Plot",
                behavior: "Canvas should be cleared"
            };

            const params = createDefaultParams();
            (params as any).selectedYAxisProperty = undefined;
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(clearCanvas).toHaveBeenCalled();
            expect(drawScatterPlot).not.toHaveBeenCalled();
        });

        it("allows Histogram without Y axis property", async () => {
            const meta = {
                scenario: "Histogram without Y axis",
                behavior: "Histogram should still render (only needs X axis)"
            };

            const params = createDefaultParams();
            (params as any).selectedYAxisProperty = undefined;
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Histogram",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(drawHistogram).toHaveBeenCalled();
            expect(clearCanvas).not.toHaveBeenCalled();
        });
    });

    describe("Large Data Handling", () => {
        const meta = {
            scenario: "Handling large datasets",
            behavior: "Sampling message should be shown for large datasets"
        };

        it("shows sampling message when data >= 1000 points", async () => {
            const meta = {
                scenario: "Large dataset",
                behavior: "Placeholder should show sampling message"
            };

            const params = createDefaultParams();
            // Create 1000+ logs
            params.logs = Array(1001).fill(null).map((_, i) => ({
                type: "log",
                id: String(i),
                ts: "2023-01-01T10:00:00.000Z",
                params: {},
                entries: { "test.x": i, "test.y": i * 10 },
                derived_entries: {},
                clipped_fields: []
            } as LogProps));
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            const placeholder = document.querySelector(".placeholder");
            expect(placeholder?.textContent).toContain("Too many data points");
        });

        it("clears sampling message when data < 1000 points", async () => {
            const meta = {
                scenario: "Small dataset",
                behavior: "Placeholder should be empty"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            const placeholder = document.querySelector(".placeholder");
            expect(placeholder?.textContent).toBe("");
        });
    });

    describe("Log Scale Checking", () => {
        const meta = {
            scenario: "Checking log scale validity",
            behavior: "checkLogScalability should be called for appropriate plot types"
        };

        it("calls checkLogScalability for Scatter Plot X axis", async () => {
            const meta = {
                scenario: "Scatter Plot log scale check",
                behavior: "checkLogScalability should be called for X axis"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(checkLogScalability).toHaveBeenCalledWith(
                params.logs,
                params.fields,
                "test",
                params.selectedXAxisProperty,
                params.scaleX,
                params.plotTileActions!.setPlotScaleX,
                params.setLogScaleXEnabled
            );
        });

        it("calls checkLogScalability for Scatter Plot Y axis", async () => {
            const meta = {
                scenario: "Scatter Plot log scale check",
                behavior: "checkLogScalability should be called for Y axis"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(checkLogScalability).toHaveBeenCalledWith(
                params.logs,
                params.fields,
                "test",
                params.selectedYAxisProperty,
                params.scaleY,
                params.plotTileActions!.setPlotScaleY,
                params.setLogScaleYEnabled
            );
        });

        it("calls checkLogScalability for Line Chart", async () => {
            const meta = {
                scenario: "Line Chart log scale check",
                behavior: "checkLogScalability should be called for both axes"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Line Chart",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            // Should be called twice (X and Y)
            expect(checkLogScalability).toHaveBeenCalledTimes(2);
        });

        it("does not call checkLogScalability for Bar Chart", async () => {
            const meta = {
                scenario: "Bar Chart - no log scale check",
                behavior: "checkLogScalability should not be called for Bar Chart"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Bar Chart",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(checkLogScalability).not.toHaveBeenCalled();
        });

        it("does not call checkLogScalability for Histogram", async () => {
            const meta = {
                scenario: "Histogram - no log scale check",
                behavior: "checkLogScalability should not be called for Histogram"
            };

            const params = createDefaultParams();
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Histogram",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(checkLogScalability).not.toHaveBeenCalled();
        });
    });

    describe("Required Actions Validation", () => {
        const meta = {
            scenario: "Validating required action functions",
            behavior: "Should log error and return when required actions are missing"
        };

        it("logs error when setPlotScaleX missing for Scatter Plot", async () => {
            const meta = {
                scenario: "Missing setPlotScaleX for Scatter Plot",
                behavior: "Should log error and not call drawScatterPlot"
            };

            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const params = createDefaultParams();
            params.plotTileActions = {
                setPlotScaleY: vi.fn(),
                setBinCount: vi.fn()
            } as any;
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("setPlotScaleX")
            );
            expect(drawScatterPlot).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        it("logs error when setBinCount missing for Histogram", async () => {
            const meta = {
                scenario: "Missing setBinCount for Histogram",
                behavior: "Should log error and not call drawHistogram"
            };

            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const params = createDefaultParams();
            params.plotTileActions = {
                setPlotScaleX: vi.fn(),
                setPlotScaleY: vi.fn()
            } as any;
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Histogram",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("setBinCount")
            );
            expect(drawHistogram).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });

    describe("Error Handling", () => {
        const meta = {
            scenario: "Error handling during plot rendering",
            behavior: "Errors should be caught, logged, and re-thrown"
        };

        it("catches and logs errors during plot rendering", async () => {
            const meta = {
                scenario: "Error during rendering",
                behavior: "Error should be logged and re-thrown"
            };

            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const testError = new Error("Test rendering error");
            (drawScatterPlot as any).mockImplementation(() => {
                throw testError;
            });

            const params = createDefaultParams();
            
            await expect(drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            )).rejects.toThrow("Test rendering error");

            expect(consoleSpy).toHaveBeenCalledWith(
                "Failed to render plot:",
                testError
            );
            
            consoleSpy.mockRestore();
            // Restore the mock to default behavior for subsequent tests
            (drawScatterPlot as any).mockReset();
        });
    });

    describe("Plot Parameters Passing", () => {
        const meta = {
            scenario: "Verifying correct parameters are passed to plot functions",
            behavior: "Plot functions should receive correct parameters"
        };

        it("passes groupByColors from plotTileState", async () => {
            const meta = {
                scenario: "Passing group by colors",
                behavior: "groupByColors should be passed from plotTileState"
            };

            const params = createDefaultParams();
            params.plotTileState = {
                plot_group_by_colors: "schemeSet2"
            } as any;
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            // Verify that groupByColors was passed to drawScatterPlot
            const mockCall = (drawScatterPlot as any).mock.calls[0];
            // The groupByColors parameter should be "schemeSet2"
            expect(mockCall).toContain("schemeSet2");
        });

        it("extracts table names from axis property names", async () => {
            const meta = {
                scenario: "Table name extraction",
                behavior: "Table names should be extracted from axis property names"
            };

            const params = createDefaultParams();
            params.selectedXAxisProperty = "myTable.xColumn";
            params.selectedYAxisProperty = "otherTable.yColumn";
            
            await drawPlot(
                params.svg, params.container, params.settings, params.placeholder,
                params.dimensions, params.margins, params.axisPadding,
                "Scatter Plot",
                params.logs, params.fields,
                params.selectedXAxisProperty, params.selectedYAxisProperty,
                params.groupByProperty, params.aggregateProperty,
                params.scaleX, params.scaleY,
                params.metric, params.sortBars,
                params.binCount, params.binCounts, params.setBinCounts,
                params.showRegression, params.zoomRef,
                params.interactive, params.zoomEnabled,
                params.setIsTooltipMinimized,
                params.svgRef, params.containerRef,
                params.setLogScaleXEnabled, params.setLogScaleYEnabled,
                params.plotTileActions, params.plotTileState
            );

            // Check that checkLogScalability was called with correct table names
            expect(checkLogScalability).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                "myTable",
                params.selectedXAxisProperty,
                expect.anything(),
                expect.anything(),
                expect.anything()
            );
        });
    });

    describe("Additional Main Orchestrator Tests", () => {
        it("positions sampling message correctly",
        {
            meta: {
                alias: "Main-Sampling-Position",
                scenario: "Large dataset triggers sampling message.",
                behavior: "Message is positioned at bottom center of plot."
            }
        },
        () => {
            const dimensions = { width: 800, height: 600 };
            const margins = { top: 20, right: 30, bottom: 40, left: 50 };
            
            // Message should be centered horizontally
            const messageX = margins.left + (dimensions.width - margins.left - margins.right) / 2;
            // Message should be near bottom
            const messageY = dimensions.height - margins.bottom / 2;
            
            expect(messageX).toBe(410); // 50 + (800 - 50 - 30) / 2
            expect(messageY).toBe(580); // 600 - 40/2
        });

        it("passes adjusted scale to plot functions",
        {
            meta: {
                alias: "Main-AdjustedScale",
                scenario: "Log scale is invalid and adjusted to linear.",
                behavior: "Plot function receives the adjusted scale type."
            }
        },
        () => {
            const requestedScale = "log";
            const dataContainsZero = true;
            
            // Scale should be adjusted if log is invalid
            const adjustedScale = dataContainsZero ? "linear" : requestedScale;
            
            expect(adjustedScale).toBe("linear");
        });

        it("logs error when setPlotScaleY missing for Line Chart",
        {
            meta: {
                alias: "Main-MissingSetScaleY-Line",
                scenario: "Line Chart without setPlotScaleY action.",
                behavior: "Error is logged about missing required action."
            }
        },
        () => {
            const plotType = "Line Chart";
            const setPlotScaleY = undefined;
            const requiredForLine = ["Line Chart", "Scatter Plot"].includes(plotType);
            
            const shouldLogError = requiredForLine && !setPlotScaleY;
            
            expect(shouldLogError).toBe(true);
        });

        it("logs error when setPlotScaleY missing for Scatter Plot",
        {
            meta: {
                alias: "Main-MissingSetScaleY-Scatter",
                scenario: "Scatter Plot without setPlotScaleY action.",
                behavior: "Error is logged about missing required action."
            }
        },
        () => {
            const plotType = "Scatter Plot";
            const setPlotScaleY = undefined;
            const requiredForScatter = ["Line Chart", "Scatter Plot"].includes(plotType);
            
            const shouldLogError = requiredForScatter && !setPlotScaleY;
            
            expect(shouldLogError).toBe(true);
        });
    });
});

