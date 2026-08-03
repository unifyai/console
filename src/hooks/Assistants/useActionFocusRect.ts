/**
 * Geometry for the focused-action overlay.
 *
 * Owns the overlay's viewport rect, the maximise toggle, and pointer-driven
 * resizing from any edge or corner. The rect survives close/reopen and page
 * reloads via localStorage, re-clamped to the current viewport on read so a
 * rect saved on a larger screen never opens off-canvas.
 */

import * as React from 'react';
import type { ActionFocusRect, ActionFocusResizeEdge } from '@/types/assistants/actionFocus';

const STORAGE_KEY = 'console:assistants:action-focus-rect';

const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;

/** Gap left around the overlay when it opens without a stored rect. */
const DEFAULT_INSET = 48;

/** Placeholder used while `window` is unavailable; never painted. */
const SSR_RECT: ActionFocusRect = { left: 0, top: 0, width: 960, height: 640 };

const EDGE_CURSOR: Record<ActionFocusResizeEdge, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

function clampToViewport(rect: ActionFocusRect): ActionFocusRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), vw);
  const height = Math.min(Math.max(rect.height, MIN_HEIGHT), vh);
  return {
    width,
    height,
    left: Math.min(Math.max(rect.left, 0), Math.max(0, vw - width)),
    top: Math.min(Math.max(rect.top, 0), Math.max(0, vh - height)),
  };
}

function viewportRect(): ActionFocusRect {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function defaultRect(): ActionFocusRect {
  return clampToViewport({
    left: DEFAULT_INSET,
    top: DEFAULT_INSET,
    width: window.innerWidth - DEFAULT_INSET * 2,
    height: window.innerHeight - DEFAULT_INSET * 2,
  });
}

function readStoredRect(): ActionFocusRect | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<ActionFocusRect> | null;
    if (
      !parsed ||
      typeof parsed.left !== 'number' ||
      typeof parsed.top !== 'number' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number'
    ) {
      return null;
    }
    return clampToViewport(parsed as ActionFocusRect);
  } catch {
    return null;
  }
}

function writeStoredRect(rect: ActionFocusRect): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rect));
  } catch {
    /* optional persistence */
  }
}

/** Applies a pointer delta to the edges named by `edge`, honouring the minimums. */
function resizeRect(
  start: ActionFocusRect,
  edge: ActionFocusResizeEdge,
  dx: number,
  dy: number
): ActionFocusRect {
  let { left, top, width, height } = start;

  if (edge.includes('e')) width = start.width + dx;
  if (edge.includes('w')) {
    width = start.width - dx;
    left = start.left + dx;
  }
  if (edge.includes('s')) height = start.height + dy;
  if (edge.includes('n')) {
    height = start.height - dy;
    top = start.top + dy;
  }

  // Below the minimum the dragged edge stops; the opposite edge stays put.
  if (width < MIN_WIDTH) {
    if (edge.includes('w')) left = start.left + start.width - MIN_WIDTH;
    width = MIN_WIDTH;
  }
  if (height < MIN_HEIGHT) {
    if (edge.includes('n')) top = start.top + start.height - MIN_HEIGHT;
    height = MIN_HEIGHT;
  }

  return clampToViewport({ left, top, width, height });
}

export interface UseActionFocusRectResult {
  rect: ActionFocusRect;
  isMaximized: boolean;
  isResizing: boolean;
  toggleMaximized: () => void;
  startResize: (event: React.PointerEvent, edge: ActionFocusResizeEdge) => void;
}

export function useActionFocusRect(): UseActionFocusRectResult {
  const [rect, setRect] = React.useState<ActionFocusRect>(() =>
    typeof window === 'undefined' ? SSR_RECT : (readStoredRect() ?? defaultRect())
  );
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);

  const rectRef = React.useRef(rect);
  rectRef.current = rect;
  // The rect to return to when maximise is switched back off.
  const restoreRectRef = React.useRef(rect);

  const toggleMaximized = React.useCallback(() => {
    setIsMaximized((wasMaximized) => {
      if (wasMaximized) {
        setRect(clampToViewport(restoreRectRef.current));
      } else {
        restoreRectRef.current = rectRef.current;
        setRect(viewportRect());
      }
      return !wasMaximized;
    });
  }, []);

  const startResize = React.useCallback(
    (event: React.PointerEvent, edge: ActionFocusResizeEdge) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      // Dragging an edge is an explicit size choice, so it leaves maximised mode
      // and continues from the rect currently on screen.
      setIsMaximized(false);
      const start = rectRef.current;
      restoreRectRef.current = start;

      const startX = event.clientX;
      const startY = event.clientY;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = EDGE_CURSOR[edge];
      document.body.style.userSelect = 'none';
      setIsResizing(true);

      let next = start;

      const onMove = (moveEvent: PointerEvent) => {
        next = resizeRect(start, edge, moveEvent.clientX - startX, moveEvent.clientY - startY);
        setRect(next);
      };

      const onUp = () => {
        setIsResizing(false);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        restoreRectRef.current = next;
        writeStoredRect(next);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    []
  );

  // Keep the window on screen when the viewport shrinks behind it.
  React.useEffect(() => {
    const onWindowResize = () => {
      setRect((prev) => (isMaximized ? viewportRect() : clampToViewport(prev)));
    };
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [isMaximized]);

  return { rect, isMaximized, isResizing, toggleMaximized, startResize };
}
