/**
 * PlotFooter Component Unit Tests
 *
 * Tests for the PlotFooter component which displays
 * group/pinned counts and toggles the details drawer.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlotFooter } from '@/components/Common/Plot/PlotFooter/PlotFooter';

// =============================================================================
// PlotFooter Tests
// =============================================================================

describe('PlotFooter', () => {
  // ===========================================================================
  // Group Count Display
  // ===========================================================================

  describe('group count display', () => {
    it('renders group count when groups > 0', () => {
      render(<PlotFooter groupCount={3} pinnedCount={0} isOpen={false} onToggle={() => {}} />);

      expect(screen.getByText('3 groups')).toBeInTheDocument();
    });

    it('uses singular "group" for count of 1', () => {
      render(<PlotFooter groupCount={1} pinnedCount={0} isOpen={false} onToggle={() => {}} />);

      expect(screen.getByText('1 group')).toBeInTheDocument();
    });

    it('does not render group section when groupCount is 0', () => {
      render(<PlotFooter groupCount={0} pinnedCount={2} isOpen={false} onToggle={() => {}} />);

      expect(screen.queryByText(/group/i)).not.toBeInTheDocument();
    });

    it('renders group indicator dot', () => {
      const { container } = render(
        <PlotFooter groupCount={2} pinnedCount={0} isOpen={false} onToggle={() => {}} />
      );

      const dot = container.querySelector('.rounded-full.bg-primary');
      expect(dot).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Pinned Count Display
  // ===========================================================================

  describe('pinned count display', () => {
    it('renders pinned count when pinnedCount > 0', () => {
      render(<PlotFooter groupCount={0} pinnedCount={5} isOpen={false} onToggle={() => {}} />);

      expect(screen.getByText('5 pinned')).toBeInTheDocument();
    });

    it('renders pin emoji for pinned items', () => {
      render(<PlotFooter groupCount={0} pinnedCount={1} isOpen={false} onToggle={() => {}} />);

      expect(screen.getByText('📌')).toBeInTheDocument();
    });

    it('does not render pinned section when pinnedCount is 0', () => {
      render(<PlotFooter groupCount={2} pinnedCount={0} isOpen={false} onToggle={() => {}} />);

      expect(screen.queryByText(/pinned/i)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // No Details State
  // ===========================================================================

  describe('no details state', () => {
    it('renders "No groups or pinned data" when both are 0', () => {
      render(<PlotFooter groupCount={0} pinnedCount={0} isOpen={false} onToggle={() => {}} />);

      expect(screen.getByText('No groups or pinned data')).toBeInTheDocument();
    });

    it('disables button when no details available', () => {
      render(<PlotFooter groupCount={0} pinnedCount={0} isOpen={false} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('does not show chevron when no details', () => {
      const { container } = render(
        <PlotFooter groupCount={0} pinnedCount={0} isOpen={false} onToggle={() => {}} />
      );

      // No ChevronUp or ChevronDown
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Chevron Icons
  // ===========================================================================

  describe('chevron icons', () => {
    it('shows ChevronUp when drawer is closed and has details', () => {
      const { container } = render(
        <PlotFooter groupCount={2} pinnedCount={0} isOpen={false} onToggle={() => {}} />
      );

      // ChevronUp has specific class - we check for svg presence and aria-hidden
      const svg = container.querySelector('svg[aria-hidden="true"]');
      expect(svg).toBeInTheDocument();
    });

    it('shows ChevronDown when drawer is open', () => {
      const { container } = render(
        <PlotFooter groupCount={2} pinnedCount={0} isOpen={true} onToggle={() => {}} />
      );

      const svg = container.querySelector('svg[aria-hidden="true"]');
      expect(svg).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Toggle Behavior
  // ===========================================================================

  describe('toggle behavior', () => {
    it('calls onToggle when clicked with details', () => {
      const onToggle = vi.fn();
      render(<PlotFooter groupCount={2} pinnedCount={0} isOpen={false} onToggle={onToggle} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('does not call onToggle when disabled (no details)', () => {
      const onToggle = vi.fn();
      render(<PlotFooter groupCount={0} pinnedCount={0} isOpen={false} onToggle={onToggle} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Accessibility
  // ===========================================================================

  describe('accessibility', () => {
    it('has correct aria-label when closed', () => {
      render(<PlotFooter groupCount={2} pinnedCount={0} isOpen={false} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Open plot details');
    });

    it('has correct aria-label when open', () => {
      render(<PlotFooter groupCount={2} pinnedCount={0} isOpen={true} onToggle={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Close plot details');
    });

    it('has aria-expanded attribute', () => {
      const { rerender } = render(
        <PlotFooter groupCount={2} pinnedCount={0} isOpen={false} onToggle={() => {}} />
      );

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');

      rerender(<PlotFooter groupCount={2} pinnedCount={0} isOpen={true} onToggle={() => {}} />);

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    });
  });

  // ===========================================================================
  // Combined States
  // ===========================================================================

  describe('combined states', () => {
    it('renders both groups and pinned counts', () => {
      render(<PlotFooter groupCount={3} pinnedCount={2} isOpen={false} onToggle={() => {}} />);

      expect(screen.getByText('3 groups')).toBeInTheDocument();
      expect(screen.getByText('2 pinned')).toBeInTheDocument();
    });

    it('button is enabled with only groups', () => {
      render(<PlotFooter groupCount={1} pinnedCount={0} isOpen={false} onToggle={() => {}} />);

      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    it('button is enabled with only pinned', () => {
      render(<PlotFooter groupCount={0} pinnedCount={1} isOpen={false} onToggle={() => {}} />);

      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });
});
