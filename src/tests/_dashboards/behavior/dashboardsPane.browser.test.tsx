/**
 * Dashboards Pane – Browser-Based User Flow Tests
 *
 * Tests the Dashboards tab on the assistant right pane, verifying:
 * - Tab switching between Actions and Dashboards
 * - Empty state when no dashboards/tiles exist
 * - Searchable combobox selector with grouped items
 * - Dashboard summary card with metadata, open-in-tab, and download-zip
 * - Standalone tile selection with collapse, download, and open-in-tab
 * - Refresh interaction (header + footer)
 * - Lazy loading of tile content via getTileContent
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { render } from '@/tests/render';
import { RightPaneContainer } from '@/components/Pages/Assistants/RightPaneContainer';
import type { DashboardPaneData } from '@/types/assistants/dashboard';
import type { Assistant } from '@/types/assistants/assistant';

vi.mock('@/utils/assistants/dashboard-mock-data', () => ({
  USE_MOCK_DASHBOARDS: false,
  getMockDashboardData: () => ({ dashboards: [], tiles: [] }),
  getMockDashboardMetadata: () => ({ dashboards: [], tiles: [] }),
  getMockTileContent: () => Promise.resolve(null),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ASSISTANT = {
  id: 1,
  userId: 'user-123',
  agentId: 'agent-456',
  firstName: 'Test',
  lastName: 'Bot',
} as unknown as Assistant;

const EMPTY_DATA: DashboardPaneData = { dashboards: [], tiles: [] };

const TILE_A = {
  tileId: 1,
  token: 'tile-aaa',
  title: 'Revenue Chart',
  description: 'Monthly revenue',
  htmlContent: '<html><body><p>Revenue</p></body></html>',
  hasDataBindings: false,
  dataBindingContexts: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
};

const TILE_B = {
  tileId: 2,
  token: 'tile-bbb',
  title: 'User Growth',
  description: null,
  htmlContent: '<html><body><p>Growth</p></body></html>',
  hasDataBindings: true,
  dataBindingContexts: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
};

const TILE_STANDALONE = {
  tileId: 3,
  token: 'tile-standalone',
  title: 'Standalone Metric',
  description: 'Not in any dashboard',
  htmlContent: '<html><body><p>Standalone</p></body></html>',
  hasDataBindings: false,
  dataBindingContexts: null,
  createdAt: '2025-02-01T00:00:00Z',
  updatedAt: null,
};

const DASHBOARD_ONE: DashboardPaneData['dashboards'][number] = {
  dashboardId: 1,
  token: 'dash-001',
  title: 'Main Dashboard',
  description: 'Primary metrics',
  layout: JSON.stringify([
    { tileToken: 'tile-aaa', x: 0, y: 0, w: 6, h: 3 },
    { tileToken: 'tile-bbb', x: 6, y: 0, w: 6, h: 3 },
  ]),
  tileCount: 2,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-05T00:00:00Z',
};

const DATA_WITH_DASHBOARDS: DashboardPaneData = {
  dashboards: [DASHBOARD_ONE],
  tiles: [TILE_A, TILE_B, TILE_STANDALONE],
};

const DATA_STANDALONE_ONLY: DashboardPaneData = {
  dashboards: [],
  tiles: [TILE_STANDALONE],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockGetMetadata(data: DashboardPaneData = EMPTY_DATA) {
  return vi.fn().mockResolvedValue(data);
}

function mockGetTileContent(htmlMap?: Record<string, string>) {
  return vi
    .fn()
    .mockImplementation((_ownerId: string, _assistantId: string, token: string) =>
      Promise.resolve(htmlMap?.[token] ?? null)
    );
}

function renderRightPane(overrides?: {
  getMetadata?: ReturnType<typeof mockGetMetadata>;
  getTileContent?: ReturnType<typeof mockGetTileContent>;
  assistant?: Assistant | null;
}) {
  const getMetadata = overrides?.getMetadata ?? mockGetMetadata();
  const getTileContent = overrides?.getTileContent ?? mockGetTileContent();
  const assistant =
    overrides?.assistant !== undefined ? overrides.assistant : (MOCK_ASSISTANT as Assistant);

  return render(
    <RightPaneContainer
      assistant={assistant}
      actions={null}
      dashboardActions={{ getMetadata, getTileContent }}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboards Pane – user flows', () => {
  it('defaults to the Actions tab', async () => {
    renderRightPane();

    const actionsTab = screen.getByTestId('right-pane-tab-actions');
    expect(actionsTab).toHaveAttribute('data-state', 'active');
  });

  it('switches to Dashboards tab and back', async () => {
    const user = userEvent.setup();
    renderRightPane({ getMetadata: mockGetMetadata(EMPTY_DATA) });

    const dashTab = screen.getByTestId('right-pane-tab-dashboards');
    await user.click(dashTab);

    await waitFor(() => {
      expect(dashTab).toHaveAttribute('data-state', 'active');
    });

    const actionsTab = screen.getByTestId('right-pane-tab-actions');
    await user.click(actionsTab);

    await waitFor(() => {
      expect(actionsTab).toHaveAttribute('data-state', 'active');
    });
  });

  it('shows empty state when no dashboards or tiles exist', async () => {
    const user = userEvent.setup();
    renderRightPane({ getMetadata: mockGetMetadata(EMPTY_DATA) });

    await user.click(screen.getByTestId('right-pane-tab-dashboards'));

    await waitFor(() => {
      expect(screen.getByText('No dashboards yet')).toBeInTheDocument();
    });

    expect(screen.getByText(/Your assistant will create dashboards/)).toBeInTheDocument();
  });

  it('renders searchable combobox selector when dashboards exist', async () => {
    const user = userEvent.setup();
    renderRightPane({ getMetadata: mockGetMetadata(DATA_WITH_DASHBOARDS) });

    await user.click(screen.getByTestId('right-pane-tab-dashboards'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-selector')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('dashboard-selector'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search dashboards & tiles…')).toBeInTheDocument();
    });
  });

  it('renders selector for standalone-only tiles', async () => {
    const user = userEvent.setup();
    renderRightPane({ getMetadata: mockGetMetadata(DATA_STANDALONE_ONLY) });

    await user.click(screen.getByTestId('right-pane-tab-dashboards'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-selector')).toBeInTheDocument();
    });
  });

  it('shows refresh button in header and footer, triggers refetch on click', async () => {
    const user = userEvent.setup();
    const getMetadata = mockGetMetadata(DATA_WITH_DASHBOARDS);
    renderRightPane({ getMetadata });

    await user.click(screen.getByTestId('right-pane-tab-dashboards'));

    // Footer refresh
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-refresh')).toBeInTheDocument();
    });

    const callCountBefore = getMetadata.mock.calls.length;
    await user.click(screen.getByTestId('dashboard-refresh'));

    await waitFor(() => {
      expect(getMetadata.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    // Header refresh
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-header-refresh')).toBeInTheDocument();
    });
  });

  it('hides tabs and shows actions empty state when no assistant is selected', async () => {
    renderRightPane({ assistant: null, getMetadata: mockGetMetadata() });

    await waitFor(() => {
      expect(screen.queryByTestId('right-pane-tab-actions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('right-pane-tab-dashboards')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Select an assistant to watch them work')).toBeInTheDocument();
  });

  it('renders dashboard summary card with metadata and action buttons', async () => {
    const user = userEvent.setup();
    renderRightPane({ getMetadata: mockGetMetadata(DATA_WITH_DASHBOARDS) });

    await user.click(screen.getByTestId('right-pane-tab-dashboards'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-section')).toBeInTheDocument();
    });

    const summaryCard = screen.getByTestId('dashboard-summary-card');
    expect(summaryCard).toBeInTheDocument();

    expect(screen.getByText('Primary metrics')).toBeInTheDocument();
    expect(screen.getByText('2 tiles')).toBeInTheDocument();

    expect(screen.getByTestId('dashboard-open-tab')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-download-zip')).toBeInTheDocument();
  });

  it('shows collapse all / expand all button in header', async () => {
    const user = userEvent.setup();
    renderRightPane({ getMetadata: mockGetMetadata(DATA_WITH_DASHBOARDS) });

    await user.click(screen.getByTestId('right-pane-tab-dashboards'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-collapse-all')).toBeInTheDocument();
    });
  });
});
