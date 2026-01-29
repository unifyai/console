/**
 * Unit tests for SpendingLimitDialog component.
 *
 * Tests cover:
 * - Dialog visibility
 * - Limit input validation
 * - Unlimited toggle
 * - Save action
 * - Error handling
 * - Warning for limit below current spend
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpendingLimitDialog } from '@/components/Pages/Assistants/Assistants/Profile/SpendingLimitDialog';

describe('SpendingLimitDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentLimit: 100,
    currentSpend: 50,
    onSave: vi.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Dialog Visibility
  // ===========================================================================

  describe('dialog visibility', () => {
    it('renders when open is true', () => {
      render(<SpendingLimitDialog {...defaultProps} open={true} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when open is false', () => {
      render(<SpendingLimitDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('initial state', () => {
    it('shows current spend in context', () => {
      render(<SpendingLimitDialog {...defaultProps} currentSpend={75} />);

      expect(screen.getByText(/\$75\.00/)).toBeInTheDocument();
    });

    it('pre-fills limit value from currentLimit', () => {
      render(<SpendingLimitDialog {...defaultProps} currentLimit={200} />);

      const input = screen.getByLabelText(/monthly limit/i);
      expect(input).toHaveValue(200);
    });

    it('shows unlimited toggle when currentLimit is null', () => {
      render(<SpendingLimitDialog {...defaultProps} currentLimit={null} />);

      // When unlimited, the input field should not be visible
      expect(screen.queryByLabelText(/monthly limit/i)).not.toBeInTheDocument();
      // The unlimited button should be active (have primary styling)
      const unlimitedButton = screen.getByRole('button', { name: /unlimited/i });
      expect(unlimitedButton).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Limit Type Toggle
  // ===========================================================================

  describe('limit type toggle', () => {
    it('shows limit input when Set Limit is selected', async () => {
      const user = userEvent.setup();

      render(<SpendingLimitDialog {...defaultProps} currentLimit={null} />);

      await user.click(screen.getByRole('button', { name: /set limit/i }));

      expect(screen.getByLabelText(/monthly limit/i)).toBeInTheDocument();
    });

    it('hides limit input when Unlimited is selected', async () => {
      const user = userEvent.setup();

      render(<SpendingLimitDialog {...defaultProps} currentLimit={100} />);

      await user.click(screen.getByRole('button', { name: /unlimited/i }));

      expect(screen.queryByLabelText(/monthly limit/i)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Input Validation
  // ===========================================================================

  describe('input validation', () => {
    it('allows decimal values', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue({ success: true });

      render(<SpendingLimitDialog {...defaultProps} onSave={onSave} />);

      const input = screen.getByLabelText(/monthly limit/i);
      await user.clear(input);
      await user.type(input, '99.99');
      await user.click(screen.getByRole('button', { name: /save limit/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(99.99);
      });
    });

    it('accepts zero as a valid limit', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue({ success: true });

      render(<SpendingLimitDialog {...defaultProps} onSave={onSave} />);

      const input = screen.getByLabelText(/monthly limit/i);
      await user.clear(input);
      await user.type(input, '0');
      await user.click(screen.getByRole('button', { name: /save limit/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(0);
      });
    });

    it('disables save button when input is empty and Set Limit is selected', async () => {
      const user = userEvent.setup();
      // Start with unlimited (no limit)
      render(<SpendingLimitDialog {...defaultProps} currentLimit={null} />);

      // Click Set Limit to switch to limit mode with empty input
      await user.click(screen.getByRole('button', { name: /set limit/i }));

      const saveButton = screen.getByRole('button', { name: /save limit/i });
      expect(saveButton).toBeDisabled();
    });
  });

  // ===========================================================================
  // Warning for Limit Below Current Spend
  // ===========================================================================

  describe('warning for limit below current spend', () => {
    it('shows warning when limit would be at or below current spend', async () => {
      const user = userEvent.setup();

      render(<SpendingLimitDialog {...defaultProps} currentSpend={80} currentLimit={100} />);

      const input = screen.getByLabelText(/monthly limit/i);
      await user.clear(input);
      await user.type(input, '50');

      expect(screen.getByText(/blocked immediately/i)).toBeInTheDocument();
    });

    it('does not show warning when limit is above current spend', async () => {
      const user = userEvent.setup();

      render(<SpendingLimitDialog {...defaultProps} currentSpend={50} currentLimit={100} />);

      const input = screen.getByLabelText(/monthly limit/i);
      await user.clear(input);
      await user.type(input, '150');

      expect(screen.queryByText(/blocked immediately/i)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Save Action
  // ===========================================================================

  describe('save action', () => {
    it('calls onSave with numeric limit', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue({ success: true });

      render(<SpendingLimitDialog {...defaultProps} onSave={onSave} currentLimit={100} />);

      const input = screen.getByLabelText(/monthly limit/i);
      await user.clear(input);
      await user.type(input, '200');
      await user.click(screen.getByRole('button', { name: /save limit/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(200);
      });
    });

    it('calls onSave with null for unlimited', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue({ success: true });

      render(<SpendingLimitDialog {...defaultProps} onSave={onSave} currentLimit={100} />);

      await user.click(screen.getByRole('button', { name: /unlimited/i }));
      await user.click(screen.getByRole('button', { name: /save limit/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(null);
      });
    });

    it('shows loading state during save', async () => {
      const user = userEvent.setup();
      // Create a promise that never resolves immediately
      const onSave = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
        );

      render(<SpendingLimitDialog {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /save limit/i }));

      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('shows generic error from onSave failure (backend errors are obfuscated)', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue({ success: false, error: 'Server error' });

      render(<SpendingLimitDialog {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /save limit/i }));

      await waitFor(() => {
        // Backend errors are obfuscated with a generic message
        expect(
          screen.getByText('Unable to update spending limit. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('shows generic error on exception (backend errors are obfuscated)', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockRejectedValue(new Error('Network failure'));

      render(<SpendingLimitDialog {...defaultProps} onSave={onSave} />);

      await user.click(screen.getByRole('button', { name: /save limit/i }));

      await waitFor(() => {
        // Exceptions are obfuscated with a generic message
        expect(
          screen.getByText('Unable to update spending limit. Please try again.')
        ).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Cancel Action
  // ===========================================================================

  describe('cancel action', () => {
    it('calls onOpenChange(false) when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(<SpendingLimitDialog {...defaultProps} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
