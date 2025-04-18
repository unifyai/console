"use client";

import * as d3 from "d3";
import { GroupingColors } from "@/types/evals/plot";
import { expandIconSVG, minimizeIconSVG } from "./common";

/**
 * Generates *only* the list item HTML for the grouping key.
 * @param keys The color mapping for group keys.
 * @returns HTML string for the key items.
 */
export const keyTemplate = (keys: GroupingColors) => {
    const value = (entry: { key: string | null, color: string }) => entry.key?.toString().replace(/^"|"$/g, '') || 'null';
    return keys.map(entry => `
        <div class="key flex flex-row gap-2 items-center">
            <div class="rounded-full h-2 w-2 shrink-0" style="background-color: ${entry.color};"></div>
            <p class="text-xs text-foreground truncate">${value(entry)}</p>
        </div>
    `).join("\n");
}

/**
 * Renders the grouping key section, including header, buttons, and items.
 * Handles minimize/expand state and re-rendering.
 * @param settings d3.Selection of the settings panel div.
 * @param colors Array of group keys and their colors.
 */
export function renderGroupingKey(
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    colors: GroupingColors | null // Allow null to hide the key
) {
    const container = settings.select<HTMLDivElement>(".groupingKey");
    if (!colors || colors.length === 0) {
        // If no colors (no grouping), hide the container and potentially reset state
        const settingsNode = settings.node();
        const setIsMinimized = settingsNode ? (settingsNode as any).__setIsGroupingKeyMinimized : undefined;
        clearGroupingKey(settings, setIsMinimized); // Use the dedicated clear function
        return;
    }

    // Retrieve state and setter from the settings DOM node
    const settingsNode = settings.node();
    const isMinimized = settingsNode ? (settingsNode as any).__isGroupingKeyMinimized ?? false : false;
    const setIsMinimized = settingsNode ? (settingsNode as any).__setIsGroupingKeyMinimized : undefined;

    container.html(''); // Clear previous content
    container.classed('hidden', false); // Ensure container is visible

    // --- Header Row ---
    const header = container.append('div')
        .attr('class', 'flex justify-between items-center min-h-6 mb-1');

    // --- Title ---
    header.append('span')
        .attr('class', `text-xs font-semibold mr-2`)
        .text('Grouping Key');

    // --- Button Group ---
    const buttonGroup = header.append('div')
        .attr('class', 'flex items-center gap-1 ml-auto'); // Pushes buttons right

    // --- Minimize/Expand Button ---
    if (setIsMinimized) {
        buttonGroup.append('button')
            .attr('class', 'p-0.5 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring')
            .attr('aria-label', isMinimized ? 'Expand key' : 'Minimize key')
            .html(isMinimized ? expandIconSVG : minimizeIconSVG)
            .on('click', (event) => {
                event.stopPropagation();
                const newState = !isMinimized;
                setIsMinimized(newState);

                // Queue re-render
                setTimeout(() => {
                     // Re-fetch colors? No, they should be stable for this render cycle.
                     // Re-render with the *same* colors data but new state.
                    renderGroupingKey(settings, colors);
                }, 0);
            });
    }

    // --- Key Items (Only add if NOT minimized) ---
    if (!isMinimized) {
        const itemsWrapper = container.append('div')
             .attr('class', 'grouping-key-items mt-1 flex flex-col gap-1'); // Add margin top
        itemsWrapper.html(keyTemplate(colors));
    }
}

/**
 * Clears the content and hides the grouping key container.
 * Also resets the minimized state.
 * @param settings d3.Selection of the settings panel div.
 * @param setIsGroupingKeyMinimized Setter function to control minimize / expanded state for the grouping key.
*/
export function clearGroupingKey(
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    setIsGroupingKeyMinimized: (minimized: boolean) => void
) {
    const container = settings.select<HTMLDivElement>(".groupingKey");
    // Don't remove data binding here, just clear HTML and hide
    container.html('').classed('hidden', true);
    if (setIsGroupingKeyMinimized) {
        setIsGroupingKeyMinimized(false);
    }
}