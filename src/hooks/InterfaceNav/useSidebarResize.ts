import React from "react";

export interface UseSidebarResizeProps {
  /**
   * Direction of the resize handle
   * - 'left': Handle is on left side (for right-positioned panels)
   * - 'right': Handle is on right side (for left-positioned panels)
   */
  direction?: "left" | "right";

  /**
   * Current width of the panel
   */
  currentWidth: string;

  /**
   * Callback to update width when resizing
   */
  onResize: (width: string) => void;

  /**
   * Callback to toggle panel visibility
   */
  onToggle?: () => void;

  /**
   * Callback when panel is completely hidden
   */
  onCompletelyHide?: () => void;

  /**
   * Whether the panel is currently collapsed
   */
  isCollapsed?: boolean;

  /**
   * Whether the panel is completely hidden
   */
  isCompletelyHidden?: boolean;

  /**
   * Minimum resize width
   */
  minResizeWidth?: string;

  /**
   * Maximum resize width
   */
  maxResizeWidth?: string;

  /**
   * Whether to enable auto-collapse when dragged below threshold
   */
  enableAutoCollapse?: boolean;

  /**
   * Auto-collapse threshold as percentage of minResizeWidth
   */
  autoCollapseThreshold?: number;

  /**
   * Threshold to completely hide the sidebar (as percentage of collapsed width)
   */
  completelyHideThreshold?: number;

  /**
   * Threshold to expand when dragging in opposite direction (0.0-1.0)
   */
  expandThreshold?: number;

  /**
   * Whether to enable drag functionality
   */
  enableDrag?: boolean;

  /**
   * Callback to update dragging state
   */
  setIsDragging?: (isDragging: boolean) => void;

  /**
   * Cookie name for persisting width
   */
  widthCookieName?: string;

  /**
   * Cookie max age in seconds
   */
  widthCookieMaxAge?: number;
}

interface WidthUnit {
  value: number;
  unit: "rem" | "px";
}

/**
 * Parse width string into value and unit
 */
function parseWidth(width: string): WidthUnit {
  const unit = width.endsWith("rem") ? "rem" : "px";
  const value = Number.parseFloat(width);
  return { value, unit };
}

/**
 * Convert any width to pixels for calculations
 */
function toPx(width: string): number {
  const { value, unit } = parseWidth(width);
  return unit === "rem" ? value * 16 : value;
}

/**
 * Format width value with unit
 */
function formatWidth(value: number, unit: "rem" | "px"): string {
  return `${unit === "rem" ? value.toFixed(1) : Math.round(value)}${unit}`;
}

/**
 * Hook for handling resizable sidebar panels
 */
