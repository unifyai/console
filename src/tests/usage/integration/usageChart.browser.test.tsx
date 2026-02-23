/**
 * UsageChart Integration Tests
 *
 * Browser tests for the usage chart component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@/tests/render';
import { UsageChart } from '@/components/Pages/Usage/UsageChart';
import { UsageDataPoint } from '@/types/usage';
import { createMockUsageData } from '@/tests/usage/mocks/data';

describe('UsageChart', () => {
  const sampleData: UsageDataPoint[] = [
    { timestamp: '2026-01-13', billedCost: 1.25 },
    { timestamp: '2026-01-14', billedCost: 2.5 },
    { timestamp: '2026-01-15', billedCost: 0.75 },
    { timestamp: '2026-01-16', billedCost: 3.0 },
    { timestamp: '2026-01-17', billedCost: 1.5 },
  ];

  describe('rendering', () => {
    it('renders the chart container', async () => {
      render(<UsageChart data={sampleData} granularity="time_day" />);

      expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
    });

    it('does not show empty state when data is present', async () => {
      render(<UsageChart data={sampleData} granularity="time_day" />);

      expect(screen.queryByTestId('usage-chart-empty')).not.toBeInTheDocument();
    });

    it('does not show loading state when not loading', async () => {
      render(<UsageChart data={sampleData} granularity="time_day" isLoading={false} />);

      expect(screen.queryByTestId('usage-chart-loading')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when data is empty', async () => {
      render(<UsageChart data={[]} granularity="time_day" />);

      expect(screen.getByTestId('usage-chart-empty')).toBeInTheDocument();
    });

    it('displays empty message', async () => {
      render(<UsageChart data={[]} granularity="time_day" />);

      // The empty message comes from useUsageChartConfig
      expect(screen.getByText(/No usage data|No data available/i)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading state when isLoading is true', async () => {
      render(<UsageChart data={[]} granularity="time_day" isLoading={true} />);

      expect(screen.getByTestId('usage-chart-loading')).toBeInTheDocument();
    });

    it('shows loading message', async () => {
      render(<UsageChart data={[]} granularity="time_day" isLoading={true} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows loading state even when data is present', async () => {
      render(<UsageChart data={sampleData} granularity="time_day" isLoading={true} />);

      expect(screen.getByTestId('usage-chart-loading')).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('uses flexbox layout for dynamic height', async () => {
      render(<UsageChart data={sampleData} granularity="time_day" />);

      const chart = screen.getByTestId('usage-chart');
      // Chart uses h-full class to fill parent container
      expect(chart).toHaveClass('h-full');
    });

    it('has flex column layout when showing data', async () => {
      render(<UsageChart data={sampleData} granularity="time_day" />);

      const chart = screen.getByTestId('usage-chart');
      expect(chart).toHaveClass('flex-col');
    });
  });

  describe('with generated data', () => {
    it('renders with larger dataset', async () => {
      const largeData = createMockUsageData({
        count: 30,
        startDate: '2026-01-01',
        granularity: 'time_day',
        seed: 42,
      });

      render(<UsageChart data={largeData} granularity="time_day" />);

      expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('usage-chart-empty')).not.toBeInTheDocument();
    });

    it('renders hourly data', async () => {
      const hourlyData = createMockUsageData({
        count: 24,
        startDate: '2026-01-15',
        granularity: 'time_hour',
        seed: 42,
      });

      render(<UsageChart data={hourlyData} granularity="time_hour" />);

      expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
    });

    it('renders monthly data', async () => {
      const monthlyData = createMockUsageData({
        count: 12,
        startDate: '2025-01-01',
        granularity: 'time_month',
        seed: 42,
      });

      render(<UsageChart data={monthlyData} granularity="time_month" />);

      expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
    });
  });

  describe('PlotCanvas integration', () => {
    it('renders chart structure with data', async () => {
      render(<UsageChart data={sampleData} granularity="time_day" />);

      // Verify the chart container is rendered
      const chart = screen.getByTestId('usage-chart');
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveClass('rounded-lg');
    });
  });
});
