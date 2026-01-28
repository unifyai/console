/**
 * Unit tests for AssistantSpendingSection component.
 *
 * Tests cover:
 * - Loading state
 * - Error state with retry
 * - Normal display with spending data
 * - Edit button visibility based on canEdit prop
 * - Month formatting
 * - View Usage link with assistant filter
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantSpendingSection } from '@/components/Pages/Assistants/Assistants/Profile/AssistantSpendingSection';
import { SpendingDisplayProps } from '@/types/assistants/spending';

describe('AssistantSpendingSection', () => {
  const mockDisplay: SpendingDisplayProps = {
    currentSpend: 50,
    limit: 100,
    percentUsed: 50,
    isOverLimit: false,
    isNearLimit: false,
    isUnlimited: false,
  };

  const defaultProps = {
    assistantId: 'asst_test_123',
    display: mockDisplay,
    currentLimit: 100,
    currentMonth: '2026-01',
    isLoading: false,
    error: null,
    onUpdateLimit: vi.fn().mockResolvedValue({ success: true }),
    onRefresh: vi.fn(),
    canEdit: true,
  };

  // ===========================================================================
  // Loading State
  // ===========================================================================

  describe('loading state', () => {
    it('shows skeleton when loading', () => {
      render(<AssistantSpendingSection {...defaultProps} isLoading={true} display={null} />);

      // Should show the title
      expect(screen.getByText('Monthly Spending')).toBeInTheDocument();

      // Should have skeleton elements (no progress bar)
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Error State
  // ===========================================================================

  describe('error state', () => {
    it('shows error message', () => {
      render(<AssistantSpendingSection {...defaultProps} error="Failed to load" display={null} />);

      expect(screen.getByText('Failed to load spending data')).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      render(<AssistantSpendingSection {...defaultProps} error="Failed to load" display={null} />);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('calls onRefresh when retry is clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();

      render(
        <AssistantSpendingSection
          {...defaultProps}
          error="Failed to load"
          display={null}
          onRefresh={onRefresh}
        />
      );

      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Normal Display
  // ===========================================================================

  describe('normal display', () => {
    it('shows spending data', () => {
      render(<AssistantSpendingSection {...defaultProps} />);

      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('formats month correctly', () => {
      render(<AssistantSpendingSection {...defaultProps} currentMonth="2026-01" />);

      expect(screen.getByText('January 2026')).toBeInTheDocument();
    });

    it('shows limit info when limit is set', () => {
      render(<AssistantSpendingSection {...defaultProps} />);

      // SpendingProgressBar shows "of $100.00"
      expect(screen.getByText(/of \$100\.00/)).toBeInTheDocument();
    });

    it('shows no limit message when unlimited', () => {
      const unlimitedDisplay: SpendingDisplayProps = {
        ...mockDisplay,
        limit: null,
        isUnlimited: true,
      };

      render(
        <AssistantSpendingSection
          {...defaultProps}
          display={unlimitedDisplay}
          currentLimit={null}
        />
      );

      // SpendingProgressBar shows "No limit" for unlimited
      expect(screen.getByText('No limit')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Edit Button
  // ===========================================================================

  describe('edit button', () => {
    it('shows edit button when canEdit is true', () => {
      render(<AssistantSpendingSection {...defaultProps} canEdit={true} />);

      expect(screen.getByRole('button', { name: /edit limit/i })).toBeInTheDocument();
    });

    it('hides edit button when canEdit is false', () => {
      render(<AssistantSpendingSection {...defaultProps} canEdit={false} />);

      expect(screen.queryByRole('button', { name: /edit limit/i })).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Refreshing Indicator
  // ===========================================================================

  describe('refreshing indicator', () => {
    it('shows loading indicator when refreshing', () => {
      const { container } = render(
        <AssistantSpendingSection {...defaultProps} isRefreshing={true} />
      );

      // Should have a spinning loader
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('does not show loading indicator when not refreshing', () => {
      const { container } = render(
        <AssistantSpendingSection {...defaultProps} isRefreshing={false} />
      );

      expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Month Formatting
  // ===========================================================================

  describe('month formatting', () => {
    const testCases = [
      { input: '2026-01', expected: 'January 2026' },
      { input: '2026-06', expected: 'June 2026' },
      { input: '2026-12', expected: 'December 2026' },
      { input: '2025-03', expected: 'March 2025' },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`formats ${input} as "${expected}"`, () => {
        render(<AssistantSpendingSection {...defaultProps} currentMonth={input} />);

        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // No Data State
  // ===========================================================================

  describe('no data state', () => {
    it('shows no data message when display is null and not loading/error', () => {
      render(
        <AssistantSpendingSection {...defaultProps} display={null} isLoading={false} error={null} />
      );

      expect(screen.getByText('No spending data available')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // View Usage Link
  // ===========================================================================

  describe('view usage link', () => {
    it('renders View Usage link with correct assistant filter', () => {
      render(<AssistantSpendingSection {...defaultProps} />);

      const viewUsageLink = screen.getByRole('link', { name: /view usage/i });
      expect(viewUsageLink).toBeInTheDocument();
      expect(viewUsageLink).toHaveAttribute('href', '/usage?assistant=asst_test_123');
    });

    it('encodes special characters in assistant ID', () => {
      render(<AssistantSpendingSection {...defaultProps} assistantId="asst/special&id" />);

      const viewUsageLink = screen.getByRole('link', { name: /view usage/i });
      expect(viewUsageLink).toHaveAttribute(
        'href',
        `/usage?assistant=${encodeURIComponent('asst/special&id')}`
      );
    });

    it('shows View Usage link even when canEdit is false', () => {
      render(<AssistantSpendingSection {...defaultProps} canEdit={false} />);

      const viewUsageLink = screen.getByRole('link', { name: /view usage/i });
      expect(viewUsageLink).toBeInTheDocument();
    });
  });
});
