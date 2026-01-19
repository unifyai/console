/**
 * usePlotDetails - Hook for managing plot details state
 *
 * Provides state and callbacks for:
 * - Groups (from D3 grouping key)
 * - Pinned datapoints (from D3 fixed tooltip)
 * - Drawer open/close state
 * - Highlight state for bidirectional hover
 *
 * This hook serves as a bridge between the D3 rendering logic and React state.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PlotGroup, PinnedDatapoint, PlotAxesInfo } from '@/types/interfaces/plot-details';
import { HighlightTarget } from '@/types/interfaces/plot';

/**
 * Props for the usePlotDetails hook
 */
export interface UsePlotDetailsProps {
  /** X-axis field name */
  xAxis?: string;
  /** X-axis label override */
  xLabel?: string;
  /** X-axis scale */
  xScale?: string;
  /** Y-axis field name */
  yAxis?: string;
  /** Y-axis label override */
  yLabel?: string;
  /** Y-axis scale */
  yScale?: string;
  /** Metric for aggregation */
  metric?: string;
  /** Group by field name */
  groupBy?: string;
  /** Group by label override */
  groupByLabel?: string;
}

/**
 * Return type for usePlotDetails hook
 */
export interface UsePlotDetailsReturn {
  // State
  isDrawerOpen: boolean;
  groups: PlotGroup[];
  pinnedDatapoints: PinnedDatapoint[];
  axesInfo: PlotAxesInfo;

  // Computed counts for footer
  groupCount: number;
  pinnedCount: number;

  // Actions
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // D3 integration - these are called by D3 rendering code
  setGroups: (groups: PlotGroup[]) => void;
  addPinnedDatapoint: (datapoint: PinnedDatapoint) => void;
  removePinnedDatapoint: (id: string) => void;
  clearPinnedDatapoints: () => void;

  // Highlight state for bidirectional hover highlighting
  highlightTarget: HighlightTarget;
  setHighlightTarget: (target: HighlightTarget) => void;
  clearHighlight: () => void;

  // Ref to attach to the container for D3 to access these functions
  detailsRef: React.RefObject<PlotDetailsHandle | null>;
}

/**
 * Handle interface exposed via ref for D3 code to call
 */
export interface PlotDetailsHandle {
  setGroups: (groups: PlotGroup[]) => void;
  addPinnedDatapoint: (datapoint: PinnedDatapoint) => void;
  removePinnedDatapoint: (id: string) => void;
  clearPinnedDatapoints: () => void;
}

/**
 * usePlotDetails Hook
 *
 * Manages the state for PlotFooter and PlotDetailsDrawer.
 */
export function usePlotDetails({
  xAxis = '',
  xLabel,
  xScale = 'linear',
  yAxis,
  yLabel,
  yScale = 'linear',
  metric,
  groupBy,
  groupByLabel,
}: UsePlotDetailsProps): UsePlotDetailsReturn {
  // Drawer state - open by default when plot loads
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // Groups state (set by D3 when rendering grouped plots)
  const [groups, setGroupsState] = useState<PlotGroup[]>([]);

  // Pinned datapoints state
  const [pinnedDatapoints, setPinnedDatapoints] = useState<PinnedDatapoint[]>([]);

  // Highlight state for bidirectional hover highlighting
  const [highlightTarget, setHighlightTargetState] = useState<HighlightTarget>({
    type: 'none',
  });

  // Build axes info from props
  const axesInfo: PlotAxesInfo = {
    x: {
      field: xAxis,
      label: xLabel,
      scale: xScale,
    },
    y: yAxis
      ? {
          field: yAxis,
          label: yLabel,
          scale: yScale,
          metric,
        }
      : undefined,
    groupBy: groupBy
      ? {
          field: groupBy,
          label: groupByLabel,
        }
      : undefined,
  };

  // Actions
  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), []);

  // D3 integration functions
  // Only update groups if they've actually changed (prevents infinite render loops)
  const setGroups = useCallback((newGroups: PlotGroup[]) => {
    setGroupsState((prevGroups) => {
      // Quick length check first
      if (prevGroups.length !== newGroups.length) {
        return newGroups;
      }
      // Deep comparison of keys and colors
      const hasChanged = newGroups.some(
        (g, i) => prevGroups[i]?.key !== g.key || prevGroups[i]?.color !== g.color
      );
      return hasChanged ? newGroups : prevGroups;
    });
  }, []);

  const addPinnedDatapoint = useCallback((datapoint: PinnedDatapoint) => {
    setPinnedDatapoints((prev) => {
      // Check if already pinned (by id)
      if (prev.some((p) => p.id === datapoint.id)) {
        return prev;
      }
      return [...prev, datapoint];
    });
  }, []);

  const removePinnedDatapoint = useCallback((id: string) => {
    setPinnedDatapoints((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearPinnedDatapoints = useCallback(() => {
    setPinnedDatapoints([]);
  }, []);

  // Highlight functions
  const setHighlightTarget = useCallback((target: HighlightTarget) => {
    setHighlightTargetState(target);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightTargetState({ type: 'none' });
  }, []);

  // Ref for D3 code to access
  const detailsRef = useRef<PlotDetailsHandle | null>(null);

  // Update the ref with current handlers
  useEffect(() => {
    detailsRef.current = {
      setGroups,
      addPinnedDatapoint,
      removePinnedDatapoint,
      clearPinnedDatapoints,
    };
  }, [setGroups, addPinnedDatapoint, removePinnedDatapoint, clearPinnedDatapoints]);

  return {
    // State
    isDrawerOpen,
    groups,
    pinnedDatapoints,
    axesInfo,

    // Computed
    groupCount: groups.length,
    pinnedCount: pinnedDatapoints.length,

    // Actions
    openDrawer,
    closeDrawer,
    toggleDrawer,

    // D3 integration
    setGroups,
    addPinnedDatapoint,
    removePinnedDatapoint,
    clearPinnedDatapoints,

    // Highlight state for bidirectional hover
    highlightTarget,
    setHighlightTarget,
    clearHighlight,

    // Ref
    detailsRef,
  };
}

export default usePlotDetails;
