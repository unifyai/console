/**
 * Unit tests for the Grouping Key module (key.ts)
 * Tests the keyTemplate, renderGroupingKey, and clearGroupingKey functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as d3 from "d3";
import { JSDOM } from "jsdom";
import { keyTemplate, renderGroupingKey, clearGroupingKey } from "@/utils/interfaces/plots/key";
import type { GroupingColors } from "@/types/interfaces/plot";

describe("Grouping Key Module", () => {
    const meta = {
        scenario: "Testing grouping key rendering and management",
        behavior: "Verifies that grouping keys are correctly rendered, hidden, and managed with proper state"
    };

    let dom: JSDOM;
    let document: Document;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="settings">
                    <div class="groupingKey"></div>
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

    describe("keyTemplate", () => {
        const meta = {
            scenario: "Generating HTML for grouping key items",
            behavior: "Produces correct HTML structure with color dots and labels for each group"
        };

        it("generates HTML for each group with color dot", () => {
            const meta = {
                scenario: "Generating key items for multiple groups",
                behavior: "Each group should have a colored dot and label"
            };

            const keys: GroupingColors = [
                { key: "GroupA", color: "#ff0000" },
                { key: "GroupB", color: "#00ff00" },
                { key: "GroupC", color: "#0000ff" }
            ];

            const html = keyTemplate(keys);

            expect(html).toContain("GroupA");
            expect(html).toContain("GroupB");
            expect(html).toContain("GroupC");
            expect(html).toContain("#ff0000");
            expect(html).toContain("#00ff00");
            expect(html).toContain("#0000ff");
            expect(html).toContain('class="key');
            expect(html).toContain("rounded-full");
        });

        it("handles null group key values", () => {
            const meta = {
                scenario: "Grouping key with null value",
                behavior: "Should display 'null' as the key text"
            };

            const keys = [
                { key: null, color: "#ff0000" }
            ] as unknown as GroupingColors;

            const html = keyTemplate(keys);

            expect(html).toContain("null");
            expect(html).toContain("#ff0000");
        });

        it("strips surrounding quotes from key values", () => {
            const meta = {
                scenario: "Grouping key with quoted string values",
                behavior: "Should remove surrounding quotes from displayed key"
            };

            const keys: GroupingColors = [
                { key: '"quoted_value"', color: "#ff0000" }
            ];

            const html = keyTemplate(keys);

            expect(html).toContain("quoted_value");
            expect(html).not.toContain('&quot;quoted_value&quot;');
        });

        it("creates correct structure with truncate class for long values", () => {
            const meta = {
                scenario: "Grouping key with long key values",
                behavior: "Should include truncate class for proper text overflow handling"
            };

            const keys: GroupingColors = [
                { key: "a_very_long_group_name_that_should_be_truncated", color: "#ff0000" }
            ];

            const html = keyTemplate(keys);

            expect(html).toContain("truncate");
            expect(html).toContain("a_very_long_group_name_that_should_be_truncated");
        });

        it("generates empty string for empty keys array", () => {
            const meta = {
                scenario: "Empty grouping colors array",
                behavior: "Should return empty string when no groups"
            };

            const keys: GroupingColors = [];
            const html = keyTemplate(keys);

            expect(html).toBe("");
        });
    });

    describe("renderGroupingKey", () => {
        const meta = {
            scenario: "Rendering the complete grouping key section",
            behavior: "Displays header, buttons, and key items in the settings panel"
        };

        it("shows grouping key container when colors provided", () => {
            const meta = {
                scenario: "Rendering grouping key with valid colors",
                behavior: "Container should be visible and populated"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            const colors: GroupingColors = [
                { key: "Group1", color: "#ff0000" }
            ];

            renderGroupingKey(settings, colors);

            const container = document.querySelector(".groupingKey");
            expect(container).not.toBeNull();
            expect(container?.classList.contains("hidden")).toBe(false);
        });

        it("hides grouping key container when colors is null", () => {
            const meta = {
                scenario: "Rendering grouping key with null colors",
                behavior: "Container should be hidden"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            // First render with colors
            const colors: GroupingColors = [
                { key: "Group1", color: "#ff0000" }
            ];
            renderGroupingKey(settings, colors);

            // Now render with null
            const mockSetIsMinimized = vi.fn();
            (settingsElement as any).__setIsGroupingKeyMinimized = mockSetIsMinimized;
            
            renderGroupingKey(settings, null);

            const container = document.querySelector(".groupingKey");
            expect(container?.classList.contains("hidden")).toBe(true);
        });

        it("hides grouping key container when colors array is empty", () => {
            const meta = {
                scenario: "Rendering grouping key with empty colors array",
                behavior: "Container should be hidden"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            const mockSetIsMinimized = vi.fn();
            (settingsElement as any).__setIsGroupingKeyMinimized = mockSetIsMinimized;
            
            renderGroupingKey(settings, []);

            const container = document.querySelector(".groupingKey");
            expect(container?.classList.contains("hidden")).toBe(true);
        });

        it("renders header with 'Grouping Key' title", () => {
            const meta = {
                scenario: "Rendering grouping key header",
                behavior: "Should display 'Grouping Key' title"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            const colors: GroupingColors = [
                { key: "Group1", color: "#ff0000" }
            ];

            renderGroupingKey(settings, colors);

            const title = document.querySelector(".groupingKey span");
            expect(title?.textContent).toBe("Grouping Key");
        });

        it("renders minimize/expand button when setter is available", () => {
            const meta = {
                scenario: "Rendering grouping key with state setter",
                behavior: "Should render minimize/expand button"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            (settingsElement as any).__isGroupingKeyMinimized = false;
            (settingsElement as any).__setIsGroupingKeyMinimized = vi.fn();
            
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            const colors: GroupingColors = [
                { key: "Group1", color: "#ff0000" }
            ];

            renderGroupingKey(settings, colors);

            const button = document.querySelector(".groupingKey button");
            expect(button).not.toBeNull();
        });

        it("shows items when not minimized", () => {
            const meta = {
                scenario: "Grouping key in expanded state",
                behavior: "Key items should be visible"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            (settingsElement as any).__isGroupingKeyMinimized = false;
            (settingsElement as any).__setIsGroupingKeyMinimized = vi.fn();
            
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            const colors: GroupingColors = [
                { key: "Group1", color: "#ff0000" },
                { key: "Group2", color: "#00ff00" }
            ];

            renderGroupingKey(settings, colors);

            const items = document.querySelector(".grouping-key-items");
            expect(items).not.toBeNull();
            expect(items?.innerHTML).toContain("Group1");
            expect(items?.innerHTML).toContain("Group2");
        });

        it("hides items when minimized", () => {
            const meta = {
                scenario: "Grouping key in minimized state",
                behavior: "Key items should be hidden"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            (settingsElement as any).__isGroupingKeyMinimized = true;
            (settingsElement as any).__setIsGroupingKeyMinimized = vi.fn();
            
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            const colors: GroupingColors = [
                { key: "Group1", color: "#ff0000" }
            ];

            renderGroupingKey(settings, colors);

            const items = document.querySelector(".grouping-key-items");
            expect(items).toBeNull();
        });
    });

    describe("clearGroupingKey", () => {
        const meta = {
            scenario: "Clearing the grouping key section",
            behavior: "Clears content, hides container, and resets state"
        };

        it("clears key HTML content", () => {
            const meta = {
                scenario: "Clearing populated grouping key",
                behavior: "Container should be empty after clearing"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            // First populate it
            const colors: GroupingColors = [
                { key: "Group1", color: "#ff0000" }
            ];
            renderGroupingKey(settings, colors);

            // Now clear
            const mockSetIsMinimized = vi.fn();
            clearGroupingKey(settings, mockSetIsMinimized);

            const container = document.querySelector(".groupingKey");
            expect(container?.innerHTML).toBe("");
        });

        it("adds 'hidden' class to container", () => {
            const meta = {
                scenario: "Hiding container when clearing",
                behavior: "Container should have hidden class"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            // First populate it
            const colors: GroupingColors = [
                { key: "Group1", color: "#ff0000" }
            ];
            renderGroupingKey(settings, colors);

            // Now clear
            const mockSetIsMinimized = vi.fn();
            clearGroupingKey(settings, mockSetIsMinimized);

            const container = document.querySelector(".groupingKey");
            expect(container?.classList.contains("hidden")).toBe(true);
        });

        it("resets minimized state to false", () => {
            const meta = {
                scenario: "Resetting state when clearing",
                behavior: "Should call setIsMinimized(false)"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            const mockSetIsMinimized = vi.fn();
            clearGroupingKey(settings, mockSetIsMinimized);

            expect(mockSetIsMinimized).toHaveBeenCalledWith(false);
        });

        it("handles undefined setter gracefully", () => {
            const meta = {
                scenario: "Clearing without state setter",
                behavior: "Should not throw error"
            };

            const settingsElement = document.querySelector(".settings") as HTMLDivElement;
            const settings = d3.select(settingsElement) as d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
            
            // Should not throw
            expect(() => {
                clearGroupingKey(settings, undefined as any);
            }).not.toThrow();
        });
    });
});

