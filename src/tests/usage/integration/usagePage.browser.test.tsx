/**
 * UsagePage Integration Tests
 *
 * Browser tests for the main usage page container.
 * These tests verify component structure without requiring real API calls.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/render';
import { UsageMain } from '@/components/Pages/Usage/Main';
import {
  createMockAssistantList,
  createMockUsageActions,
  createMockOrgMemberList,
} from '@/tests/usage/mocks/data';

// Create mock org members for tests
const mockOrgMembers = createMockOrgMemberList(3).map((m) => ({
  userId: m.userId,
  name: m.name || 'Unknown',
  email: m.email,
}));

describe('UsageMain', () => {
  const defaultProps = {
    currentUserId: 'user_current',
    usageActions: createMockUsageActions(),
    assistants: createMockAssistantList(3),
    orgMembers: mockOrgMembers,
    isAdmin: false,
  };

  describe('rendering', () => {
    it('renders the page container', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('usage-page-main')).toBeInTheDocument();
    });

    it('renders filters bar', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('usage-filters-bar')).toBeInTheDocument();
    });

    it('renders summary cards', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('usage-summary-cards')).toBeInTheDocument();
    });

    it('renders chart', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
    });

    it('renders info tooltip icon next to Total Cost', async () => {
      render(<UsageMain {...defaultProps} />);

      // The info icon is now in the Total Cost summary card with "more information" aria label
      const infoButton = screen.getByRole('button', { name: /more information/i });
      expect(infoButton).toBeInTheDocument();

      // It should be within the Total Cost card
      const totalCard = screen.getByTestId('summary-card-total');
      expect(totalCard).toContainElement(infoButton);
    });
  });

  describe('admin features', () => {
    it('shows user scope filter for admins', async () => {
      render(<UsageMain {...defaultProps} isAdmin={true} />);

      expect(screen.getByTestId('user-scope-filter')).toBeInTheDocument();
    });

    it('hides user scope filter for non-admins', async () => {
      render(<UsageMain {...defaultProps} isAdmin={false} />);

      expect(screen.queryByTestId('user-scope-filter')).not.toBeInTheDocument();
    });
  });

  describe('filter components', () => {
    it('has assistant filter', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('assistant-filter')).toBeInTheDocument();
    });

    it('has granularity filter', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('granularity-filter')).toBeInTheDocument();
    });

    it('has timeframe filter', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('timeframe-filter')).toBeInTheDocument();
    });

    it('has refresh button on far right', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('summary cards', () => {
    it('renders all three summary cards', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByTestId('summary-card-total')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-average')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-peak')).toBeInTheDocument();
    });

    it('displays card titles', async () => {
      render(<UsageMain {...defaultProps} />);

      expect(screen.getByText('Total Cost')).toBeInTheDocument();
      expect(screen.getByText('Average per Period')).toBeInTheDocument();
      expect(screen.getByText('Peak Usage')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows generic error message when API fails', async () => {
      // Create actions that return an error
      const errorActions = {
        getMetrics: async () => ({
          detail: 'Internal server error: database connection failed',
        }),
      };

      render(<UsageMain {...defaultProps} usageActions={errorActions} />);

      // Wait for error to appear
      const alert = await screen.findByTestId('usage-error-alert');
      expect(alert).toBeInTheDocument();

      // Should show generic message, not the actual backend error
      expect(screen.getByText(/Unable to load usage data/)).toBeInTheDocument();
      expect(screen.queryByText(/database connection/)).not.toBeInTheDocument();
    });
  });
});
