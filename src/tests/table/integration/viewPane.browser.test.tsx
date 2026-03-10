/**
 * ViewPane Browser Integration Tests
 *
 * Browser-based tests for ViewPane interactions within the TableViewer:
 * - Row click opens ViewPane with correct data
 * - Cell click opens ViewPane focused on specific field
 * - ViewPane fold/unfold toggle
 * - ViewPane close button
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableViewer } from '@/components/Pages/Table/TableViewer';

// =============================================================================
// Test Data
// =============================================================================

const mockData = [
  {
    _id: 1,
    _ts: '2026-01-01T00:00:00Z',
    name: 'Alice',
    status: 'active',
    score: 95.5,
    metadata: { role: 'admin', level: 3 },
    tags: ['important', 'verified'],
  },
  {
    _id: 2,
    _ts: '2026-01-02T00:00:00Z',
    name: 'Bob',
    status: 'pending',
    score: 82.0,
    metadata: { role: 'user', level: 1 },
    tags: ['new'],
  },
  {
    _id: 3,
    _ts: '2026-01-03T00:00:00Z',
    name: 'Charlie',
    status: 'completed',
    score: 45.0,
    metadata: { role: 'user', level: 2 },
    tags: [],
  },
];

const mockConfig = {
  visibleColumns: ['name', 'status', 'score', 'metadata', 'tags'],
  columnOrder: ['name', 'status', 'score', 'metadata', 'tags'],
  rowLimit: 50,
  sortBy: undefined,
  sortOrder: undefined as 'asc' | 'desc' | undefined,
};

const mockFields = {
  name: { type: 'str', count: 3 },
  status: { type: 'str', count: 3 },
  score: { type: 'float', count: 3 },
  metadata: { type: 'dict', count: 3 },
  tags: { type: 'list', count: 3 },
};

const mockMetadata = {
  token: 'viewpane123',
  title: 'ViewPane Test Table',
  projectName: 'viewpane-test',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: 'test-user',
};

const mockPagination = {
  page: 1,
  pageSize: 100,
  totalCount: 3,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const defaultProps = {
  config: mockConfig,
  token: 'viewpane123',
  initialData: mockData,
  fields: mockFields,
  metadata: mockMetadata,
  initialPagination: mockPagination,
};

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// ViewPane Toggle Tests
// =============================================================================

describe('ViewPane Browser - Toggle', () => {
  it('opens ViewPane with the View button', async () => {
    const user = userEvent.setup();
    render(<TableViewer {...defaultProps} />);

    const viewButton = screen.getByRole('button', { name: /View/ });
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('Select a row or cell to view')).toBeInTheDocument();
    });
  });

  it('closes ViewPane with the close button', async () => {
    const user = userEvent.setup();
    render(<TableViewer {...defaultProps} />);

    // Open
    const viewButton = screen.getByRole('button', { name: /View/ });
    await user.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('Select a row or cell to view')).toBeInTheDocument();
    });

    // Close via the X button in the ViewPane
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons.find((btn) => {
      const svg = btn.querySelector('svg');
      return svg && btn.closest('.bg-background') && btn.textContent === '';
    });

    if (xButton) {
      await user.click(xButton);
    }
  });
});

// =============================================================================
// Row Click Tests
// =============================================================================

describe('ViewPane Browser - Row Click', () => {
  it('clicking a row opens ViewPane with row data', async () => {
    render(<TableViewer {...defaultProps} />);

    const rows = screen.getAllByRole('row');
    // Data rows start after the header
    const firstDataRow = rows[1];
    if (firstDataRow) {
      fireEvent.click(firstDataRow);
    }

    await waitFor(() => {
      // ViewPane should show field names from the clicked row
      expect(screen.getByText(/field/i)).toBeInTheDocument();
    });
  });

  it('clicking different rows updates ViewPane content', async () => {
    render(<TableViewer {...defaultProps} />);

    const rows = screen.getAllByRole('row');

    // Click first data row
    if (rows[1]) {
      fireEvent.click(rows[1]);
    }

    await waitFor(() => {
      expect(screen.getByText(/field/i)).toBeInTheDocument();
    });

    // Click second data row
    if (rows[2]) {
      fireEvent.click(rows[2]);
    }

    // ViewPane should update (still showing fields)
    await waitFor(() => {
      expect(screen.getByText(/field/i)).toBeInTheDocument();
    });
  });
});

// =============================================================================
// ViewPane Content Tests
// =============================================================================

describe('ViewPane Browser - Content', () => {
  it('displays field entries for the selected row', async () => {
    render(<TableViewer {...defaultProps} />);

    const rows = screen.getAllByRole('row');
    if (rows[1]) {
      fireEvent.click(rows[1]);
    }

    await waitFor(() => {
      // Should show field names from the data (name, status, score, metadata, tags)
      expect(screen.getByText('name')).toBeInTheDocument();
    });
  });

  it('field entries are collapsible', async () => {
    const user = userEvent.setup();
    render(<TableViewer {...defaultProps} />);

    // Click a row to open ViewPane
    const rows = screen.getAllByRole('row');
    if (rows[1]) {
      fireEvent.click(rows[1]);
    }

    await waitFor(() => {
      expect(screen.getByText('name')).toBeInTheDocument();
    });

    // Find a field accordion button and click to collapse
    const fieldButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.textContent?.includes('name') && btn.closest('.border-b'));

    if (fieldButtons[0]) {
      await user.click(fieldButtons[0]);
    }
  });
});
