import { createRef, MutableRefObject } from 'react';

/**
 * A client-side registry for React refs that can be accessed globally.
 * This avoids the limitations of server components which can't pass refs.
 */

// Maps for storing refs by their IDs
const tileHeaderRefMap = new Map<string, MutableRefObject<HTMLElement | null>>();
const tileCardRefMap = new Map<string, MutableRefObject<HTMLDivElement | null>>();

// Create and get tile header ref
export function getTileHeaderRef(tileId: string): MutableRefObject<HTMLElement | null> {
  if (!tileHeaderRefMap.has(tileId)) {
    tileHeaderRefMap.set(tileId, createRef<HTMLElement>());
  }
  return tileHeaderRefMap.get(tileId)!;
}

// Create and get tile card ref
export function getTileCardRef(tileId: string): MutableRefObject<HTMLDivElement | null> {
  if (!tileCardRefMap.has(tileId)) {
    tileCardRefMap.set(tileId, createRef<HTMLDivElement>());
  }
  return tileCardRefMap.get(tileId)!;
}

// Clean up refs when they're no longer needed
export function cleanupTileRefs(tileId: string): void {
  tileHeaderRefMap.delete(tileId);
  tileCardRefMap.delete(tileId);
}