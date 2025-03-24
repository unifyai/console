/**
 * Utility function to generate consistent indentation classes based on nesting level
 * - Level 0: No indentation for top-level items
 * - Level 1+: Indentation with left border to show parent-child relationship
 */
export function getIndentClasses(nestingLevel: number) {
  if (nestingLevel === 0) {
    // Top-level items have no left border, but ensure content has padding to make space for icons
    return "pl-0 border-l-0";
  }
  // Children have a vertical line to show parent-child relationship
  return "border-l border-l-muted ml-4 pl-3 relative";
}

/**
 * Utility function for content indentation - more explicit than getIndentClasses
 * This ensures content is always indented, even at top level
 */
export function getContentIndentClasses(nestingLevel: number) {
  // Always indent content to show parent-child relationship, regardless of level
  return "border-l border-l-muted ml-4 pl-3 relative";
}

/**
 * Utility function to determine if a separator should be shown
 * @param currentIndex Current item index
 * @param totalItems Total number of items
 * @returns CSS class for separation
 */
export function getSeparatorClasses(currentIndex: number, totalItems: number) {
  // Only add bottom border if not the last item
  return currentIndex < totalItems - 1 ? "border-b border-muted pb-2 mb-2" : "pb-2";
} 