export const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
export const closeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
export const copiedIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`;
export const minimizeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up"><path d="m18 15-6-6-6 6"/></svg>`;
export const expandIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`;

/**
 * Retrieves the computed value of the CSS custom property '--primary' from a given DOM element.
 * If the element is null or the property is not defined on the element,
 * it falls back to the value of '--primary' defined on the document's root element.
 *
 * @param {Element | null} node - The DOM element from which to retrieve the '--primary' color. Can be null.
 * @returns {string} The computed color string (e.g., "rgb(0, 0, 255)", "#0000FF") for the '--primary' property,
 *                   or the fallback value from the root element if not found on the node or if the node is null.
*/
export const getPrimaryColorFromNode = (node: Element | null): string => {
    const fallback = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    if (node) {
      const color = getComputedStyle(node).getPropertyValue('--primary').trim();
      return color || fallback;
    }
    return fallback;
};

/**
 * Resolves color hierarchy by returning the first available color from the provided hierarchy.
 * Returns the primary color if available, otherwise falls back to the secondary color.
 * If neither is available, falls back to the CSS --primary variable.
 * 
 * @param {string | null | undefined} primaryColor - The primary color value (e.g., tile color)
 * @param {string | null | undefined} secondaryColor - The fallback color value (e.g., tab color)
 * @returns {string} The resolved color value, with CSS --primary as ultimate fallback
 */
export const resolveColorHierarchy = (
    primaryColor: string | null | undefined, 
    secondaryColor: string | null | undefined
): string => {
    if (primaryColor && primaryColor.trim() !== '') {
        return primaryColor;
    }
    if (secondaryColor && secondaryColor.trim() !== '') {
        return secondaryColor;
    }
    // Fallback to CSS primary color
    return getPrimaryColorFromNode(null);
};