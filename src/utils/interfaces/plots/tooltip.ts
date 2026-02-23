'use client';

import * as d3 from 'd3';
import { InfoCardData } from '@/types/interfaces/plot';
import { expandIconSVG, closeIconSVG, copiedIconSVG, copyIconSVG, minimizeIconSVG } from './common';

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
    `;
  if (data.group) {
    const groupTemplate = `
        <p>${data.group.name}</p>
        <p class="font-bold">${data.group.value}</p>
        <div style="border-bottom: 1px solid var(--foreground); margin: 4px 0;"></div>
        `;
    template = groupTemplate + template;
  }
  if (data.aggregate) {
    const aggregateTemplate = `
        <p>${data.aggregate.name}</p>
        <div style="border-bottom: 1px solid var(--foreground); margin: 4px 0;"></div>
        `;
    template = aggregateTemplate + template;
  }
  // Instructions to pin the tooltip
  template += `
        <div class="border-b border-border my-2"></div>
        <p class="text-caption flex items-center gap-1">
            <span class="inline-block" aria-hidden="true">ⓘ</span>
            <span class="italic">Click to pin in the foldable menu</span>
        </p>
    `;

  return template;
};

/**
 * Renders the content of the fixed tooltip based on the bound datum.
 * Includes Close and Minimize/Expand buttons. Handles re-rendering on minimize/expand.
 * @param container d3.Selection of the fixed tooltip div.
 * @param settings d3.Selection of the settings panel div (used to access state/setter).
 */
function renderFixedTooltipContent(
  container: d3.Selection<HTMLDivElement, InfoCardData | InfoCardData[] | null, null, any>,
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>
) {
  const data = container.datum(); // Get the bound data (can be single or array)

  // Retrieve state and setter from the settings DOM node
  const settingsNode = settings.node();
  const isMinimized = settingsNode ? ((settingsNode as any).__isTooltipMinimized ?? false) : false;
  const setIsMinimized = settingsNode ? (settingsNode as any).__setIsTooltipMinimized : undefined;

  if (!data) {
    // Ensure it's cleared and hidden if no data
    container.datum(null).html('').classed('hidden', true);
    return;
  }

  container.html(''); // Clear previous content completely before rebuilding
  container.classed('hidden', false); // Ensure visible

  // --- Header Row using Flexbox ---
  const header = container
    .append('div')
    .attr('class', 'flex justify-between items-center min-h-6 mb-1');

  // --- Title ---
  header
    .append('span')
    .attr('class', `text-xs font-semibold mr-2`)
    .text(
      Array.isArray(data) && data.length > 1
        ? `${data.length} Pinned Datapoints`
        : 'Pinned Datapoint'
    );

  // --- Button Group ---
  const buttonGroup = header.append('div').attr('class', 'flex items-center gap-1 ml-auto');

  // --- Add Minimize/Expand Button ---
  if (setIsMinimized) {
    buttonGroup
      .append('button')
      .attr('class', 'p-0.5 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring')
      .attr('aria-label', isMinimized ? 'Expand tooltip' : 'Minimize tooltip')
      .html(isMinimized ? expandIconSVG : minimizeIconSVG)
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
  buttonGroup
    .append('button')
    .attr('class', 'p-0.5 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring')
    .attr('aria-label', 'Close tooltip')
    .html(closeIconSVG)
    .on('click', (event) => {
      event.stopPropagation();
      const currentSetter = settingsNode
        ? (settingsNode as any).__setIsTooltipMinimized
        : undefined;
      if (currentSetter) {
        clearFixedTooltip(settings, currentSetter); // Resets minimized state too
      } else {
        // Fallback
        container.datum(null).html('').classed('hidden', true);
      }
    });

  // --- Content Wrapper (Only add content if NOT minimized) ---
  if (!isMinimized) {
    const contentWrapper = container
      .append('div')
      .attr('class', 'tooltip-content-wrapper flex flex-col gap-1 mt-1');

    // Helper function to add an item (label, value, copy button)
    // It now takes `parent` argument to append to the correct container
    const addItem = (
      label: string,
      value: string | number | undefined,
      parent: d3.Selection<HTMLDivElement, any, any, any>
    ) => {
      const itemDiv = parent.append('div').attr('class', 'flex items-center justify-between gap-2');
      const textDiv = itemDiv.append('div').attr('class', 'flex-1 overflow-hidden');
      textDiv.append('p').attr('class', 'text-caption truncate').text(label);
      if (value != null) {
        textDiv.append('p').attr('class', 'font-semibold truncate text-sm').text(value);
      }

      if (value != null) {
        const copyButton = itemDiv
          .append('button')
          .attr(
            'class',
            'p-1 rounded hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring copy-button shrink-0'
          )
          .attr('aria-label', `Copy ${label}`)
          .html(copyIconSVG);

        copyButton.on('click', function (event) {
          event.stopPropagation();
          const button = d3.select(this);
          navigator.clipboard
            .writeText(String(value))
            .then(() => {
              button.html(copiedIconSVG);
              setTimeout(() => {
                button.html(copyIconSVG);
              }, 1500);
            })
            .catch((err) => {
              console.error('Failed to copy text: ', err);
            });
        });
      } else {
        itemDiv.append('div').attr('class', 'w-6 shrink-0'); // Placeholder for alignment
      }
    };

    if (!Array.isArray(data)) {
      // --- Single item ---
      if (data.aggregate) {
        addItem(data.aggregate.name, undefined, contentWrapper);
        contentWrapper.append('div').attr('class', 'border-b border-border my-1');
      }
      if (data.group) {
        addItem(data.group.name, data.group.value, contentWrapper);
        contentWrapper.append('div').attr('class', 'border-b border-border my-1');
      }
      addItem(data.x.name, data.x.value, contentWrapper);
      if (data.y) {
        contentWrapper.append('div').attr('class', 'border-b border-border my-1');
        addItem(data.y.name, data.y.value, contentWrapper);
      }
    } else {
      // --- Array of items ---
      const scrollableDiv = contentWrapper
        .append('div')
        .attr('class', 'max-h-[200px] overflow-y-auto pr-1 command-scrollbar');

      data.forEach((item, index) => {
        // Create a dedicated container for each point's data
        const pointDataContainer = scrollableDiv
          .append('div')
          .attr(
            'class',
            `p-2 rounded border border-dashed border-muted/50 bg-muted/20 ${index > 0 ? 'mt-2' : ''}`
          ); // Add some padding, border, and margin-top for separation

        if (item.aggregate) {
          addItem(item.aggregate.name, undefined, pointDataContainer);
          // Add a small visual divider if there are more fields for this point
          if (item.group || item.x || item.y) {
            pointDataContainer.append('div').attr('class', 'border-b border-border/50 my-1 mx-1');
          }
        }
        if (item.group) {
          addItem(item.group.name, item.group.value, pointDataContainer);
          if (item.x || item.y) {
            pointDataContainer.append('div').attr('class', 'border-b border-border/50 my-1 mx-1');
          }
        }
        addItem(item.x.name, item.x.value, pointDataContainer);
        if (item.y) {
          pointDataContainer.append('div').attr('class', 'border-b border-border/50 my-1 mx-1');
          addItem(item.y.name, item.y.value, pointDataContainer);
        }
      });
    }
  }
}

/**
 * Generic click handler for plot elements (bars, points, hist bins) to handle fixed tooltip.
 * If the sidebar is closed, it attempts to open it before pinning.
 * @param event The click event.
 * @param data The data associated with the clicked element (InfoCardData structure or array).
 * @param settings d3.Selection of the settings panel div (which should have state/setters attached).
 */
export function showFixedTooltip(
  event: MouseEvent,
  data: InfoCardData | InfoCardData[] | null, // Accepts single or array
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>
) {
  event.stopPropagation(); // Prevent triggering other listeners

  const settingsNode = settings.node();
  if (!settingsNode) {
    console.error('Settings panel node not found for fixed tooltip.');
    return; // Safety check
  }

  // Retrieve state and setter from the settings DOM node
  const isOpen = (settingsNode as any).__isOpen;
  const setIsOpen = (settingsNode as any).__setIsOpen;

  // Define the core logic for pinning the tooltip
  const executePinning = () => {
    // Re-select the container *inside* this function,
    // especially if it runs after a delay, to ensure it exists.
    const fixedTooltipContainer = settings.select<HTMLDivElement>('.fixedPlotTooltip');

    // Check if the container was successfully created/found
    if (!fixedTooltipContainer.node()) {
      console.error(
        'Fixed tooltip container (.fixedPlotTooltip) not found in the DOM even after attempting to open sidebar. Cannot pin data.'
      );
      // Attempt to clear any potentially stale data binding if the element *was* there before but now isn't
      settings
        .selectAll<HTMLDivElement, any>('.fixedPlotTooltip')
        .datum(null)
        .html('')
        .classed('hidden', true);
      return;
    }

    // Proceed with binding data and rendering
    fixedTooltipContainer.datum(data); // Bind the new data (or null to clear)
    renderFixedTooltipContent(
      fixedTooltipContainer as d3.Selection<HTMLDivElement, any, null, any>,
      settings
    ); // Render
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
    console.warn(
      'Sidebar is closed, but cannot find function to open it. Tooltip cannot be pinned while closed.'
    );
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
 * @param container The D3 selection of the plot container element.
 */
export const positionTooltipRelativeToPointer = (
  event: MouseEvent,
  tooltip: any,
  container: any
) => {
  const tooltipNode = tooltip.node();
  const containerNode = container.node();

  if (!tooltipNode || !containerNode) return;

  tooltip.style('opacity', 1); // Ensure visible for measurement

  const tooltipRect = tooltipNode.getBoundingClientRect();
  const tooltipWidth = tooltipRect.width;
  const tooltipHeight = tooltipRect.height;

  // --- Use d3.pointer relative to the container ---
  const [pointerX, pointerY] = d3.pointer(event, containerNode);

  // --- Simple offset calculation relative to the container ---
  // Place slightly below and to the right of the cursor within the container
  const offsetX = 10;
  const offsetY = 10;
  let xPos = pointerX + offsetX;
  let yPos = pointerY + offsetY;

  // --- Boundary checks *within the container* ---
  const containerRect = containerNode.getBoundingClientRect();
  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;

  // If tooltip goes past the right edge of the container, flip it to the left of the cursor
  if (xPos + tooltipWidth > containerWidth) {
    xPos = pointerX - tooltipWidth - offsetX;
  }
  // If tooltip goes past the left edge (after potential flip), clamp it
  if (xPos < 0) {
    xPos = 0;
  }

  // If tooltip goes past the bottom edge, flip it above the cursor
  if (yPos + tooltipHeight > containerHeight) {
    yPos = pointerY - tooltipHeight - offsetY;
  }
  // If tooltip goes past the top edge (after potential flip), clamp it
  if (yPos < 0) {
    yPos = 0;
  }

  // Apply styles relative to the container
  tooltip.style('left', `${xPos}px`).style('top', `${yPos}px`);
};

/**
 * Positions the tooltip relative to a target SVG element within a container,
 * accounting for SVG transforms (zoom/pan).
 * @param targetElement The SVG element (e.g., circle, rect) to position against.
 * @param tooltip The D3 selection of the tooltip HTML element.
 * @param container The D3 selection of the main plot container div.
 * @param svg The D3 selection of the SVG element.
 * @param currentTransform The current d3.ZoomTransform applied to the plot.
 */
export function positionTooltipRelativeToDatapoint(
  targetElement: SVGElement,
  tooltip: any,
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  currentTransform: d3.ZoomTransform
) {
  const tooltipNode = tooltip.node();
  const containerNode = container.node();
  const svgNode = svg.node();

  if (!tooltipNode || !containerNode || !svgNode || !targetElement) {
    tooltip.style('opacity', 0); // Hide if essentials are missing
    return;
  }

  // 1. Get BBox of the target element *in its local SVG coordinates*
  const bbox = (targetElement as SVGGraphicsElement).getBBox(); // Use SVGGraphicsElement for getBBox

  // 2. Calculate the center of the BBox in local SVG coordinates
  const localX = bbox.x + bbox.width / 2;
  const localY = bbox.y + bbox.height / 2;

  // 3. Apply the current zoom/pan transform to get *screen coordinates relative to the SVG viewport*
  const svgScreenX = currentTransform.applyX(localX);
  const svgScreenY = currentTransform.applyY(localY);

  // 4. Convert SVG screen coordinates to coordinates relative to the *container div*
  const svgRect = svgNode.getBoundingClientRect();
  const containerRect = containerNode.getBoundingClientRect();

  // Position relative to the container's top-left corner
  const containerRelativeX = svgScreenX + (svgRect.left - containerRect.left);
  const containerRelativeY = svgScreenY + (svgRect.top - containerRect.top);

  // 5. Position the tooltip near the calculated point, checking bounds
  tooltip.style('opacity', 1); // Ensure visible
  const tooltipRect = tooltipNode.getBoundingClientRect();
  const tooltipWidth = tooltipRect.width;
  const tooltipHeight = tooltipRect.height;
  const offsetX = 15;
  const offsetY = 15;
  const containerWidth = containerRect.width;
  const containerHeight = containerRect.height;

  let xPos = containerRelativeX + offsetX;
  let yPos = containerRelativeY + offsetY;

  // Adjust position based on container boundaries
  if (xPos + tooltipWidth > containerWidth) {
    xPos = containerRelativeX - tooltipWidth - offsetX; // Move left
  }
  if (xPos < 0) {
    xPos = offsetX; // Prevent going off left edge
  }
  if (yPos + tooltipHeight > containerHeight) {
    yPos = containerRelativeY - tooltipHeight - offsetY; // Move up
  }
  if (yPos < 0) {
    yPos = offsetY; // Prevent going off top edge
  }

  tooltip.style('left', `${xPos}px`).style('top', `${yPos}px`);
}

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
  const container = settings.select<HTMLDivElement>('.fixedPlotTooltip');
  container.datum(null).html('').classed('hidden', true);
  // Reset minimized state ONLY when explicitly closed/cleared
  if (setIsFixedTooltipMinimized) {
    setIsFixedTooltipMinimized(false);
  }
}
