/**
 * Unit tests for AssistantSpendingSection component.
 *
 * Tests cover:
 * - Loading state
 * - Error state with retry
 * - Normal display with spending data
 * - Clickable spend value (opens usage)
 * - Clickable limit value (opens edit dialog when canEdit)
 * - Info icon tooltip
 * - Month formatting
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  // Mock window.open for testing clickable spend value
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

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

    it('formats month correctly (inline with amount)', () => {
      render(<AssistantSpendingSection {...defaultProps} currentMonth="2026-01" />);

      // Month is now displayed inline: "in January"
      expect(screen.getByText(/in January/)).toBeInTheDocument();
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
  // Info Icon
  // ===========================================================================

  describe('info icon', () => {
    it('shows info icon next to header', () => {
      const { container } = render(<AssistantSpendingSection {...defaultProps} />);

      // Info icon should be present
      const infoIcon = container.querySelector('.lucide-info');
      expect(infoIcon).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Clickable Spend Value
  // ===========================================================================

  describe('clickable spend value', () => {
    it('opens usage page when spend value is clicked', async () => {
      const user = userEvent.setup();
      render(<AssistantSpendingSection {...defaultProps} />);

      // Find the spend value button
      const spendButton = screen.getByRole('button', { name: /\$50\.00/i });
      await user.click(spendButton);

      // Should open the usage page in a new tab
      expect(windowOpenSpy).toHaveBeenCalledWith(
        '/usage?assistant=asst_test_123',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('encodes special characters in assistant ID for usage URL', async () => {
      const user = userEvent.setup();
      render(<AssistantSpendingSection {...defaultProps} assistantId="asst/special&id" />);

      const spendButton = screen.getByRole('button', { name: /\$50\.00/i });
      await user.click(spendButton);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        `/usage?assistant=${encodeURIComponent('asst/special&id')}`,
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('spend value is clickable even when canEdit is false', async () => {
      const user = userEvent.setup();
      render(<AssistantSpendingSection {...defaultProps} canEdit={false} />);

      const spendButton = screen.getByRole('button', { name: /\$50\.00/i });
      await user.click(spendButton);

      expect(windowOpenSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Clickable Limit Value
  // ===========================================================================

  describe('clickable limit value', () => {
    it('limit value is clickable when canEdit is true', () => {
      render(<AssistantSpendingSection {...defaultProps} canEdit={true} />);

      // Limit value should have role="button"
      const limitButton = screen.getByRole('button', { name: /of \$100\.00/i });
      expect(limitButton).toBeInTheDocument();
    });

    it('limit value is NOT clickable when canEdit is false', () => {
      render(<AssistantSpendingSection {...defaultProps} canEdit={false} />);

      // Limit value should NOT have role="button" when canEdit is false
      const limitButton = screen.queryByRole('button', { name: /of \$100\.00/i });
      expect(limitButton).not.toBeInTheDocument();

      // But the text should still be visible
      expect(screen.getByText(/of \$100\.00/)).toBeInTheDocument();
    });

    it('"No limit" is clickable when canEdit is true and limit is unlimited', () => {
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

      const limitButton = screen.getByRole('button', { name: /no limit/i });
      expect(limitButton).toBeInTheDocument();
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
  // Month Formatting (Inline)
  // ===========================================================================

  describe('month formatting (inline with amount)', () => {
    const testCases = [
      { input: '2026-01', expected: 'January' },
      { input: '2026-06', expected: 'June' },
      { input: '2026-12', expected: 'December' },
      { input: '2025-03', expected: 'March' },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`formats ${input} as "in ${expected}"`, () => {
        render(<AssistantSpendingSection {...defaultProps} currentMonth={input} />);

        // Month is displayed inline: "in {Month}" (without year)
        expect(screen.getByText(new RegExp(`in ${expected}`))).toBeInTheDocument();
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
});
