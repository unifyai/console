/**
 * TableViewer Browser Integration Tests
 *
 * Browser-based tests for user interactions that require a real browser:
 * - Drag and drop column reordering
 * - Clipboard API
 * - Scroll behavior
 * - Visual rendering
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableViewer } from '@/components/Pages/Table/TableViewer';
import { http, HttpResponse } from 'msw';
import { worker } from '@/../vitest.browser.setup';

// =============================================================================
// Test Data
// =============================================================================

const createMockData = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    _id: i + 1,
    _ts: new Date(Date.now() - i * 86400000).toISOString(),
    id: i + 1,
    name: `Item ${i + 1}`,
    status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'completed',
    value: Math.round((i * 12.5 + 5) * 100) / 100,
    category: `cat_${i % 5}`,
  }));

const mockConfig = {
  visibleColumns: ['id', 'name', 'status', 'value', 'category'],
  columnOrder: ['id', 'name', 'status', 'value', 'category'],
  rowLimit: 50,
  sortBy: undefined,
  sortOrder: undefined as 'asc' | 'desc' | undefined,
};

const mockFields = {
  id: { type: 'int', count: 100 },
  name: { type: 'str', count: 100 },
  status: { type: 'str', count: 100 },
  value: { type: 'float', count: 100 },
  category: { type: 'str', count: 100 },
};

const mockMetadata = {
  token: 'browser123456',
  title: 'Browser Test Table',
  projectName: 'browser-test-project',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: 'test-user',
};

const createMockPagination = (totalCount: number, pageSize: number = 100) => ({
  page: 1,
  pageSize,
  totalCount,
  totalPages: Math.ceil(totalCount / pageSize),
  hasNextPage: totalCount > pageSize,
  hasPreviousPage: false,
});

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Rendering Tests
// =============================================================================

describe('TableViewer Browser - Rendering', () => {
  it('renders table with all visible columns', async () => {
    const data = createMockData(10);

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(10)}
      />
    );

    // Check all column headers are visible
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText('value')).toBeInTheDocument();
    expect(screen.getByText('category')).toBeInTheDocument();
  });

  it('renders correct number of data rows', async () => {
    const data = createMockData(25);

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(25)}
      />
    );

    // Get all table rows (excluding header row)
    const table = screen.getByRole('table');
    const tbody = table.querySelector('tbody');
    const rows = tbody?.querySelectorAll('tr');

    expect(rows?.length).toBe(25);
  });

  it('displays formatted numbers correctly', async () => {
    const data = [
      {
        _id: 1,
        _ts: '2026-01-01T00:00:00Z',
        id: 1,
        name: 'Test',
        status: 'active',
        value: 1234.56,
        category: 'cat',
      },
    ];

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(1)}
      />
    );

    // Number is formatted with locale-aware formatting (may include thousand separator)
    expect(screen.getByText(/1,?234\.56/)).toBeInTheDocument();
  });
});

// =============================================================================
// Column Visibility Tests
// =============================================================================

describe('TableViewer Browser - Column Visibility', () => {
  it('opens column visibility dropdown', async () => {
    const user = userEvent.setup();
    const data = createMockData(5);

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(5)}
      />
    );

    await user.click(screen.getByText('Columns'));

    // Dropdown should show checkboxes for each column (using Popover + Checkbox now)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(5);
  });

  it('hides column when unchecked', async () => {
    const user = userEvent.setup();
    const data = createMockData(5);

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(5)}
      />
    );

    // Open dropdown
    await user.click(screen.getByText('Columns'));

    // Find and uncheck the 'category' checkbox (in the popover)
    // Use getAllByText and find the one in the popover (inside a label)
    const categoryLabels = screen.getAllByText('category');
    const categoryInPopover = categoryLabels.find((el) => el.closest('label') !== null);
    if (categoryInPopover) {
      await user.click(categoryInPopover);
    }

    // Close dropdown by pressing Escape
    await user.keyboard('{Escape}');

    // Category column should no longer show data
    expect(screen.queryByText('cat_0')).not.toBeInTheDocument();
  });

  it('shows column when checked', async () => {
    const user = userEvent.setup();
    const data = createMockData(5);

    // Start with category hidden
    const configWithHidden = {
      ...mockConfig,
      visibleColumns: ['id', 'name', 'status', 'value'],
      columnOrder: ['id', 'name', 'status', 'value'],
    };

    render(
      <TableViewer
        config={configWithHidden}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(5)}
      />
    );

    // Verify category data is not visible initially (cat_0 is the category value)
    expect(screen.queryByText('cat_0')).not.toBeInTheDocument();

    // Open dropdown and check category
    await user.click(screen.getByText('Columns'));

    // Find and click the category checkbox (in the popover)
    const categoryLabels = screen.getAllByText('category');
    const categoryInPopover = categoryLabels.find((el) => el.closest('label') !== null);
    if (categoryInPopover) {
      await user.click(categoryInPopover);
    }

    // Close dropdown by pressing Escape
    await user.keyboard('{Escape}');

    // Category data should now be visible
    await waitFor(() => {
      expect(screen.getByText('cat_0')).toBeInTheDocument();
    });
  });
});

// =============================================================================
// Sorting Tests
// =============================================================================

describe('TableViewer Browser - Sorting', () => {
  it('has sortable column headers', async () => {
    const data = createMockData(5);

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(5)}
      />
    );

    // Each column header should have sort controls (buttons with sort icons)
    const table = screen.getByRole('table');
    const thead = table.querySelector('thead');
    const sortButtons = thead?.querySelectorAll('button');

    // Should have at least one sort button per column (plus grip buttons for drag)
    expect(sortButtons?.length).toBeGreaterThanOrEqual(5);
  });

  it('respects initial sortBy config', async () => {
    const data = [
      {
        _id: 1,
        _ts: '2026-01-01T00:00:00Z',
        id: 3,
        name: 'Charlie',
        status: 'active',
        value: 30,
        category: 'cat',
      },
      {
        _id: 2,
        _ts: '2026-01-02T00:00:00Z',
        id: 1,
        name: 'Alice',
        status: 'pending',
        value: 10,
        category: 'cat',
      },
      {
        _id: 3,
        _ts: '2026-01-03T00:00:00Z',
        id: 2,
        name: 'Bob',
        status: 'completed',
        value: 20,
        category: 'cat',
      },
    ];

    // Config with initial sort by name ascending
    const configWithSort = {
      ...mockConfig,
      sortBy: 'name',
      sortOrder: 'asc' as const,
    };

    render(
      <TableViewer
        config={configWithSort}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(3)}
      />
    );

    // With initial sort, first row should be Alice
    const table = screen.getByRole('table');
    const tbody = table.querySelector('tbody');
    const firstDataRow = tbody?.querySelector('tr');
    expect(firstDataRow?.textContent).toContain('Alice');
  });

  it('respects initial sortBy desc config', async () => {
    const data = [
      {
        _id: 1,
        _ts: '2026-01-01T00:00:00Z',
        id: 3,
        name: 'Charlie',
        status: 'active',
        value: 30,
        category: 'cat',
      },
      {
        _id: 2,
        _ts: '2026-01-02T00:00:00Z',
        id: 1,
        name: 'Alice',
        status: 'pending',
        value: 10,
        category: 'cat',
      },
      {
        _id: 3,
        _ts: '2026-01-03T00:00:00Z',
        id: 2,
        name: 'Bob',
        status: 'completed',
        value: 20,
        category: 'cat',
      },
    ];

    // Config with initial sort by name descending
    const configWithSort = {
      ...mockConfig,
      sortBy: 'name',
      sortOrder: 'desc' as const,
    };

    render(
      <TableViewer
        config={configWithSort}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(3)}
      />
    );

    // With desc sort, first row should be Charlie
    const table = screen.getByRole('table');
    const tbody = table.querySelector('tbody');
    const firstDataRow = tbody?.querySelector('tr');
    expect(firstDataRow?.textContent).toContain('Charlie');
  });
});

// =============================================================================
// Pagination Tests
// =============================================================================

describe('TableViewer Browser - Pagination', () => {
  const allPaginatedData = createMockData(100);
  const PAGE_SIZE = 10;
  const TOTAL_COUNT = 100;
  const TOTAL_PAGES = 10;

  function setupPaginationHandler() {
    worker.use(
      http.get('/api/table/data/browser123456', ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(url.searchParams.get('pageSize') || String(PAGE_SIZE), 10);
        const start = (page - 1) * pageSize;
        const pageData = allPaginatedData.slice(start, start + pageSize);

        return HttpResponse.json({
          data: pageData,
          fields: mockFields,
          config: mockConfig,
          metadata: mockMetadata,
          pagination: {
            page,
            pageSize,
            totalCount: TOTAL_COUNT,
            totalPages: TOTAL_PAGES,
            hasNextPage: page < TOTAL_PAGES,
            hasPreviousPage: page > 1,
          },
        });
      })
    );
  }

  it('navigates to next page', async () => {
    setupPaginationHandler();
    const user = userEvent.setup();
    const initialData = allPaginatedData.slice(0, PAGE_SIZE);

    render(
      <TableViewer
        config={{ ...mockConfig, rowLimit: PAGE_SIZE }}
        token="browser123456"
        initialData={initialData}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(TOTAL_COUNT, PAGE_SIZE)}
      />
    );

    expect(screen.getByText('Page 1 of 10')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: /Go to next page/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 10')).toBeInTheDocument();
    });
    expect(screen.getByText('Item 11')).toBeInTheDocument();
  });

  it('navigates to previous page', async () => {
    setupPaginationHandler();
    const user = userEvent.setup();
    const initialData = allPaginatedData.slice(0, PAGE_SIZE);

    render(
      <TableViewer
        config={{ ...mockConfig, rowLimit: PAGE_SIZE }}
        token="browser123456"
        initialData={initialData}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(TOTAL_COUNT, PAGE_SIZE)}
      />
    );

    const nextButton = screen.getByRole('button', { name: /Go to next page/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 10')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: /Go to previous page/i });
    await user.click(prevButton);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 10')).toBeInTheDocument();
    });
  });

  it('jumps to first page', async () => {
    setupPaginationHandler();
    const user = userEvent.setup();
    const initialData = allPaginatedData.slice(0, PAGE_SIZE);

    render(
      <TableViewer
        config={{ ...mockConfig, rowLimit: PAGE_SIZE }}
        token="browser123456"
        initialData={initialData}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(TOTAL_COUNT, PAGE_SIZE)}
      />
    );

    const nextButton = screen.getByRole('button', { name: /Go to next page/i });
    await user.click(nextButton);
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Page 3 of 10')).toBeInTheDocument();
    });

    const firstButton = screen.getByRole('button', { name: /Go to first page/i });
    await user.click(firstButton);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 10')).toBeInTheDocument();
    });
  });

  it('jumps to last page', async () => {
    setupPaginationHandler();
    const user = userEvent.setup();
    const initialData = allPaginatedData.slice(0, PAGE_SIZE);

    render(
      <TableViewer
        config={{ ...mockConfig, rowLimit: PAGE_SIZE }}
        token="browser123456"
        initialData={initialData}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(TOTAL_COUNT, PAGE_SIZE)}
      />
    );

    const lastButton = screen.getByRole('button', { name: /Go to last page/i });
    await user.click(lastButton);

    await waitFor(() => {
      expect(screen.getByText('Page 10 of 10')).toBeInTheDocument();
    });
  });
});

// =============================================================================
// Copy to Clipboard Tests
// =============================================================================

describe('TableViewer Browser - Copy', () => {
  it('has a Copy button', async () => {
    const data = createMockData(3);

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(3)}
      />
    );

    // Verify the copy button exists
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('shows Copied! confirmation after click', async () => {
    const user = userEvent.setup();
    const data = createMockData(3);

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(3)}
      />
    );

    // Click copy - in real browser, this will actually copy to clipboard
    await user.click(screen.getByText('Copy'));

    // Should show confirmation (clipboard API works in real browser)
    await waitFor(
      () => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('TableViewer Browser - Edge Cases', () => {
  it('handles large datasets without crashing', async () => {
    const data = createMockData(1000);

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(1000)}
      />
    );

    // Should render table without crashing
    expect(screen.getByRole('table')).toBeInTheDocument();
    // Header should show the project name and row count
    expect(screen.getByText(/browser-test-project/)).toBeInTheDocument();
  });

  it('handles empty table gracefully', async () => {
    render(
      <TableViewer
        token="browser123456"
        config={mockConfig}
        initialData={[]}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(0)}
      />
    );

    // Check header shows 0 rows
    expect(screen.getByText(/· 0 total rows/)).toBeInTheDocument();
  });

  it('handles special characters in data', async () => {
    const data = [
      {
        _id: 1,
        _ts: '2026-01-01T00:00:00Z',
        id: 1,
        name: '<script>alert("xss")</script>',
        status: 'a & b < c > d',
        value: 42,
        category: 'it\'s "quoted"',
      },
    ];

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(1)}
      />
    );

    // Should render as text, not execute
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
    expect(screen.getByText('a & b < c > d')).toBeInTheDocument();
  });

  it('handles unicode characters', async () => {
    const data = [
      {
        _id: 1,
        _ts: '2026-01-01T00:00:00Z',
        id: 1,
        name: '日本語テスト 🎉',
        status: 'أهلا بك',
        value: 42,
        category: '中文',
      },
    ];

    render(
      <TableViewer
        config={mockConfig}
        token="browser123456"
        initialData={data}
        fields={mockFields}
        metadata={mockMetadata}
        initialPagination={createMockPagination(1)}
      />
    );

    expect(screen.getByText('日本語テスト 🎉')).toBeInTheDocument();
    expect(screen.getByText('أهلا بك')).toBeInTheDocument();
    expect(screen.getByText('中文')).toBeInTheDocument();
  });
});
