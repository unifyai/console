/**
 * PlotDetailsDrawer Component Unit Tests
 *
 * Tests for the PlotDetailsDrawer and its subsections:
 * - PlotDetailsDrawer (main container)
 * - DrawerGroupsSection
 * - DrawerPinnedSection
 * - DrawerAxesSection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlotDetailsDrawer } from '@/components/Common/Plot/PlotFooter/PlotDetailsDrawer';
import { DrawerGroupsSection } from '@/components/Common/Plot/PlotFooter/DrawerGroupsSection';
import { DrawerPinnedSection } from '@/components/Common/Plot/PlotFooter/DrawerPinnedSection';
import { DrawerAxesSection } from '@/components/Common/Plot/PlotFooter/DrawerAxesSection';
import { PlotGroup, PinnedDatapoint, PlotAxesInfo } from '@/types/interfaces/plot-details';

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

const createMockAxesInfo = (overrides: Partial<PlotAxesInfo> = {}): PlotAxesInfo => ({
  x: { field: 'table1.x', label: 'X Label', scale: 'linear' },
  y: { field: 'table1.y', label: 'Y Label', scale: 'linear', metric: 'sum' },
  groupBy: { field: 'table1.category', label: 'Category' },
  ...overrides,
});

// =============================================================================
// PlotDetailsDrawer Tests
// =============================================================================

describe('PlotDetailsDrawer', () => {
  describe('visibility', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <PlotDetailsDrawer
          isOpen={false}
          groups={[]}
          pinnedDatapoints={[]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders content when isOpen is true', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[]}
          pinnedDatapoints={[]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  describe('content sections', () => {
    it('renders DrawerAxesSection', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[]}
          pinnedDatapoints={[]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(screen.getByText('Axes')).toBeInTheDocument();
    });

    it('renders DrawerGroupsSection when groups exist', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[createMockGroup('A'), createMockGroup('B')]}
          pinnedDatapoints={[]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(screen.getByText('Groups (2)')).toBeInTheDocument();
    });

    it('does not render DrawerGroupsSection when no groups', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[]}
          pinnedDatapoints={[]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(screen.queryByText(/Groups/)).not.toBeInTheDocument();
    });

    it('renders DrawerPinnedSection when pinned datapoints exist', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[]}
          pinnedDatapoints={[createMockPinnedDatapoint('dp-1')]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(screen.getByText('Pinned (1)')).toBeInTheDocument();
    });

    it('does not render DrawerPinnedSection when no pinned datapoints', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[]}
          pinnedDatapoints={[]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(screen.queryByText(/Pinned/)).not.toBeInTheDocument();
    });

    it('shows "No details available" when no content', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[]}
          pinnedDatapoints={[]}
          axesInfo={{ x: { field: '' } }}
        />
      );

      expect(screen.getByText('No details available')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="region"', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[]}
          pinnedDatapoints={[]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('has aria-label', () => {
      render(
        <PlotDetailsDrawer
          isOpen={true}
          groups={[]}
          pinnedDatapoints={[]}
          axesInfo={createMockAxesInfo()}
        />
      );

      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Plot details');
    });
  });
});

// =============================================================================
// DrawerGroupsSection Tests
// =============================================================================

describe('DrawerGroupsSection', () => {
  describe('rendering', () => {
    it('renders all groups with correct colors', () => {
      const groups = [
        createMockGroup('Category A', '#ff0000'),
        createMockGroup('Category B', '#00ff00'),
        createMockGroup('Category C', '#0000ff'),
      ];

      const { container } = render(<DrawerGroupsSection groups={groups} />);

      expect(screen.getByText('Category A')).toBeInTheDocument();
      expect(screen.getByText('Category B')).toBeInTheDocument();
      expect(screen.getByText('Category C')).toBeInTheDocument();

      // Check color dots
      const colorDots = container.querySelectorAll('.rounded-full');
      expect(colorDots[0]).toHaveStyle('background-color: #ff0000');
      expect(colorDots[1]).toHaveStyle('background-color: #00ff00');
      expect(colorDots[2]).toHaveStyle('background-color: #0000ff');
    });

    it('shows count in header', () => {
      const groups = [createMockGroup('A'), createMockGroup('B')];

      render(<DrawerGroupsSection groups={groups} />);

      expect(screen.getByText('Groups (2)')).toBeInTheDocument();
    });

    it('displays "null" for empty group key', () => {
      const groups = [createMockGroup('', '#ff0000')];

      render(<DrawerGroupsSection groups={groups} />);

      expect(screen.getByText('null')).toBeInTheDocument();
    });

    it('handles empty groups array', () => {
      const { container } = render(<DrawerGroupsSection groups={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('highlight callbacks', () => {
    it('calls onHighlight with group type on hover', () => {
      const onHighlight = vi.fn();
      const groups = [createMockGroup('Category A')];

      render(<DrawerGroupsSection groups={groups} onHighlight={onHighlight} />);

      const groupElement = screen.getByText('Category A').parentElement;
      fireEvent.mouseEnter(groupElement!);

      expect(onHighlight).toHaveBeenCalledWith({
        type: 'group',
        groupKey: 'Category A',
      });
    });

    it('calls onHighlight with none type on mouse leave', () => {
      const onHighlight = vi.fn();
      const groups = [createMockGroup('Category A')];

      render(<DrawerGroupsSection groups={groups} onHighlight={onHighlight} />);

      const groupElement = screen.getByText('Category A').parentElement;
      fireEvent.mouseEnter(groupElement!);
      fireEvent.mouseLeave(groupElement!);

      expect(onHighlight).toHaveBeenLastCalledWith({ type: 'none' });
    });

    it('does not error when onHighlight is undefined', () => {
      const groups = [createMockGroup('Category A')];

      render(<DrawerGroupsSection groups={groups} />);

      const groupElement = screen.getByText('Category A').parentElement;

      // Should not throw
      fireEvent.mouseEnter(groupElement!);
      fireEvent.mouseLeave(groupElement!);
    });
  });
});

// =============================================================================
// DrawerPinnedSection Tests
// =============================================================================

describe('DrawerPinnedSection', () => {
  describe('rendering', () => {
    it('renders all pinned datapoints', () => {
      const pinnedDatapoints = [
        createMockPinnedDatapoint('dp-1', 10, 20),
        createMockPinnedDatapoint('dp-2', 30, 40),
      ];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} />);

      expect(screen.getByText('Pinned (2)')).toBeInTheDocument();
      expect(screen.getAllByText('Pinned Datapoint')).toHaveLength(2);
    });

    it('shows x and y values', () => {
      const pinnedDatapoints = [createMockPinnedDatapoint('dp-1', 'Value X', 99)];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} />);

      expect(screen.getByText('X Axis')).toBeInTheDocument();
      expect(screen.getByText('Value X')).toBeInTheDocument();
      expect(screen.getByText('Y Axis')).toBeInTheDocument();
      expect(screen.getByText('99')).toBeInTheDocument();
    });

    it('shows group value when present', () => {
      const pinnedDatapoints = [createMockGroupedPinnedDatapoint('dp-1', 'My Group')];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} />);

      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('My Group')).toBeInTheDocument();
    });

    it('handles empty pinnedDatapoints array', () => {
      const { container } = render(<DrawerPinnedSection pinnedDatapoints={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('unpin functionality', () => {
    it('calls onUnpin when X button clicked', () => {
      const onUnpin = vi.fn();
      const pinnedDatapoints = [createMockPinnedDatapoint('dp-1')];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} onUnpin={onUnpin} />);

      const unpinButton = screen.getByLabelText('Unpin datapoint');
      fireEvent.click(unpinButton);

      expect(onUnpin).toHaveBeenCalledWith('dp-1');
    });

    it('does not render unpin button when onUnpin is undefined', () => {
      const pinnedDatapoints = [createMockPinnedDatapoint('dp-1')];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} />);

      expect(screen.queryByLabelText('Unpin datapoint')).not.toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('has copy buttons for each value', () => {
      const pinnedDatapoints = [createMockPinnedDatapoint('dp-1')];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} />);

      expect(screen.getByLabelText('Copy X Axis')).toBeInTheDocument();
      expect(screen.getByLabelText('Copy Y Axis')).toBeInTheDocument();
    });

    it('has copy button for group when present', () => {
      const pinnedDatapoints = [createMockGroupedPinnedDatapoint('dp-1')];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} />);

      expect(screen.getByLabelText('Copy Category')).toBeInTheDocument();
    });
  });

  describe('highlight callbacks', () => {
    it('calls onHighlight with datapoint type on hover', () => {
      const onHighlight = vi.fn();
      const pinnedDatapoints = [createMockPinnedDatapoint('dp-123')];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} onHighlight={onHighlight} />);

      const cardElement = screen.getByText('Pinned Datapoint').parentElement?.parentElement;
      fireEvent.mouseEnter(cardElement!);

      expect(onHighlight).toHaveBeenCalledWith({
        type: 'datapoint',
        datapointId: 'dp-123',
      });
    });

    it('calls onHighlight with none type on mouse leave', () => {
      const onHighlight = vi.fn();
      const pinnedDatapoints = [createMockPinnedDatapoint('dp-123')];

      render(<DrawerPinnedSection pinnedDatapoints={pinnedDatapoints} onHighlight={onHighlight} />);

      const cardElement = screen.getByText('Pinned Datapoint').parentElement?.parentElement;
      fireEvent.mouseEnter(cardElement!);
      fireEvent.mouseLeave(cardElement!);

      expect(onHighlight).toHaveBeenLastCalledWith({ type: 'none' });
    });
  });
});

// =============================================================================
// DrawerAxesSection Tests
// =============================================================================

describe('DrawerAxesSection', () => {
  describe('x-axis rendering', () => {
    it('renders x-axis field and label', () => {
      const axesInfo = createMockAxesInfo({
        x: { field: 'table1.timestamp', label: 'Time' },
      });

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.getByText('X:')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
    });

    it('falls back to field name when label is undefined', () => {
      const axesInfo: PlotAxesInfo = {
        x: { field: 'table1.timestamp' },
      };

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.getByText('table1.timestamp')).toBeInTheDocument();
    });

    it('shows scale badge for non-linear scales', () => {
      const axesInfo: PlotAxesInfo = {
        x: { field: 'table1.x', label: 'X', scale: 'log' },
      };

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.getByText('log')).toBeInTheDocument();
    });

    it('does not show scale badge for linear scale', () => {
      const axesInfo: PlotAxesInfo = {
        x: { field: 'table1.x', label: 'X', scale: 'linear' },
      };

      const { container } = render(<DrawerAxesSection axesInfo={axesInfo} />);

      const badges = container.querySelectorAll('.bg-muted.rounded');
      expect(badges).toHaveLength(0);
    });
  });

  describe('y-axis rendering', () => {
    it('renders y-axis field, label, and metric', () => {
      const axesInfo = createMockAxesInfo({
        y: { field: 'table1.value', label: 'Value', metric: 'sum' },
      });

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.getByText('Y:')).toBeInTheDocument();
      expect(screen.getByText('Value (sum)')).toBeInTheDocument();
    });

    it('does not render y-axis section when y is undefined', () => {
      const axesInfo: PlotAxesInfo = {
        x: { field: 'table1.x', label: 'X' },
        y: undefined,
      };

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.queryByText('Y:')).not.toBeInTheDocument();
    });

    it('shows y-axis without metric when metric is undefined', () => {
      const axesInfo: PlotAxesInfo = {
        x: { field: 'table1.x' },
        y: { field: 'table1.y', label: 'Y Value' },
      };

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.getByText('Y Value')).toBeInTheDocument();
      expect(screen.queryByText('()')).not.toBeInTheDocument();
    });
  });

  describe('groupBy rendering', () => {
    it('renders groupBy field when present', () => {
      const axesInfo = createMockAxesInfo({
        groupBy: { field: 'table1.category', label: 'Category' },
      });

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.getByText('Group:')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('does not render groupBy section when undefined', () => {
      const axesInfo: PlotAxesInfo = {
        x: { field: 'table1.x' },
        groupBy: undefined,
      };

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.queryByText('Group:')).not.toBeInTheDocument();
    });

    it('falls back to field name when groupBy label is undefined', () => {
      const axesInfo: PlotAxesInfo = {
        x: { field: 'table1.x' },
        groupBy: { field: 'table1.type' },
      };

      render(<DrawerAxesSection axesInfo={axesInfo} />);

      expect(screen.getByText('table1.type')).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('renders "Axes" header', () => {
      render(<DrawerAxesSection axesInfo={createMockAxesInfo()} />);

      expect(screen.getByText('Axes')).toBeInTheDocument();
    });
  });
});
