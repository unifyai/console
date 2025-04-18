"use client";

import * as d3 from "d3";
import { GroupingColors, InfoCardData } from "@/types/evals/plot";
import { expandIconSVG, closeIconSVG, copiedIconSVG, copyIconSVG, minimizeIconSVG } from "./common";

/**
 * Generates the HTML content for the hover tooltip.
 * @param data The data for the hovered element.
 * @returns HTML string for the tooltip.
*/
export const tooltipTemplate = (data: InfoCardData) => {
    let template = `
    <p>${data.x.name}</p>
    <p class="font-bold">${data.x.value}</p>
    <div style="border-bottom: 1px solid var(--foreground); margin: 4px 0;"></div>
    <p>${data.y.name}</p>
    <p class="font-bold">${data.y.value}</p>
    `
    if (data.group) {
        const groupTemplate = `
        <p>${data.group.name}</p>
        <p class="font-bold">${data.group.value}</p>
        <div style="border-bottom: 1px solid var(--foreground); margin: 4px 0;"></div>
        `
        template = groupTemplate + template
    }
    if (data.aggregate) {
        const aggregateTemplate = `
        <p>${data.aggregate.name}</p>
        <div style="border-bottom: 1px solid var(--foreground); margin: 4px 0;"></div>
        `
        template = aggregateTemplate + template
    }
    // Instructions to pin the tooltip
    template += `
        <div class="border-b border-border my-2"></div>
        <p class="text-xs text-muted-foreground flex items-center gap-1">
            <span class="inline-block" aria-hidden="true">ⓘ</span>
            <span class="italic">Click to pin in the foldable menu</span>
        </p>
    `;

    return template
}

/**
 * Renders the content of the fixed tooltip based on the bound datum.
 * Includes Close and Minimize/Expand buttons. Handles re-rendering on minimize/expand.
 * @param container d3.Selection of the fixed tooltip div.
 * @param settings d3.Selection of the settings panel div (used to access state/setter).
 */
function renderFixedTooltipContent(
    container: d3.Selection<HTMLDivElement, InfoCardData | null, null, any>,
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>
) {
    const data = container.datum(); // Get the bound data

    // Retrieve state and setter from the settings DOM node
    const settingsNode = settings.node();
    const isMinimized = settingsNode ? (settingsNode as any).__isTooltipMinimized ?? false : false;
    const setIsMinimized = settingsNode ? (settingsNode as any).__setIsTooltipMinimized : undefined;

    if (!data) {
        // Ensure it's cleared and hidden if no data
        container.datum(null).html('').classed('hidden', true);
        return;
    }

    container.html(''); // Clear previous content completely before rebuilding
    container.classed('hidden', false); // Ensure visible

    // --- Header Row using Flexbox ---
    const header = container.append('div')
        // Use min-h-6 instead of h-6 to allow slight wrapping if needed, keep items centered
        .attr('class', 'flex justify-between items-center min-h-6 mb-1');

    // --- Title ---
    header.append('span')
        .attr('class', `text-xs font-semibold mr-2`)
        .text('Pinned Datapoint'); // Or just "Tooltip"

    // --- Button Group ---
    const buttonGroup = header.append('div')
        .attr('class', 'flex items-center gap-1 ml-auto'); // ml-auto pushes this group right

    // --- Add Minimize/Expand Button ---
    if (setIsMinimized) {
        buttonGroup.append('button')
            .attr('class', 'p-0.5 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring') // Tailwind classes
            .attr('aria-label', isMinimized ? 'Expand tooltip' : 'Minimize tooltip')
            .html(isMinimized ? expandIconSVG : minimizeIconSVG) // Dynamic icon
            .on('click', (event) => {
                event.stopPropagation();
                const newState = !isMinimized;
                setIsMinimized(newState); // Toggle React state

                // Use setTimeout to ensure React state update propagates to the DOM node attribute
                // and CSS classes are applied *before* D3 re-renders the content.
                setTimeout(() => {
                    const currentData = container.datum(); // Re-check data binding
                    if (currentData) {
                        renderFixedTooltipContent(container, settings); // Re-render with new state
                    }
                }, 0); // Minimal delay
            });
    }

    // --- Add Close Button ---
    buttonGroup.append('button')
        .attr('class', 'p-0.5 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring')
        .attr('aria-label', 'Close tooltip')
        .html(closeIconSVG)
        .on('click', (event) => {
            event.stopPropagation();
            const currentSetter = settingsNode ? (settingsNode as any).__setIsTooltipMinimized : undefined;
            if (currentSetter) {
                clearFixedTooltip(settings, currentSetter); // Resets minimized state too
            } else {
                // Fallback
                container.datum(null).html('').classed('hidden', true);
            }
        });

    // --- Content Wrapper (Only add content if NOT minimized) ---
    if (!isMinimized) {
        const contentWrapper = container.append('div')
            .attr('class', 'tooltip-content-wrapper flex flex-col gap-1 mt-1'); // Add margin top if content exists

        // Helper function to add an item with a copy button
        const addItem = (label: string, value?: string | number) => {
             const itemDiv = contentWrapper.append('div').attr('class', 'flex items-center justify-between gap-2');
            const textDiv = itemDiv.append('div').attr('class', 'flex-1 overflow-hidden');
            textDiv.append('p').attr('class', 'text-xs text-muted-foreground truncate').text(label);
            if (value != null) {
                textDiv.append('p').attr('class', 'font-semibold truncate text-sm').text(value);
            }

            if (value != null) {
                const copyButton = itemDiv.append('button')
                    .attr('class', 'p-1 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring copy-button shrink-0')
                    .attr('aria-label', `Copy ${label}`)
                    .html(copyIconSVG);

                copyButton.on('click', function(event) {
                    event.stopPropagation();
                    const button = d3.select(this);
                    navigator.clipboard.writeText(String(value)).then(() => {
                        button.html(copiedIconSVG);
                        setTimeout(() => {button.html(copyIconSVG)}, 1500);
                    }).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                });
            } else {
                itemDiv.append('div').attr('class', 'w-6 shrink-0'); // Placeholder for alignment
            }
        };

        // --- Render Data Items ---
        if (data.aggregate) {
            addItem(data.aggregate.name);
            contentWrapper.append('div').attr('class', 'border-b border-border my-1'); // Divider
        }
        if (data.group) {
            addItem(data.group.name, data.group.value);
            contentWrapper.append('div').attr('class', 'border-b border-border my-1'); // Divider
        }
        addItem(data.x.name, data.x.value);
        if (data.y) {
            contentWrapper.append('div').attr('class', 'border-b border-border my-1'); // Divider
            addItem(data.y.name, data.y.value);
        }
    }
}

