/**
 * PlotDetails Hook Unit Tests
 *
 * Tests for usePlotDetails hook state management.
 *
 * This hook manages:
 * - Groups (from D3 grouping key)
 * - Pinned datapoints (from D3 click handlers)
 * - Drawer open/close state
 * - Highlight state for bidirectional hover
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlotDetails, UsePlotDetailsProps } from '@/hooks/Interfaces/Plot/usePlotDetails';
import { PlotGroup, PinnedDatapoint } from '@/types/interfaces/plot-details';
import { HighlightTarget } from '@/types/interfaces/plot';

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockGroup = (key: string, color: string = '#ff0000'): PlotGroup => ({
  key,
  color,
});

const createMockPinnedDatapoint = (
  id: string,
  xValue: string | number = 10,
  yValue: number = 20
): PinnedDatapoint => ({
  id,
  x: { label: 'X Axis', value: xValue },
  y: { label: 'Y Axis', value: yValue },
});

const createMockGroupedPinnedDatapoint = (
  id: string,
  groupValue: string = 'Group A'
): PinnedDatapoint => ({
  ...createMockPinnedDatapoint(id),
  group: { label: 'Category', value: groupValue },
});

const defaultProps: UsePlotDetailsProps = {
  xAxis: 'table1.x',
  yAxis: 'table1.y',
};

// =============================================================================
// usePlotDetails Tests
// =============================================================================

describe('usePlotDetails', () => {
  // ===========================================================================
  // Groups Management
  // ===========================================================================

  describe('groups management', () => {
    it('initializes with empty groups', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.groups).toEqual([]);
      expect(result.current.groupCount).toBe(0);
    });

    it('setGroups updates groups state', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const newGroups = [createMockGroup('A', '#ff0000'), createMockGroup('B', '#00ff00')];

      act(() => {
        result.current.setGroups(newGroups);
      });

      expect(result.current.groups).toEqual(newGroups);
      expect(result.current.groupCount).toBe(2);
    });

    it('setGroups prevents update when groups are identical (deep equality)', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const initialGroups = [createMockGroup('A', '#ff0000'), createMockGroup('B', '#00ff00')];

      act(() => {
        result.current.setGroups(initialGroups);
      });

      const groupsAfterFirstUpdate = result.current.groups;

      // Set identical groups
      act(() => {
        result.current.setGroups([
          createMockGroup('A', '#ff0000'),
          createMockGroup('B', '#00ff00'),
        ]);
      });

      // Should be the same reference (no update)
      expect(result.current.groups).toBe(groupsAfterFirstUpdate);
    });

    it('setGroups allows update when groups differ', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const initialGroups = [createMockGroup('A', '#ff0000')];

      act(() => {
        result.current.setGroups(initialGroups);
      });

      const groupsAfterFirstUpdate = result.current.groups;

      // Set different groups
      act(() => {
        result.current.setGroups([
          createMockGroup('A', '#ff0000'),
          createMockGroup('B', '#00ff00'),
        ]);
      });

      // Should be a new reference
      expect(result.current.groups).not.toBe(groupsAfterFirstUpdate);
      expect(result.current.groupCount).toBe(2);
    });

    it('setGroups detects color changes', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      act(() => {
        result.current.setGroups([createMockGroup('A', '#ff0000')]);
      });

      const groupsAfterFirstUpdate = result.current.groups;

      // Same key, different color
      act(() => {
        result.current.setGroups([createMockGroup('A', '#00ff00')]);
      });

      expect(result.current.groups).not.toBe(groupsAfterFirstUpdate);
      expect(result.current.groups[0].color).toBe('#00ff00');
    });

    it('setGroups clears groups when passed empty array', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      act(() => {
        result.current.setGroups([createMockGroup('A'), createMockGroup('B')]);
      });

      expect(result.current.groupCount).toBe(2);

      act(() => {
        result.current.setGroups([]);
      });

      expect(result.current.groups).toEqual([]);
      expect(result.current.groupCount).toBe(0);
    });
  });

  // ===========================================================================
  // Pinned Datapoints
  // ===========================================================================

  describe('pinned datapoints', () => {
    it('initializes with empty pinnedDatapoints', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.pinnedDatapoints).toEqual([]);
      expect(result.current.pinnedCount).toBe(0);
    });

    it('addPinnedDatapoint adds new datapoint', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const datapoint = createMockPinnedDatapoint('dp-1');

      act(() => {
        result.current.addPinnedDatapoint(datapoint);
      });

      expect(result.current.pinnedDatapoints).toHaveLength(1);
      expect(result.current.pinnedDatapoints[0]).toEqual(datapoint);
      expect(result.current.pinnedCount).toBe(1);
    });

    it('addPinnedDatapoint ignores duplicate by id', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const datapoint1 = createMockPinnedDatapoint('dp-1', 10, 20);
      const datapoint2 = createMockPinnedDatapoint('dp-1', 30, 40); // Same ID

      act(() => {
        result.current.addPinnedDatapoint(datapoint1);
      });

      act(() => {
        result.current.addPinnedDatapoint(datapoint2);
      });

      // Should still have only 1 datapoint with original values
      expect(result.current.pinnedDatapoints).toHaveLength(1);
      expect(result.current.pinnedDatapoints[0].x.value).toBe(10);
    });

    it('addPinnedDatapoint allows multiple datapoints with different ids', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      act(() => {
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-1'));
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-2'));
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-3'));
      });

      expect(result.current.pinnedDatapoints).toHaveLength(3);
      expect(result.current.pinnedCount).toBe(3);
    });

    it('addPinnedDatapoint handles grouped datapoints', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const datapoint = createMockGroupedPinnedDatapoint('dp-1', 'Category A');

      act(() => {
        result.current.addPinnedDatapoint(datapoint);
      });

      expect(result.current.pinnedDatapoints[0].group).toEqual({
        label: 'Category',
        value: 'Category A',
      });
    });

    it('removePinnedDatapoint removes by id', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      act(() => {
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-1'));
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-2'));
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-3'));
      });

      expect(result.current.pinnedCount).toBe(3);

      act(() => {
        result.current.removePinnedDatapoint('dp-2');
      });

      expect(result.current.pinnedCount).toBe(2);
      expect(result.current.pinnedDatapoints.map((p) => p.id)).toEqual(['dp-1', 'dp-3']);
    });

    it('removePinnedDatapoint does nothing for non-existent id', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      act(() => {
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-1'));
      });

      act(() => {
        result.current.removePinnedDatapoint('non-existent');
      });

      expect(result.current.pinnedCount).toBe(1);
    });

    it('clearPinnedDatapoints empties the list', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      act(() => {
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-1'));
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-2'));
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-3'));
      });

      expect(result.current.pinnedCount).toBe(3);

      act(() => {
        result.current.clearPinnedDatapoints();
      });

      expect(result.current.pinnedDatapoints).toEqual([]);
      expect(result.current.pinnedCount).toBe(0);
    });
  });

  // ===========================================================================
  // Drawer State
  // ===========================================================================

  describe('drawer state', () => {
    it('isDrawerOpen defaults to true', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.isDrawerOpen).toBe(true);
    });

    it('openDrawer sets isDrawerOpen to true', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      // First close it
      act(() => {
        result.current.closeDrawer();
      });

      expect(result.current.isDrawerOpen).toBe(false);

      // Then open it
      act(() => {
        result.current.openDrawer();
      });

      expect(result.current.isDrawerOpen).toBe(true);
    });

    it('closeDrawer sets isDrawerOpen to false', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.isDrawerOpen).toBe(true);

      act(() => {
        result.current.closeDrawer();
      });

      expect(result.current.isDrawerOpen).toBe(false);
    });

    it('toggleDrawer toggles isDrawerOpen', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.isDrawerOpen).toBe(true);

      act(() => {
        result.current.toggleDrawer();
      });

      expect(result.current.isDrawerOpen).toBe(false);

      act(() => {
        result.current.toggleDrawer();
      });

      expect(result.current.isDrawerOpen).toBe(true);
    });
  });

  // ===========================================================================
  // Highlight State
  // ===========================================================================

  describe('highlight state', () => {
    it('initializes highlightTarget as { type: "none" }', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.highlightTarget).toEqual({ type: 'none' });
    });

    it('setHighlightTarget updates to group type', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const groupHighlight: HighlightTarget = {
        type: 'group',
        groupKey: 'Category A',
      };

      act(() => {
        result.current.setHighlightTarget(groupHighlight);
      });

      expect(result.current.highlightTarget).toEqual(groupHighlight);
    });

    it('setHighlightTarget updates to datapoint type', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const datapointHighlight: HighlightTarget = {
        type: 'datapoint',
        datapointId: 'dp-123',
      };

      act(() => {
        result.current.setHighlightTarget(datapointHighlight);
      });

      expect(result.current.highlightTarget).toEqual(datapointHighlight);
    });

    it('setHighlightTarget resets to none type', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      // First set a highlight
      act(() => {
        result.current.setHighlightTarget({ type: 'group', groupKey: 'A' });
      });

      expect(result.current.highlightTarget.type).toBe('group');

      // Then reset
      act(() => {
        result.current.setHighlightTarget({ type: 'none' });
      });

      expect(result.current.highlightTarget).toEqual({ type: 'none' });
    });

    it('clearHighlight resets to none type', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      act(() => {
        result.current.setHighlightTarget({ type: 'group', groupKey: 'A' });
      });

      act(() => {
        result.current.clearHighlight();
      });

      expect(result.current.highlightTarget).toEqual({ type: 'none' });
    });

    it('supports rapid highlight transitions', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      act(() => {
        result.current.setHighlightTarget({ type: 'group', groupKey: 'A' });
      });
      expect(result.current.highlightTarget).toEqual({
        type: 'group',
        groupKey: 'A',
      });

      act(() => {
        result.current.setHighlightTarget({ type: 'group', groupKey: 'B' });
      });
      expect(result.current.highlightTarget).toEqual({
        type: 'group',
        groupKey: 'B',
      });

      act(() => {
        result.current.setHighlightTarget({ type: 'datapoint', datapointId: 'dp-1' });
      });
      expect(result.current.highlightTarget).toEqual({
        type: 'datapoint',
        datapointId: 'dp-1',
      });

      act(() => {
        result.current.setHighlightTarget({ type: 'none' });
      });
      expect(result.current.highlightTarget).toEqual({ type: 'none' });
    });
  });

  // ===========================================================================
  // Computed Values
  // ===========================================================================

  describe('computed values', () => {
    it('groupCount reflects groups.length', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.groupCount).toBe(0);

      act(() => {
        result.current.setGroups([
          createMockGroup('A'),
          createMockGroup('B'),
          createMockGroup('C'),
        ]);
      });

      expect(result.current.groupCount).toBe(3);
    });

    it('pinnedCount reflects pinnedDatapoints.length', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.pinnedCount).toBe(0);

      act(() => {
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-1'));
        result.current.addPinnedDatapoint(createMockPinnedDatapoint('dp-2'));
      });

      expect(result.current.pinnedCount).toBe(2);
    });
  });

  // ===========================================================================
  // Axes Info
  // ===========================================================================

  describe('axes info', () => {
    it('axesInfo is built from props correctly', () => {
      const { result } = renderHook(() =>
        usePlotDetails({
          xAxis: 'table1.timestamp',
          xLabel: 'Time',
          xScale: 'linear',
          yAxis: 'table1.value',
          yLabel: 'Value',
          yScale: 'log',
          metric: 'sum',
          groupBy: 'table1.category',
          groupByLabel: 'Category',
        })
      );

      expect(result.current.axesInfo).toEqual({
        x: {
          field: 'table1.timestamp',
          label: 'Time',
          scale: 'linear',
        },
        y: {
          field: 'table1.value',
          label: 'Value',
          scale: 'log',
          metric: 'sum',
        },
        groupBy: {
          field: 'table1.category',
          label: 'Category',
        },
      });
    });

    it('axesInfo handles missing optional fields', () => {
      const { result } = renderHook(() =>
        usePlotDetails({
          xAxis: 'table1.x',
        })
      );

      expect(result.current.axesInfo).toEqual({
        x: {
          field: 'table1.x',
          label: undefined,
          scale: 'linear', // default
        },
        y: undefined,
        groupBy: undefined,
      });
    });

    it('axesInfo includes y when yAxis provided', () => {
      const { result } = renderHook(() =>
        usePlotDetails({
          xAxis: 'table1.x',
          yAxis: 'table1.y',
        })
      );

      expect(result.current.axesInfo.y).toBeDefined();
      expect(result.current.axesInfo.y?.field).toBe('table1.y');
    });

    it('axesInfo includes groupBy when groupBy provided', () => {
      const { result } = renderHook(() =>
        usePlotDetails({
          xAxis: 'table1.x',
          groupBy: 'table1.group',
        })
      );

      expect(result.current.axesInfo.groupBy).toBeDefined();
      expect(result.current.axesInfo.groupBy?.field).toBe('table1.group');
    });
  });

  // ===========================================================================
  // Ref Handle
  // ===========================================================================

  describe('details ref', () => {
    it('provides detailsRef for D3 integration', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      expect(result.current.detailsRef).toBeDefined();
      expect(result.current.detailsRef.current).toBeDefined();
    });

    it('detailsRef.current has expected methods', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const handle = result.current.detailsRef.current;

      expect(handle).not.toBeNull();
      expect(typeof handle?.setGroups).toBe('function');
      expect(typeof handle?.addPinnedDatapoint).toBe('function');
      expect(typeof handle?.removePinnedDatapoint).toBe('function');
      expect(typeof handle?.clearPinnedDatapoints).toBe('function');
    });

    it('detailsRef methods work correctly', () => {
      const { result } = renderHook(() => usePlotDetails(defaultProps));

      const handle = result.current.detailsRef.current;

      act(() => {
        handle?.setGroups([createMockGroup('A')]);
      });

      expect(result.current.groupCount).toBe(1);

      act(() => {
        handle?.addPinnedDatapoint(createMockPinnedDatapoint('dp-1'));
      });

      expect(result.current.pinnedCount).toBe(1);
    });
  });
});
