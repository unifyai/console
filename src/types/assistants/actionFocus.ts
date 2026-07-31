/**
 * Types for the focused-action overlay — the floating window that blows a
 * single root action up out of the Actions list.
 */

/** Viewport-space rect of the overlay window, in CSS pixels. */
export interface ActionFocusRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Which edges a drag handle moves. Single letters move one edge, pairs move
 * the two edges meeting at a corner.
 */
export type ActionFocusResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
