/**
 * Unit tests for UserSpendingLimitSection component.
 *
 * Tests cover:
 * - Loading state
 * - Error state
 * - Displaying spend data
 * - Edit button visibility
 * - Dialog opening
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserSpendingLimitSection } from '@/components/Pages/Billing/UserSpendingLimitSection';
import { UserSpend, UserSpendingLimitResponse } from '@/types/user/spending';

// Mock ResizeObserver for radix components
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock data
const mockSpendData: UserSpend = {
  userId: 'user-123',
  month: '2026-01',
  cumulativeSpend: 75.0,
  limit: 200.0,
  percentUsed: 37.5,
};

const mockLimitData: UserSpendingLimitResponse = {
  userId: 'user-123',
  monthlySpendingCap: 200.0,
  assistantsCapped: 0,
};

describe('UserSpendingLimitSection', () => {
  const mockGetSpendAction = vi.fn();
  const mockGetLimitAction = vi.fn();
  const mockSetLimitAction = vi.fn();

  const defaultProps = {
    getSpendAction: mockGetSpendAction,
    getLimitAction: mockGetLimitAction,
    setLimitAction: mockSetLimitAction,
  };

  beforeEach(() => {
    mockGetSpendAction.mockReset().mockResolvedValue(mockSpendData);
    mockGetLimitAction.mockReset().mockResolvedValue(mockLimitData);
    mockSetLimitAction.mockReset().mockResolvedValue({
      ...mockLimitData,
      info: 'Updated',
    });
  });

  // ===========================================================================
  // Loading State
  // ===========================================================================

  describe('loading state', () => {
    it('shows loading indicator while fetching data', () => {
      // Make the action never resolve
      mockGetSpendAction.mockReturnValue(new Promise(() => {}));
      mockGetLimitAction.mockReturnValue(new Promise(() => {}));

      render(<UserSpendingLimitSection {...defaultProps} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows personal workspace title in header', () => {
      render(<UserSpendingLimitSection {...defaultProps} />);

      expect(screen.getByText(/personal spending limit/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Error State
  // ===========================================================================

  describe('error state', () => {
    it('displays error message when fetch fails', async () => {
      mockGetSpendAction.mockResolvedValue({ detail: 'User not found' });

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load spending data/i)).toBeInTheDocument();
        expect(screen.getByText(/user not found/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      mockGetSpendAction.mockResolvedValue({ detail: 'Error' });

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('retries fetch when retry button is clicked', async () => {
      const user = userEvent.setup();

      mockGetSpendAction.mockResolvedValueOnce({ detail: 'Error' });

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });

      // Reset to success for retry
      mockGetSpendAction.mockResolvedValue(mockSpendData);
      mockGetLimitAction.mockResolvedValue(mockLimitData);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(mockGetSpendAction).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ===========================================================================
  // Display Data
  // ===========================================================================

  describe('displaying spend data', () => {
    it('shows current spend amount', async () => {
      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('$75.00')).toBeInTheDocument();
      });
    });

    it('shows limit amount', async () => {
      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/of \$200\.00/i)).toBeInTheDocument();
      });
    });

    it('shows percentage used', async () => {
      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        // Percentage is shown in the format "(38%)" - rounded from 37.5
        expect(screen.getByText(/\(38%\)/i)).toBeInTheDocument();
      });
    });

    it('displays month name', async () => {
      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        // Should show current month in format like "January 2026"
        const monthElement = screen.getByText(/\w+ \d{4}/);
        expect(monthElement).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Edit Button Visibility
  // ===========================================================================

  describe('edit button visibility', () => {
    it('shows edit button when data is loaded', async () => {
      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit limit/i })).toBeInTheDocument();
      });
    });

    it('hides edit button during loading', () => {
      mockGetSpendAction.mockReturnValue(new Promise(() => {}));

      render(<UserSpendingLimitSection {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /edit limit/i })).not.toBeInTheDocument();
    });

    it('hides edit button on error', async () => {
      mockGetSpendAction.mockResolvedValue({ detail: 'Error' });

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /edit limit/i })).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Unlimited State
  // ===========================================================================

  describe('unlimited state', () => {
    it('shows "No limit" message when limit is null', async () => {
      mockGetSpendAction.mockResolvedValue({
        ...mockSpendData,
        limit: null,
        percentUsed: 0,
      });

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/no spending limit is set/i)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Warning States
  // ===========================================================================

  describe('warning states', () => {
    it('shows warning when near limit', async () => {
      mockGetSpendAction.mockResolvedValue({
        ...mockSpendData,
        cumulativeSpend: 168,
        percentUsed: 84,
      });

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/approaching your monthly personal spending limit/i)
        ).toBeInTheDocument();
      });
    });

    it('shows error when over limit', async () => {
      mockGetSpendAction.mockResolvedValue({
        ...mockSpendData,
        cumulativeSpend: 250,
        percentUsed: 125,
      });

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/exceeded your monthly personal spending limit/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Dialog Interaction
  // ===========================================================================

  describe('dialog interaction', () => {
    it('opens dialog when edit button is clicked', async () => {
      const user = userEvent.setup();

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit limit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit limit/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // Dialog contains "Set Limit" and "Unlimited" toggle buttons
        expect(screen.getByRole('button', { name: /^set limit$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /unlimited/i })).toBeInTheDocument();
      });
    });

    it('shows current spend in dialog', async () => {
      const user = userEvent.setup();

      render(<UserSpendingLimitSection {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit limit/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit limit/i }));

      await waitFor(() => {
        // The dialog should be open
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // Within the dialog, there's a section showing current spend
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent(/current spend this month/i);
      });
    });
  });
});
