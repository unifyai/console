import { createRef, MutableRefObject } from 'react';

/**
 * A client-side registry for React refs that can be accessed globally.
 * This avoids the limitations of server components which can't pass refs.
 */

// Maps for storing refs by their IDs
const tileButtonsRefMap = new Map<string, MutableRefObject<HTMLDivElement | null>>();
const tileCardRefMap = new Map<string, MutableRefObject<HTMLDivElement | null>>();

// Create and get tile buttons ref
export function getTileButtonsRef(tileId: string): MutableRefObject<HTMLDivElement | null> {
  if (!tileButtonsRefMap.has(tileId)) {
    tileButtonsRefMap.set(tileId, createRef<HTMLDivElement>());
  }
  return tileButtonsRefMap.get(tileId)!;
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
  tileButtonsRefMap.delete(tileId);
  tileCardRefMap.delete(tileId);
} 