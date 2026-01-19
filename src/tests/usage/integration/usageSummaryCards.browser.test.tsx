/**
 * UsageSummaryCards Integration Tests
 *
 * Browser tests for the summary cards component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/tests/render';
import { UsageSummaryCards } from '@/components/Pages/Usage/UsageSummaryCards';
import { UsageSummary, EMPTY_SUMMARY } from '@/types/usage';

describe('UsageSummaryCards', () => {
  const sampleSummary: UsageSummary = {
    total: 125.5,
    average: 4.18,
    peak: 15.0,
    peakTimestamp: '2026-01-15',
  };

  describe('rendering', () => {
    it('renders all three summary cards', async () => {
      render(<UsageSummaryCards summary={sampleSummary} />);

      expect(screen.getByTestId('usage-summary-cards')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-total')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-average')).toBeInTheDocument();
      expect(screen.getByTestId('summary-card-peak')).toBeInTheDocument();
    });

    it('displays correct card titles', async () => {
      render(<UsageSummaryCards summary={sampleSummary} />);

      expect(screen.getByText('Total Cost')).toBeInTheDocument();
      expect(screen.getByText('Average per Period')).toBeInTheDocument();
      expect(screen.getByText('Peak Usage')).toBeInTheDocument();
    });

    it('displays info icon next to Total Cost', async () => {
      render(<UsageSummaryCards summary={sampleSummary} />);

      // The info icon should be present as a button with accessible label
      const infoButton = screen.getByRole('button', { name: /more information/i });
      expect(infoButton).toBeInTheDocument();

      // It should be within the Total Cost card
      const totalCard = screen.getByTestId('summary-card-total');
      expect(totalCard).toContainElement(infoButton);
    });

    it('displays formatted total cost', async () => {
      render(<UsageSummaryCards summary={sampleSummary} />);

      expect(screen.getByText('$125.50')).toBeInTheDocument();
    });

    it('displays formatted average cost', async () => {
      render(<UsageSummaryCards summary={sampleSummary} />);

      expect(screen.getByText('$4.18')).toBeInTheDocument();
    });

    it('displays formatted peak cost', async () => {
      render(<UsageSummaryCards summary={sampleSummary} />);

      expect(screen.getByText('$15.00')).toBeInTheDocument();
    });

    it('displays peak timestamp subtitle', async () => {
      render(<UsageSummaryCards summary={sampleSummary} granularity="time_day" />);

      expect(screen.getByText('Peak on Jan 15')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton when isLoading is true', async () => {
      render(<UsageSummaryCards summary={sampleSummary} isLoading={true} />);

      // Should not show the values when loading
      expect(screen.queryByText('$125.50')).not.toBeInTheDocument();
    });

    it('shows values when not loading', async () => {
      render(<UsageSummaryCards summary={sampleSummary} isLoading={false} />);

      expect(screen.getByText('$125.50')).toBeInTheDocument();
    });
  });

  describe('empty data', () => {
    it('handles empty summary', async () => {
      render(<UsageSummaryCards summary={EMPTY_SUMMARY} />);

      // All three cards should show $0.00
      expect(screen.getAllByText('$0.00')).toHaveLength(3);
    });

    it('does not show peak subtitle when no peak timestamp', async () => {
      render(<UsageSummaryCards summary={EMPTY_SUMMARY} />);

      expect(screen.queryByText(/Peak on/)).not.toBeInTheDocument();
    });
  });

  describe('formatting', () => {
    it('formats large values with compact notation', async () => {
      const largeSummary: UsageSummary = {
        total: 15000,
        average: 500,
        peak: 2500,
        peakTimestamp: '2026-01-15',
      };

      render(<UsageSummaryCards summary={largeSummary} />);

      expect(screen.getByText('$15.0K')).toBeInTheDocument();
    });

    it('formats small values with extra precision', async () => {
      const smallSummary: UsageSummary = {
        total: 0.0012,
        average: 0.0004,
        peak: 0.0006,
        peakTimestamp: '2026-01-15',
      };

      render(<UsageSummaryCards summary={smallSummary} />);

      expect(screen.getByText('$0.0012')).toBeInTheDocument();
    });

    it('formats peak timestamp with hourly granularity', async () => {
      const hourlySummary: UsageSummary = {
        total: 100,
        average: 10,
        peak: 25,
        peakTimestamp: '2026-01-15T14:00:00+00:00',
      };

      render(<UsageSummaryCards summary={hourlySummary} granularity="time_hour" />);

      expect(screen.getByText('Peak on Jan 15, 14:00')).toBeInTheDocument();
    });

    it('formats peak timestamp with monthly granularity', async () => {
      const monthlySummary: UsageSummary = {
        total: 1000,
        average: 500,
        peak: 750,
        peakTimestamp: '2026-01-01',
      };

      render(<UsageSummaryCards summary={monthlySummary} granularity="time_month" />);

      expect(screen.getByText('Peak on Jan 2026')).toBeInTheDocument();
    });
  });

  describe('responsiveness', () => {
    it('has grid layout for cards', async () => {
      render(<UsageSummaryCards summary={sampleSummary} />);

      const container = screen.getByTestId('usage-summary-cards');
      expect(container).toHaveClass('grid');
    });
  });
});