export function useSidebarResize({
  direction = "right",
  currentWidth,
  onResize,
  onToggle,
  onCompletelyHide,
  isCollapsed = false,
  isCompletelyHidden = false,
  minResizeWidth = "12rem",
  maxResizeWidth = "24rem",
  enableAutoCollapse = true,
  autoCollapseThreshold = 1.5,
  completelyHideThreshold = 0.5,
  expandThreshold = 0.2,
  enableDrag = true,
  setIsDragging = () => {},
  widthCookieName,
  widthCookieMaxAge = 60 * 60 * 24 * 7, // 1 week default
}: UseSidebarResizeProps) {
  // Refs for tracking drag state
  const dragRef = React.useRef<HTMLDivElement>(null);
  const startWidth = React.useRef(0);
  const startX = React.useRef(0);
  const isDragging = React.useRef(false);
  const isInteractingWithRail = React.useRef(false);
  const lastWidth = React.useRef(0);
  const dragStartPoint = React.useRef(0);
  const lastDragDirection = React.useRef<"expand" | "collapse" | null>(null);
  const lastTogglePoint = React.useRef(0);
  const lastToggleWidth = React.useRef(0);
  const toggleCooldown = React.useRef(false);
  const lastToggleTime = React.useRef(0);
  const dragDistanceFromToggle = React.useRef(0);

  // Constants for collapsed and hidden widths
  const COLLAPSED_WIDTH_PX = 48; // 3rem
  const HIDDEN_WIDTH_PX = 0;

  // Memoize min/max width calculations for performance
  const minWidthPx = React.useMemo(
    () => toPx(minResizeWidth),
    [minResizeWidth],
  );
  const maxWidthPx = React.useMemo(
    () => toPx(maxResizeWidth),
    [maxResizeWidth],
  );

  // Helper function to determine if width is increasing based on direction and mouse movement
  const isIncreasingWidth = React.useCallback(
    (currentX: number, referenceX: number): boolean => {
      return direction === "left"
        ? currentX < referenceX // For left-positioned handle, moving left increases width
        : currentX > referenceX; // For right-positioned handle, moving right increases width
    },
    [direction],
  );

  // Helper function to calculate width based on mouse position and direction
  const calculateWidth = React.useCallback(
    (e: MouseEvent, initialX: number, initialWidth: number): number => {
      const deltaX = e.clientX - initialX;
      
      if (direction === "left") {
        // For left-positioned handle (right panel)
        // Width increases as mouse moves left (negative deltaX)
        return initialWidth - deltaX;
      }
      // For right-positioned handle (left panel)
      // Width increases as mouse moves right (positive deltaX)
      return initialWidth + deltaX;
    },
    [direction],
  );

  // Persist width to cookie if cookie name is provided
  const persistWidth = React.useCallback(
    (width: string) => {
      if (widthCookieName) {
        document.cookie = `${widthCookieName}=${width}; path=/; max-age=${widthCookieMaxAge}`;
      }
    },
    [widthCookieName, widthCookieMaxAge],
  );

  // Handle mouse down on resize handle
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      isInteractingWithRail.current = true;

      if (!enableDrag) {
        return;
      }

      // Store initial state
      const currentWidthPx = isCompletelyHidden ? 0 : isCollapsed ? COLLAPSED_WIDTH_PX : toPx(currentWidth);
      startWidth.current = currentWidthPx;
      startX.current = e.clientX;
      dragStartPoint.current = e.clientX;
      lastWidth.current = currentWidthPx;
      lastTogglePoint.current = e.clientX;
      lastToggleWidth.current = currentWidthPx;
      lastDragDirection.current = null;
      toggleCooldown.current = false;
      lastToggleTime.current = 0;
      dragDistanceFromToggle.current = 0;

      e.preventDefault();
    },
    [enableDrag, isCollapsed, isCompletelyHidden, currentWidth],
  );

  // Handle mouse movement and resizing
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isInteractingWithRail.current) return;

      const deltaX = Math.abs(e.clientX - startX.current);
      if (!isDragging.current && deltaX > 5) {
        isDragging.current = true;
        setIsDragging(true);
      }

      if (isDragging.current) {
        // Get unit for width calculations
        const { unit } = parseWidth(currentWidth);

        // Determine current drag direction
        const currentDragDirection = isIncreasingWidth(
          e.clientX,
          lastTogglePoint.current,
        )
          ? "expand"
          : "collapse";

        // Update direction tracking
        if (lastDragDirection.current !== currentDragDirection) {
          lastDragDirection.current = currentDragDirection;
        }

        // Calculate distance from last toggle point
        dragDistanceFromToggle.current = Math.abs(
          e.clientX - lastTogglePoint.current,
        );

        // Check for toggle cooldown (prevent rapid toggling)
        const now = Date.now();
        if (toggleCooldown.current && now - lastToggleTime.current > 200) {
          toggleCooldown.current = false;
        }

        // Handle toggling between states
        if (!toggleCooldown.current) {
          // Calculate precise width based on mouse position
          const currentDragWidth = calculateWidth(
            e,
            startX.current,
            startWidth.current,
          );

          // Handle completely hiding when collapsed
          if (!isCompletelyHidden && isCollapsed && currentDragDirection === "collapse") {
            const hideThreshold = COLLAPSED_WIDTH_PX * completelyHideThreshold;
            if (currentDragWidth <= hideThreshold && onCompletelyHide) {
              onCompletelyHide();
              lastTogglePoint.current = e.clientX;
              lastToggleWidth.current = 0;
              toggleCooldown.current = true;
              lastToggleTime.current = now;
              return;
            }
          }

          // Handle expanding from completely hidden
          if (isCompletelyHidden && currentDragDirection === "expand") {
            if (dragDistanceFromToggle.current > 20 && onCompletelyHide) { // Small threshold to show
              onCompletelyHide(); // This will toggle the hidden state
              lastTogglePoint.current = e.clientX;
              lastToggleWidth.current = COLLAPSED_WIDTH_PX;
              toggleCooldown.current = true;
              lastToggleTime.current = now;
              return;
            }
          }

          // Handle collapsing when expanded
          if (enableAutoCollapse && onToggle && !isCollapsed && !isCompletelyHidden) {
            // Determine if we should collapse based on threshold
            let shouldCollapse = false;

            if (autoCollapseThreshold <= 1.0) {
              // For thresholds <= 1.0, collapse when width is below minWidth * threshold
              shouldCollapse =
                currentDragWidth <= minWidthPx * autoCollapseThreshold;
            } else {
              // For thresholds > 1.0, we need to drag beyond minWidth by a certain amount
              if (currentDragWidth <= minWidthPx) {
                // Calculate how much beyond minWidth we need to drag
                const extraDragNeeded =
                  minWidthPx * (autoCollapseThreshold - 1.0);

                // Only collapse if we've dragged far enough beyond minWidth
                const distanceBeyondMin = minWidthPx - currentDragWidth;

                shouldCollapse = distanceBeyondMin >= extraDragNeeded;
              }
            }

            if (currentDragDirection === "collapse" && shouldCollapse) {
              onToggle(); // Collapse
              lastTogglePoint.current = e.clientX;
              lastToggleWidth.current = COLLAPSED_WIDTH_PX;
              toggleCooldown.current = true;
              lastToggleTime.current = now;
              return;
            }
          }

          // Handle expanding from collapsed (but not hidden)
          if (
            isCollapsed &&
            !isCompletelyHidden &&
            currentDragDirection === "expand"
          ) {
            // Calculate the drag distance needed to expand
            const expandDistance = isCollapsed ? COLLAPSED_WIDTH_PX * 0.5 : minWidthPx * expandThreshold;
            
            if (dragDistanceFromToggle.current > expandDistance) {
              if (onToggle) {
                onToggle(); // Expand
              }

              // Calculate initial width based on exact mouse position
              const initialWidth = calculateWidth(
                e,
                startX.current,
                startWidth.current,
              );

              // Clamp to min/max
              const clampedWidth = Math.max(
                minWidthPx,
                Math.min(maxWidthPx, initialWidth),
              );

              // Set initial width when expanding
              const formattedWidth = formatWidth(
                unit === "rem" ? clampedWidth / 16 : clampedWidth,
                unit,
              );
              onResize(formattedWidth);
              persistWidth(formattedWidth);

              lastTogglePoint.current = e.clientX;
              lastToggleWidth.current = clampedWidth;
              toggleCooldown.current = true;
              lastToggleTime.current = now;
              return;
            }
          }
        }

        // Skip width calculations if panel is completely hidden (but not if just collapsed)
        if (isCompletelyHidden) {
          return;
        }

        // For collapsed state, allow direct expansion through dragging
        if (isCollapsed && currentDragDirection === "expand") {
          // Calculate new width based on mouse position
          const newWidthPx = calculateWidth(
            e,
            startX.current,
            COLLAPSED_WIDTH_PX, // Start from collapsed width
          );

          // If dragged beyond minimum width, expand and set the width
          if (newWidthPx >= minWidthPx) {
            if (!toggleCooldown.current && onToggle) {
              onToggle(); // Expand the sidebar
              toggleCooldown.current = true;
              lastToggleTime.current = now;
            }

            // Get viewport width to ensure sidebar doesn't exceed reasonable bounds
            const viewportWidth = window.innerWidth;
            const maxAllowedWidth = Math.min(maxWidthPx, viewportWidth * 0.5);

            // Clamp width between min and max
            const clampedWidthPx = Math.max(
              minWidthPx,
              Math.min(maxAllowedWidth, newWidthPx),
            );

            // Convert to the target unit
            const newWidth = unit === "rem" ? clampedWidthPx / 16 : clampedWidthPx;

            // Format and update width
            const formattedWidth = formatWidth(newWidth, unit);
            onResize(formattedWidth);
            persistWidth(formattedWidth);

            // Update last width
            lastWidth.current = clampedWidthPx;
          }
          return;
        }

        // Normal resize when expanded
        if (!isCollapsed) {
          // Calculate new width based on mouse position
          const newWidthPx = calculateWidth(
            e,
            startX.current,
            startWidth.current,
          );

          // Get viewport width to ensure sidebar doesn't exceed reasonable bounds
          const viewportWidth = window.innerWidth;
          const maxAllowedWidth = Math.min(maxWidthPx, viewportWidth * 0.5); // Max 50% of viewport

          // Clamp width between min and max
          const clampedWidthPx = Math.max(
            minWidthPx,
            Math.min(maxAllowedWidth, newWidthPx),
          );

          // Convert to the target unit
          const newWidth = unit === "rem" ? clampedWidthPx / 16 : clampedWidthPx;

          // Format and update width
          const formattedWidth = formatWidth(newWidth, unit);
          onResize(formattedWidth);
          persistWidth(formattedWidth);

          // Update last width
          lastWidth.current = clampedWidthPx;
        }
      }
    };

    const handleMouseUp = () => {
      if (!isInteractingWithRail.current) return;

      // Handle click (not drag) behavior
      if (!isDragging.current && onToggle) {
        // Allow toggle even when completely hidden - the toggle function will handle the state
        onToggle();
      }

      // Reset all state
      isDragging.current = false;
      isInteractingWithRail.current = false;
      lastWidth.current = 0;
      lastDragDirection.current = null;
      lastTogglePoint.current = 0;
      lastToggleWidth.current = 0;
      toggleCooldown.current = false;
      lastToggleTime.current = 0;
      dragDistanceFromToggle.current = 0;
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    onResize,
    onToggle,
    onCompletelyHide,
    isCollapsed,
    isCompletelyHidden,
    currentWidth,
    persistWidth,
    setIsDragging,
    minWidthPx,
    maxWidthPx,
    isIncreasingWidth,
    calculateWidth,
    enableAutoCollapse,
    autoCollapseThreshold,
    completelyHideThreshold,
    expandThreshold,
  ]);

  return {
    dragRef,
    isDragging,
    handleMouseDown,
  };
} 