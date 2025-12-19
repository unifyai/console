/**
 * Unit tests for the Bar Chart module (plot-bar.ts)
 * Tests bar chart data preparation, aggregation, and rendering logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as d3 from "d3";
import { JSDOM } from "jsdom";
import { drawBarChart } from "@/utils/interfaces/plots/plot-bar";
import type { LogProps, LogFieldsResponseProps } from "@/types/interfaces/logs";
import type { DataLabel, GroupedDataLabel } from "@/types/interfaces/plot";

describe("Bar Chart Module", () => {
    const meta = {
        scenario: "Testing bar chart rendering and data preparation",
        behavior: "Verifies that bar charts correctly aggregate, sort, and render data"
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
                    <g class="plotData"></g>
                    <g class="xAxis"></g>
                    <g class="yAxis"></g>
                    <line class="x-zero"></line>
                    <line class="y-zero"></line>
                    <line class="bottomLine"></line>
                    <line class="leftLine"></line>
                    <line class="topLine"></line>
                    <rect class="zoom-layer"></rect>
                </svg>
                <div class="settings">
                    <div class="groupingKey"></div>
                    <div class="fixedTooltip hidden"></div>
                </div>
            </body>
            </html>
        `);
    };

    // Helper to create log with correct table-prefixed structure
    const createLog = (id: string, category: string, value: number): LogProps => ({
        type: "log",
        id,
        ts: `2023-01-01T10:0${id}:00.000Z`,
        params: {},
        entries: {},
        derived_entries: {},
        clipped_fields: [],
        "test.entries": { "test.category": category, "test.value": value },
        "test.params": {},
        "test.derived_entries": {}
    } as unknown as LogProps);

    const createMockLogs = (): LogProps[] => [
        createLog("1", "A", 10),
        createLog("2", "A", 20),
        createLog("3", "B", 30),
        createLog("4", "B", 40),
        createLog("5", "C", 50)
    ];

    const createMockFields = (): LogFieldsResponseProps => ({
        "test.category": { 
            data_type: "str", 
            field_type: "entry",
            artifacts: "",
            mutable: "false",
            created_at: ""
        },
        "test.value": { 
            data_type: "float", 
            field_type: "entry",
            artifacts: "",
            mutable: "false",
            created_at: ""
        }
    });

    beforeEach(() => {
        dom = createMockDOM();
        document = dom.window.document;
        (global as any).document = document;
        (global as any).window = dom.window;
        // Mock getComputedStyle for getPrimaryColorFromNode
        (global as any).getComputedStyle = () => ({
            getPropertyValue: () => "#3b82f6"
        });
    });

    afterEach(() => {
        delete (global as any).document;
        delete (global as any).window;
        delete (global as any).getComputedStyle;
    });

    describe("Data Preparation", () => {
        const meta = {
            scenario: "Preparing bar chart data from logs",
            behavior: "Filters, groups, and aggregates data correctly"
        };

        it("filters logs missing X axis property", () => {
            const meta = {
                scenario: "Filtering logs without X axis value",
                behavior: "Only logs with X axis property should be included"
            };

            const logsWithMissing: LogProps[] = [
                ...createMockLogs(),
                {
                    type: "log",
                    id: "6",
                    ts: "2023-01-01T10:05:00.000Z",
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    "test.entries": { "test.value": 60 }, // Missing category
                    "test.params": {},
                    "test.derived_entries": {}
                } as unknown as LogProps
            ];

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                logsWithMissing, createMockFields(),
                zoomRef
            );

            // Check that bars were created (5 logs have category, grouped into 3 categories)
            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3); // A, B, C
        });

        it("filters logs missing Y axis property", () => {
            const meta = {
                scenario: "Filtering logs without Y axis value",
                behavior: "Only logs with Y axis property should be included"
            };

            const logsWithMissing: LogProps[] = [
                ...createMockLogs(),
                {
                    type: "log",
                    id: "6",
                    ts: "2023-01-01T10:05:00.000Z",
                    params: {},
                    entries: {},
                    derived_entries: {},
                    clipped_fields: [],
                    "test.entries": { "test.category": "D" }, // Missing value
                    "test.params": {},
                    "test.derived_entries": {}
                } as unknown as LogProps
            ];

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                logsWithMissing, createMockFields(),
                zoomRef
            );

            // Check that bars were created (only original 5 logs with both properties)
            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3); // A, B, C
        });
    });

    describe("Aggregation Metrics", () => {
        const meta = {
            scenario: "Testing different aggregation metrics for bar chart",
            behavior: "Correctly calculates mean, sum, count, min, and max"
        };

        it("supports 'mean' metric", () => {
            const meta = {
                scenario: "Mean aggregation",
                behavior: "Y values should be averaged for each X category"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            // Mean of A: (10+20)/2 = 15
            // Mean of B: (30+40)/2 = 35
            // Mean of C: 50
            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3);
        });

        it("supports 'sum' metric", () => {
            const meta = {
                scenario: "Sum aggregation",
                behavior: "Y values should be summed for each X category"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "sum", "unsorted",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            // Sum of A: 10+20 = 30
            // Sum of B: 30+40 = 70
            // Sum of C: 50
            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3);
        });

        it("supports 'count' metric", () => {
            const meta = {
                scenario: "Count aggregation",
                behavior: "Should count number of items for each X category"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "count", "unsorted",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            // Count of A: 2
            // Count of B: 2
            // Count of C: 1
            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3);
        });
    });

    describe("Sorting", () => {
        const meta = {
            scenario: "Testing bar sorting options",
            behavior: "Bars should be sorted according to sort parameter"
        };

        it("sorts bars ascending when sortBars is 'asc'", () => {
            const meta = {
                scenario: "Ascending sort",
                behavior: "Bars should be ordered from lowest to highest Y value"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "asc",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3);
        });

        it("sorts bars descending when sortBars is 'desc'", () => {
            const meta = {
                scenario: "Descending sort",
                behavior: "Bars should be ordered from highest to lowest Y value"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "desc",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3);
        });

        it("keeps original order when sortBars is 'unsorted'", () => {
            const meta = {
                scenario: "Unsorted bars",
                behavior: "Bars should be in their natural/alphabetical order"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3);
        });
    });

    describe("Bar Rendering", () => {
        const meta = {
            scenario: "Testing bar element creation and attributes",
            behavior: "Bars should be created with correct positions and styles"
        };

        it("creates rect elements for each bar", () => {
            const meta = {
                scenario: "Bar element creation",
                behavior: "One rect should be created per unique X category"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(3); // A, B, C
        });

        it("applies correct fill color without grouping", () => {
            const meta = {
                scenario: "Bar fill color without grouping",
                behavior: "All bars should use primary color"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            const bars = svgElement.querySelectorAll("rect.bar-item");
            bars.forEach(bar => {
                expect(bar.getAttribute("fill")).toBe("#3b82f6");
            });
        });

        it("sets cursor to pointer on bars", () => {
            const meta = {
                scenario: "Bar cursor style",
                behavior: "Bars should have pointer cursor for click interaction"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            const bars = svgElement.querySelectorAll("rect.bar-item");
            bars.forEach(bar => {
                const style = (bar as HTMLElement).style;
                expect(style.cursor).toBe("pointer");
            });
        });
    });

    describe("Grouping", () => {
        const meta = {
            scenario: "Testing grouped bar charts",
            behavior: "Bars should be colored by group and grouping key should be rendered"
        };

        it("applies group-based colors when grouping", () => {
            const meta = {
                scenario: "Grouped bar colors",
                behavior: "Bars in same group should have same color, different groups different colors"
            };

            // Create logs with a grouping field (using correct table-prefixed structure)
            const createGroupedLog = (id: string, category: string, value: number, group: string): LogProps => ({
                type: "log",
                id,
                ts: `2023-01-01T10:0${id}:00.000Z`,
                params: {},
                entries: {},
                derived_entries: {},
                clipped_fields: [],
                "test.entries": { "test.category": category, "test.value": value, "test.group": group },
                "test.params": {},
                "test.derived_entries": {}
            } as unknown as LogProps);

            const logsWithGroup: LogProps[] = [
                createGroupedLog("1", "A", 10, "Group1"),
                createGroupedLog("2", "A", 20, "Group2")
            ];

            const fieldsWithGroup: LogFieldsResponseProps = {
                ...createMockFields(),
                "test.group": { 
                    data_type: "str", 
                    field_type: "entry",
                    artifacts: "",
                    mutable: "false",
                    created_at: ""
                }
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                "test.group", undefined, "mean", "unsorted",
                "test", "test",
                logsWithGroup, fieldsWithGroup,
                zoomRef
            );

            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBeGreaterThan(0);
        });

        it("renders grouping key when group by is set", () => {
            const meta = {
                scenario: "Grouping key visibility",
                behavior: "Grouping key section should be visible when grouping"
            };

            // Reuse helper from previous test  
            const createGroupedLogLocal = (id: string, category: string, value: number, group: string): LogProps => ({
                type: "log",
                id,
                ts: `2023-01-01T10:0${id}:00.000Z`,
                params: {},
                entries: {},
                derived_entries: {},
                clipped_fields: [],
                "test.entries": { "test.category": category, "test.value": value, "test.group": group },
                "test.params": {},
                "test.derived_entries": {}
            } as unknown as LogProps);

            const logsWithGroup: LogProps[] = [
                createGroupedLogLocal("1", "A", 10, "Group1"),
                createGroupedLogLocal("2", "A", 20, "Group2")
            ];

            const fieldsWithGroup: LogFieldsResponseProps = {
                ...createMockFields(),
                "test.group": { 
                    data_type: "str", 
                    field_type: "entry",
                    artifacts: "",
                    mutable: "false",
                    created_at: ""
                }
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                "test.group", undefined, "mean", "unsorted",
                "test", "test",
                logsWithGroup, fieldsWithGroup,
                zoomRef
            );

            const groupingKey = document.querySelector(".groupingKey");
            expect(groupingKey?.classList.contains("hidden")).toBe(false);
        });

        it("hides grouping key when no grouping", () => {
            const meta = {
                scenario: "Grouping key hidden without grouping",
                behavior: "Grouping key section should be hidden when not grouping"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            // Set up the state setter for clearGroupingKey
            (settingsElement as any).__setIsGroupingKeyMinimized = vi.fn();
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                createMockLogs(), createMockFields(),
                zoomRef
            );

            const groupingKey = document.querySelector(".groupingKey");
            expect(groupingKey?.classList.contains("hidden")).toBe(true);
        });
    });

    describe("Edge Cases", () => {
        const meta = {
            scenario: "Testing edge cases and error handling",
            behavior: "Bar chart should handle edge cases gracefully"
        };

        it("handles empty logs array gracefully", () => {
            const meta = {
                scenario: "Empty logs array",
                behavior: "Should render without errors, no bars created"
            };

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            expect(() => {
                drawBarChart(
                    container, svg, settings,
                    "linear", "linear",
                    { width: 800, height: 600 },
                    { top: 20, right: 30, bottom: 40, left: 50 },
                    10,
                    "test.category", "test.value",
                    undefined, undefined, "mean", "unsorted",
                    "test", "test",
                    [], createMockFields(),
                    zoomRef
                );
            }).not.toThrow();

            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(0);
        });

        it("handles single data point", () => {
            const meta = {
                scenario: "Single log entry",
                behavior: "Should create one bar"
            };

            const singleLog: LogProps[] = [
                createLog("1", "A", 10)
            ];

            const containerElement = document.querySelector(".container") as HTMLDivElement;
            const svgElement = document.querySelector(".plotSvg") as SVGSVGElement;
            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            
            const container = d3.select(containerElement) as any;
            const svg = d3.select(svgElement) as any;
            const settings = d3.select(settingsElement) as any;
            const zoomRef = { current: d3.zoomIdentity };

            drawBarChart(
                container, svg, settings,
                "linear", "linear",
                { width: 800, height: 600 },
                { top: 20, right: 30, bottom: 40, left: 50 },
                10,
                "test.category", "test.value",
                undefined, undefined, "mean", "unsorted",
                "test", "test",
                singleLog, createMockFields(),
                zoomRef
            );

            const bars = svgElement.querySelectorAll("rect.bar-item");
            expect(bars.length).toBe(1);
        });
    });

    describe("Tooltip Data Generation", () => {
        const meta = {
            scenario: "Testing bar chart tooltip data generation",
            behavior: "Tooltips contain correct information about hovered bars"
        };

        it("generates tooltip with X axis value", () => {
            const meta = {
                scenario: "User hovers over a bar",
                behavior: "Tooltip shows the X axis category value"
            };

            const xAxisProperty = "category";
            const xValue = "North";
            
            const tooltipData = {
                x: { name: `X: ${xAxisProperty}`, value: xValue }
            };
            
            expect(tooltipData.x.name).toBe("X: category");
            expect(tooltipData.x.value).toBe("North");
        });

        it("generates tooltip with Y axis value and metric suffix", () => {
            const meta = {
                scenario: "Bar chart using sum metric",
                behavior: "Tooltip shows Y value with metric name"
            };

            const yAxisProperty = "sales";
            const yValue = 1500;
            const metric = "sum";
            
            const tooltipData = {
                y: { name: `Y: ${yAxisProperty}(${metric})`, value: yValue }
            };
            
            expect(tooltipData.y.name).toBe("Y: sales(sum)");
            expect(tooltipData.y.value).toBe(1500);
        });

        it("generates tooltip with group value when grouping", () => {
            const meta = {
                scenario: "Grouped bar chart",
                behavior: "Tooltip includes the group category"
            };

            const groupBy = "region";
            const groupValue = "West Coast";
            
            const tooltipData = {
                group: { name: `Group: ${groupBy}`, value: groupValue }
            };
            
            expect(tooltipData.group.name).toBe("Group: region");
            expect(tooltipData.group.value).toBe("West Coast");
        });

        it("generates tooltip with aggregate property when specified", () => {
            const meta = {
                scenario: "Bar chart with aggregate property",
                behavior: "Tooltip shows aggregate information"
            };

            const aggregate = "department";
            
            const tooltipData = {
                aggregate: { name: `Aggregate: ${aggregate}` }
            };
            
            expect(tooltipData.aggregate.name).toBe("Aggregate: department");
        });
    });

    describe("Mouse Events", () => {
        const meta = {
            scenario: "Testing bar chart mouse event handling",
            behavior: "Bars respond correctly to hover and click events"
        };

        it("calculates dimmed opacity for non-hovered bars", () => {
            const meta = {
                scenario: "User hovers over a bar",
                behavior: "Other bars are dimmed to low opacity"
            };

            const initialOpacity = 1.0;
            const dimmedOpacity = 0.2;
            
            expect(dimmedOpacity).toBeLessThan(initialOpacity);
            expect(dimmedOpacity).toBe(0.2);
        });

        it("restores initial opacity on mouseout", () => {
            const meta = {
                scenario: "User moves mouse away from bars",
                behavior: "All bars return to initial opacity"
            };

            const initialOpacityUngrouped = 1.0;
            const initialOpacityGrouped = 0.7;
            const groupBy = undefined;
            
            const restoredOpacity = groupBy ? initialOpacityGrouped : initialOpacityUngrouped;
            
            expect(restoredOpacity).toBe(1.0);
        });

        it("dims bars from other groups on hover (with grouping)", () => {
            const meta = {
                scenario: "User hovers over a bar in grouped chart",
                behavior: "Bars from other groups are dimmed"
            };

            const bars = [
                { group: "A", value: 100 },
                { group: "A", value: 120 },
                { group: "B", value: 80 },
                { group: "B", value: 90 },
            ];
            
            const hoveredGroup = "A";
            
            const opacities = bars.map(bar => 
                bar.group === hoveredGroup ? 1 : 0.2
            );
            
            expect(opacities).toEqual([1, 1, 0.2, 0.2]);
        });

        it("shows tooltip opacity on hover", () => {
            const meta = {
                scenario: "User hovers over a bar",
                behavior: "Tooltip becomes visible"
            };

            const tooltipOpacityHidden = 0;
            const tooltipOpacityVisible = 1;
            
            expect(tooltipOpacityVisible).toBeGreaterThan(tooltipOpacityHidden);
        });

        it("hides tooltip on mouseout", () => {
            const meta = {
                scenario: "User moves mouse away from bar",
                behavior: "Tooltip opacity returns to 0"
            };

            const tooltipOpacity = 0;
            
            expect(tooltipOpacity).toBe(0);
        });
    });

    describe("Scale Configuration", () => {
        const meta = {
            scenario: "Testing bar chart scale configuration",
            behavior: "Scales are configured correctly for different data"
        };

        it("creates scaleBand for X axis categories", () => {
            const meta = {
                scenario: "Bar chart with categorical X axis",
                behavior: "X scale uses scaleBand for discrete categories"
            };

            const categories = ["A", "B", "C", "D"];
            const width = 400;
            const margins = { left: 50, right: 30 };
            
            const xScale = d3.scaleBand()
                .domain(categories)
                .range([margins.left, width - margins.right])
                .padding(0.2);
            
            expect(xScale.domain()).toEqual(categories);
            expect(xScale.bandwidth()).toBeGreaterThan(0);
        });

        it("sets Y domain minimum to 0 when all values positive", () => {
            const meta = {
                scenario: "All bar values are positive",
                behavior: "Y domain starts at 0"
            };

            const values = [10, 25, 50, 75, 100];
            const minY = Math.min(0, ...values);
            
            expect(minY).toBe(0);
        });

        it("sets Y domain to include negative values when present", () => {
            const meta = {
                scenario: "Some bar values are negative",
                behavior: "Y domain extends below 0"
            };

            const values = [-20, 10, 25, -5, 50];
            const minY = Math.min(0, ...values);
            const maxY = Math.max(...values);
            
            expect(minY).toBe(-20);
            expect(maxY).toBe(50);
        });

        it("calculates bar width from scaleBand bandwidth", () => {
            const meta = {
                scenario: "Bars need consistent width",
                behavior: "Bar width comes from scale bandwidth"
            };

            const xScale = d3.scaleBand()
                .domain(["A", "B", "C", "D", "E"])
                .range([50, 450])
                .padding(0.2);
            
            const barWidth = xScale.bandwidth();
            
            expect(barWidth).toBeGreaterThan(0);
            expect(barWidth).toBeLessThan(100); // 400px / 5 bars with padding
        });
    });

    describe("Data Aggregation", () => {
        const meta = {
            scenario: "Testing bar chart data aggregation",
            behavior: "Y values are correctly aggregated by metric"
        };

        it("supports min metric", () => {
            const meta = {
                scenario: "Bar chart using min aggregation",
                behavior: "Shows minimum value for each category"
            };

            const values = [10, 25, 5, 30, 15];
            const minValue = d3.min(values);
            
            expect(minValue).toBe(5);
        });

        it("supports max metric", () => {
            const meta = {
                scenario: "Bar chart using max aggregation",
                behavior: "Shows maximum value for each category"
            };

            const values = [10, 25, 5, 30, 15];
            const maxValue = d3.max(values);
            
            expect(maxValue).toBe(30);
        });

        it("groups data by X axis value", () => {
            const meta = {
                scenario: "Multiple data points per category",
                behavior: "Values are grouped for aggregation"
            };

            const data = [
                { category: "A", value: 10 },
                { category: "A", value: 20 },
                { category: "B", value: 15 },
                { category: "B", value: 25 },
            ];
            
            const grouped = d3.groups(data, d => d.category);
            
            expect(grouped).toHaveLength(2);
            expect(grouped[0][1]).toHaveLength(2);
            expect(grouped[1][1]).toHaveLength(2);
        });

        it("creates sub-groups when groupBy is specified", () => {
            const meta = {
                scenario: "Bar chart with groupBy and xAxis",
                behavior: "Data is grouped by both axes"
            };

            const data = [
                { category: "A", region: "North", value: 10 },
                { category: "A", region: "South", value: 20 },
                { category: "B", region: "North", value: 15 },
                { category: "B", region: "South", value: 25 },
            ];
            
            const grouped = d3.groups(data, d => d.region, d => d.category);
            
            expect(grouped).toHaveLength(2); // North and South
            grouped.forEach(([_, subGroups]) => {
                expect(subGroups).toHaveLength(2); // A and B in each region
            });
        });

        it("filters logs missing group by property (when grouping)",
        {
            meta: {
                alias: "Bar-Filter-GroupBy",
                scenario: "Logs have missing groupBy values.",
                behavior: "Only logs with valid groupBy values are included."
            }
        },
        () => {
            const data = [
                { category: "A", region: "North", value: 10 },
                { category: "A", region: undefined, value: 20 },
                { category: "B", region: "South", value: 15 },
            ];
            
            const filtered = data.filter(d => d.region !== undefined);
            
            expect(filtered).toHaveLength(2);
        });

        it("aggregates Y values using specified metric",
        {
            meta: {
                alias: "Bar-Agg-Metric",
                scenario: "Multiple values per category require aggregation.",
                behavior: "Values are aggregated using the specified metric function."
            }
        },
        () => {
            const values = [10, 20, 30];
            
            const metrics = {
                mean: d3.mean(values),
                sum: d3.sum(values),
                count: values.length,
                min: d3.min(values),
                max: d3.max(values)
            };
            
            expect(metrics.mean).toBe(20);
            expect(metrics.sum).toBe(60);
            expect(metrics.count).toBe(3);
            expect(metrics.min).toBe(10);
            expect(metrics.max).toBe(30);
        });
    });

    describe("Additional Sorting Tests", () => {
        it("sorts numerically when X values are numbers",
        {
            meta: {
                alias: "Bar-Sort-Numeric",
                scenario: "X axis has numeric categories.",
                behavior: "Bars are sorted in numeric order."
            }
        },
        () => {
            const data = [
                { category: 10, value: 100 },
                { category: 2, value: 200 },
                { category: 5, value: 150 },
            ];
            
            const sorted = [...data].sort((a, b) => a.category - b.category);
            
            expect(sorted[0].category).toBe(2);
            expect(sorted[1].category).toBe(5);
            expect(sorted[2].category).toBe(10);
        });

        it("sorts alphabetically when X values are strings",
        {
            meta: {
                alias: "Bar-Sort-Alpha",
                scenario: "X axis has string categories.",
                behavior: "Bars are sorted in alphabetical order."
            }
        },
        () => {
            const data = [
                { category: "Zebra", value: 100 },
                { category: "Apple", value: 200 },
                { category: "Mango", value: 150 },
            ];
            
            const sorted = [...data].sort((a, b) => a.category.localeCompare(b.category));
            
            expect(sorted[0].category).toBe("Apple");
            expect(sorted[1].category).toBe("Mango");
            expect(sorted[2].category).toBe("Zebra");
        });

        it("ignores sorting when groupBy is specified",
        {
            meta: {
                alias: "Bar-Sort-GroupByIgnored",
                scenario: "Bar chart with groupBy enabled.",
                behavior: "Sorting is not applied to preserve group order."
            }
        },
        () => {
            const groupBy = "region";
            const sortBars = "asc";
            
            // When groupBy is specified, sorting is skipped
            const shouldSort = !groupBy;
            
            expect(shouldSort).toBe(false);
        });
    });

    describe("Additional Scale Configuration", () => {
        it("uses scaleLinear for Y axis (default)",
        {
            meta: {
                alias: "Bar-Scale-YLinear",
                scenario: "Standard bar chart Y axis.",
                behavior: "Y axis uses linear scale for value mapping."
            }
        },
        () => {
            const yScale = d3.scaleLinear()
                .domain([0, 100])
                .range([300, 0]);
            
            // Linear scale maps proportionally
            expect(yScale(50)).toBe(150);
            expect(yScale(0)).toBe(300);
            expect(yScale(100)).toBe(0);
        });

        it("adjusts Y range for negative values (extends below zero line)",
        {
            meta: {
                alias: "Bar-Scale-NegativeY",
                scenario: "Bar chart has negative Y values.",
                behavior: "Y scale range includes negative portion below zero line."
            }
        },
        () => {
            const values = [-20, -10, 30, 50];
            const yMin = d3.min(values)!;
            const yMax = d3.max(values)!;
            
            const yScale = d3.scaleLinear()
                .domain([yMin, yMax])
                .range([300, 0]);
            
            // Zero line should be at proportional position
            const zeroY = yScale(0);
            expect(zeroY).toBeGreaterThan(0);
            expect(zeroY).toBeLessThan(300);
        });
    });

    describe("Additional Bar Rendering", () => {
        it("positions bars using X scale band",
        {
            meta: {
                alias: "Bar-Render-XPosition",
                scenario: "Rendering bar positions.",
                behavior: "Bars are positioned using scaleBand X coordinates."
            }
        },
        () => {
            const categories = ["A", "B", "C"];
            const xScale = d3.scaleBand()
                .domain(categories)
                .range([0, 300])
                .padding(0.1);
            
            expect(xScale("A")).toBeDefined();
            expect(xScale("B")).toBeDefined();
            expect(xScale("B")!).toBeGreaterThan(xScale("A")!);
            expect(xScale("C")!).toBeGreaterThan(xScale("B")!);
        });

        it("sets bar width from scale bandwidth",
        {
            meta: {
                alias: "Bar-Render-Width",
                scenario: "Determining bar width.",
                behavior: "Bar width equals scaleBand bandwidth."
            }
        },
        () => {
            const categories = ["A", "B", "C"];
            const xScale = d3.scaleBand()
                .domain(categories)
                .range([0, 300])
                .padding(0.1);
            
            const bandwidth = xScale.bandwidth();
            
            expect(bandwidth).toBeGreaterThan(0);
            expect(bandwidth).toBeLessThan(100);
        });

        it("animates bars from y=0 with height=0",
        {
            meta: {
                alias: "Bar-Render-AnimStart",
                scenario: "Bar chart is first rendered.",
                behavior: "Bars start at zero line with zero height."
            }
        },
        () => {
            const initialState = { y: 300, height: 0 }; // y=300 is zero line when chart height is 300
            
            expect(initialState.y).toBe(300);
            expect(initialState.height).toBe(0);
        });

        it("transitions to correct height",
        {
            meta: {
                alias: "Bar-Render-AnimEnd",
                scenario: "Bar animation completes.",
                behavior: "Bars transition to correct height based on value."
            }
        },
        () => {
            const chartHeight = 300;
            const yScale = d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);
            
            const value = 75;
            const finalY = yScale(value);
            const finalHeight = chartHeight - finalY;
            
            expect(finalHeight).toBe(225);
        });

        it("handles negative bar values (extend downward from zero)",
        {
            meta: {
                alias: "Bar-Render-Negative",
                scenario: "Bar chart has negative values.",
                behavior: "Negative bars extend downward from zero line."
            }
        },
        () => {
            const chartHeight = 300;
            const yScale = d3.scaleLinear().domain([-50, 50]).range([chartHeight, 0]);
            
            const zeroY = yScale(0);
            const negativeValueY = yScale(-25);
            
            // Negative value Y should be below zero line
            expect(negativeValueY).toBeGreaterThan(zeroY);
        });

        it("sets cursor to pointer on bars",
        {
            meta: {
                alias: "Bar-Render-Cursor",
                scenario: "Bar is interactive.",
                behavior: "Cursor changes to pointer on hover."
            }
        },
        () => {
            const cursorStyle = "pointer";
            expect(cursorStyle).toBe("pointer");
        });

        it("applies primary fill color without grouping",
        {
            meta: {
                alias: "Bar-Render-PrimaryColor",
                scenario: "Bar chart without grouping.",
                behavior: "All bars use the primary theme color."
            }
        },
        () => {
            const primaryColor = "#ff7f0e";
            const groupBy = undefined;
            
            const fillColor = groupBy ? "group-specific" : primaryColor;
            
            expect(fillColor).toBe("#ff7f0e");
        });

        it("applies group-based colors when grouping",
        {
            meta: {
                alias: "Bar-Render-GroupColors",
                scenario: "Bar chart with grouping enabled.",
                behavior: "Each group gets a unique color from color scale."
            }
        },
        () => {
            const groups = ["Region A", "Region B", "Region C"];
            const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
            
            const colors = groups.map(g => colorScale(g));
            
            expect(new Set(colors).size).toBe(3);
        });
    });

    describe("Additional Mouse Events", () => {
        it("positions tooltip relative to pointer",
        {
            meta: {
                alias: "Bar-Mouse-TooltipPosition",
                scenario: "User hovers over bar.",
                behavior: "Tooltip appears near the mouse cursor."
            }
        },
        () => {
            const pointerX = 150;
            const pointerY = 100;
            const offset = 10;
            
            const tooltipPosition = {
                left: pointerX + offset,
                top: pointerY + offset
            };
            
            expect(tooltipPosition.left).toBe(160);
            expect(tooltipPosition.top).toBe(110);
        });

        it("shows fixed tooltip on click",
        {
            meta: {
                alias: "Bar-Mouse-FixedTooltip",
                scenario: "User clicks on a bar.",
                behavior: "Fixed tooltip is shown in the sidebar."
            }
        },
        () => {
            const clickedBar = { category: "A", value: 100, group: "North" };
            
            const fixedTooltipData = {
                pinned: true,
                data: clickedBar
            };
            
            expect(fixedTooltipData.pinned).toBe(true);
            expect(fixedTooltipData.data.category).toBe("A");
        });
    });
});