/**
 * Generic click handler for plot elements (bars, points, hist bins) to handle fixed tooltip.
 * If the sidebar is closed, it attempts to open it before pinning.
 * @param event The click event.
 * @param data The data associated with the clicked element (InfoCardData structure).
 * @param settings d3.Selection of the settings panel div (which should have state/setters attached).
 */
export function showFixedTooltip( event: MouseEvent, data: InfoCardData | null, settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined> ) {
    event.stopPropagation(); // Prevent triggering other listeners
  
    const settingsNode = settings.node();
    if (!settingsNode) {
        console.error("Settings panel node not found for fixed tooltip.");
        return; // Safety check
    }
  
    // Retrieve state and setter from the settings DOM node
    const isOpen = (settingsNode as any).__isOpen;
    const setIsOpen = (settingsNode as any).__setIsOpen;
  
    // Define the core logic for pinning the tooltip
    const executePinning = () => {
        // Re-select the container *inside* this function,
        // especially if it runs after a delay, to ensure it exists.
        const fixedTooltipContainer = settings.select<HTMLDivElement>(".fixedPlotTooltip");
  
        // Check if the container was successfully created/found
        if (!fixedTooltipContainer.node()) {
            console.error("Fixed tooltip container (.fixedPlotTooltip) not found in the DOM even after attempting to open sidebar. Cannot pin data.");
            // Attempt to clear any potentially stale data binding if the element *was* there before but now isn't
            settings.selectAll<HTMLDivElement, any>(".fixedPlotTooltip").datum(null).html('').classed('hidden', true);
            return;
        }
  
        // Proceed with binding data and rendering
        fixedTooltipContainer.datum(data); // Bind the new data (or null to clear)
        renderFixedTooltipContent(fixedTooltipContainer as d3.Selection<HTMLDivElement, any, null, any>, settings); // Render
    };
  
    // --- Logic based on sidebar state ---
    if (data === null) {
        // If called with null data (e.g., explicit clear), just execute immediately
        executePinning();
    } else if (isOpen === false && typeof setIsOpen === 'function') {
        // Sidebar is closed, and we have the function to open it
        setIsOpen(true); // Trigger React state update to open sidebar
  
        // Use setTimeout to defer executePinning until *after* React has re-rendered
        // the sidebar with the .fixedPlotTooltip element present in the DOM.
        setTimeout(executePinning, 0); // 0ms delay is usually sufficient
  
    } else if (isOpen === true || isOpen === undefined) {
        // Sidebar is already open, or its state is unknown (e.g., initial render before effect runs)
        // Proceed immediately.
        executePinning();
  
    } else {
        // Sidebar is closed, but we don't have the setIsOpen function.
        // We cannot open it automatically. Log a warning.
        console.warn("Sidebar is closed, but cannot find function to open it. Tooltip cannot be pinned while closed.");
    }
}

/**
 * Positions the hover tooltip relative to the mouse cursor,
 * ensuring it stays within the viewport boundaries.
 *
 * IMPORTANT: This function should be called *after* the tooltip's
 * content has been updated (e.g., via .html()) so that its
 * dimensions can be measured correctly.
 *
 * @param event The mouse event (used for cursor position).
 * @param tooltip The D3 selection of the tooltip element.
 */
export const positionTooltip = (event: any, tooltip: any) => {
    const tooltipNode = tooltip.node();
    if (!tooltipNode) return;
    const [tooltipRect] = [tooltipNode.getBoundingClientRect()];
    const [tooltipWidth, tooltipHeight] = [tooltipRect.width, tooltipRect.height];
    const [pointerX, pointerY] = d3.pointer(event, event.target);
    const [xOffset, yOffset] = [
        pointerX - tooltipWidth / 2,
        pointerY < tooltipHeight ? pointerY + tooltipHeight / 1.75 : pointerY - tooltipHeight / 1.15
    ]
    tooltip
        .style("left", `${xOffset}px`)
        .style("top", `${yOffset}px`)
};

/**
 * Clears the content and hides the fixed tooltip container.
 * Also resets the minimized state.
 * @param settings d3.Selection of the settings panel div.
 * @param setIsFixedTooltipMinimized Setter function to control minimize / expanded state for the fixed tooltip.
*/
export function clearFixedTooltip(
    settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
    setIsFixedTooltipMinimized: (minimized: boolean) => void
) {
    const container = settings.select<HTMLDivElement>(".fixedPlotTooltip");
    container.datum(null).html('').classed('hidden', true);
    // Reset minimized state ONLY when explicitly closed/cleared
    if (setIsFixedTooltipMinimized) {
        setIsFixedTooltipMinimized(false);
    }
}