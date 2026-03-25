/**
 * Unit tests for SpendingProgressBar component.
 *
 * Tests cover:
 * - Normal spending display
 * - Near limit warning state
 * - Over limit error state
 * - Unlimited state
 * - Accessibility attributes
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpendingProgressBar } from '@/components/Pages/Assistants/Profile/SpendingProgressBar';
import { SpendingDisplayProps } from '@/types/assistants/spending';

describe('SpendingProgressBar', () => {
  const baseDisplay: SpendingDisplayProps = {
    currentSpend: 50,
    limit: 100,
    percentUsed: 50,
    isOverLimit: false,
    isNearLimit: false,
    isUnlimited: false,
  };

  // ===========================================================================
  // Basic Rendering
  // ===========================================================================

  describe('basic rendering', () => {
    it('renders current spend amount', () => {
      render(<SpendingProgressBar display={baseDisplay} />);

      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });

    it('renders limit amount', () => {
      render(<SpendingProgressBar display={baseDisplay} />);

      expect(screen.getByText(/of \$100\.00/)).toBeInTheDocument();
    });

    it('renders percentage', () => {
      render(<SpendingProgressBar display={baseDisplay} />);

      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('renders progress bar with correct role', () => {
      render(<SpendingProgressBar display={baseDisplay} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('has correct aria attributes', () => {
      render(<SpendingProgressBar display={baseDisplay} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  // ===========================================================================
  // Spending States
  // ===========================================================================

  describe('spending states', () => {
    it('shows normal state for low spending', () => {
      const display: SpendingDisplayProps = {
        ...baseDisplay,
        percentUsed: 30,
        currentSpend: 30,
      };

      render(<SpendingProgressBar display={display} />);

      expect(screen.getByText('$30.00')).toBeInTheDocument();
      expect(screen.queryByText(/Over limit/)).not.toBeInTheDocument();
    });

    it('shows near limit state', () => {
      const display: SpendingDisplayProps = {
        ...baseDisplay,
        percentUsed: 85,
        currentSpend: 85,
        isNearLimit: true,
      };

      render(<SpendingProgressBar display={display} />);

      expect(screen.getByText('$85.00')).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });

    it('shows over limit state with amount exceeded', () => {
      const display: SpendingDisplayProps = {
        ...baseDisplay,
        percentUsed: 120,
        currentSpend: 120,
        isOverLimit: true,
      };

      render(<SpendingProgressBar display={display} />);

      expect(screen.getByText('$120.00')).toBeInTheDocument();
      expect(screen.getByText(/Over limit by \$20\.00/)).toBeInTheDocument();
    });

    it('shows unlimited state without progress bar', () => {
      const display: SpendingDisplayProps = {
        currentSpend: 500,
        limit: null,
        percentUsed: 0,
        isOverLimit: false,
        isNearLimit: false,
        isUnlimited: true,
      };

      render(<SpendingProgressBar display={display} />);

      expect(screen.getByText('$500.00')).toBeInTheDocument();
      expect(screen.getByText('No limit')).toBeInTheDocument();
      // Progress bar is hidden when no limit is set
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Label Visibility
  // ===========================================================================

  describe('label visibility', () => {
    it('shows labels by default', () => {
      render(<SpendingProgressBar display={baseDisplay} />);

      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByText(/of \$100\.00/)).toBeInTheDocument();
    });

    it('hides labels when showLabels is false', () => {
      render(<SpendingProgressBar display={baseDisplay} showLabels={false} />);

      expect(screen.queryByText('$50.00')).not.toBeInTheDocument();
      expect(screen.queryByText(/of \$100\.00/)).not.toBeInTheDocument();

      // Progress bar should still be present
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Size Variants
  // ===========================================================================

  describe('size variants', () => {
    it('renders with default size', () => {
      const { container } = render(<SpendingProgressBar display={baseDisplay} />);

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveClass('h-2');
    });

    it('renders with small size', () => {
      const { container } = render(<SpendingProgressBar display={baseDisplay} size="sm" />);

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveClass('h-1.5');
    });

    it('renders with large size', () => {
      const { container } = render(<SpendingProgressBar display={baseDisplay} size="lg" />);

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveClass('h-3');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles zero spend', () => {
      const display: SpendingDisplayProps = {
        ...baseDisplay,
        currentSpend: 0,
        percentUsed: 0,
      };

      render(<SpendingProgressBar display={display} />);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText(/0%/)).toBeInTheDocument();
    });

    it('handles exactly at limit', () => {
      const display: SpendingDisplayProps = {
        ...baseDisplay,
        currentSpend: 100,
        percentUsed: 100,
        isOverLimit: true,
      };

      render(<SpendingProgressBar display={display} />);

      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.getByText(/Over limit by \$0\.00/)).toBeInTheDocument();
    });

    it('handles very large numbers', () => {
      const display: SpendingDisplayProps = {
        currentSpend: 99999.99,
        limit: 100000,
        percentUsed: 99.99999,
        isOverLimit: false,
        isNearLimit: true,
        isUnlimited: false,
      };

      render(<SpendingProgressBar display={display} />);

      expect(screen.getByText('$99999.99')).toBeInTheDocument();
      expect(screen.getByText(/of \$100000\.00/)).toBeInTheDocument();
    });

    it('handles decimal amounts', () => {
      const display: SpendingDisplayProps = {
        ...baseDisplay,
        currentSpend: 33.33,
        limit: 100,
        percentUsed: 33.33,
      };

      render(<SpendingProgressBar display={display} />);

      expect(screen.getByText('$33.33')).toBeInTheDocument();
      expect(screen.getByText(/33%/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Custom className
  // ===========================================================================

  describe('custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <SpendingProgressBar display={baseDisplay} className="my-custom-class" />
      );

      expect(container.firstChild).toHaveClass('my-custom-class');
    });
  });
});
