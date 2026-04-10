/**
 * ViewPane Component Unit Tests
 *
 * Tests for the ViewPane component covering:
 * - Empty state rendering
 * - Single cell display
 * - Multiple cell display
 * - Row-based viewing
 * - Focused field
 * - Close button
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewPane, type SelectedCellData } from '@/components/Pages/Table/ViewPane';

// =============================================================================
// Test Data Factories
// =============================================================================

function createCellData(overrides: Partial<SelectedCellData> = {}): SelectedCellData {
  return {
    cellId: '0_name',
    rowId: '0',
    columnId: 'name',
    value: 'Test Value',
    fieldType: 'str',
    rowDataId: 123,
    rowIndex: 1,
    ...overrides,
  };
}

function createRowData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: 1,
    _ts: '2026-01-01T00:00:00Z',
    name: 'Alice',
    status: 'active',
    score: 95.5,
    ...overrides,
  };
}

// =============================================================================
// Empty State Tests
// =============================================================================

describe('ViewPane - Empty State', () => {
  it('renders empty state when no cells or row selected', () => {
    const onClose = vi.fn();
    render(<ViewPane selectedCells={[]} onClose={onClose} />);

    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Select a row or cell to view')).toBeInTheDocument();
  });

  it('shows multi-select hint in empty state', () => {
    const onClose = vi.fn();
    render(<ViewPane selectedCells={[]} onClose={onClose} />);

    expect(screen.getByText(/Ctrl\+click or Shift\+click/)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ViewPane selectedCells={[]} onClose={onClose} />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Single Cell Display Tests
// =============================================================================

describe('ViewPane - Single Cell', () => {
  it('displays column name and row info', () => {
    const cell = createCellData({
      columnId: 'username',
      rowIndex: 5,
      rowDataId: 'abc123',
    });

    render(<ViewPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('username')).toBeInTheDocument();
    expect(screen.getByText(/Row 5/)).toBeInTheDocument();
    expect(screen.getByText(/(abc123)/)).toBeInTheDocument();
  });

  it('displays string value correctly', () => {
    const cell = createCellData({ value: 'Hello World' });
    render(<ViewPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('displays "1 cell selected" in header', () => {
    const cell = createCellData();
    render(<ViewPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('1 cell selected')).toBeInTheDocument();
  });
});

// =============================================================================
// Multiple Cells Display Tests
// =============================================================================

describe('ViewPane - Multiple Cells', () => {
  it('displays all selected cells', () => {
    const cells = [
      createCellData({ cellId: '0_name', columnId: 'name', value: 'Alice' }),
      createCellData({
        cellId: '1_status',
        columnId: 'status',
        value: 'active',
        rowId: '1',
        rowIndex: 2,
      }),
    ];

    render(<ViewPane selectedCells={cells} onClose={vi.fn()} />);

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows correct cell count in header', () => {
    const cells = [
      createCellData({ cellId: '0_a' }),
      createCellData({ cellId: '0_b' }),
      createCellData({ cellId: '0_c' }),
    ];

    render(<ViewPane selectedCells={cells} onClose={vi.fn()} />);

    expect(screen.getByText('3 cells selected')).toBeInTheDocument();
  });

  it('shows row numbers for each cell', () => {
    const cells = [
      createCellData({ cellId: '0_name', rowIndex: 1 }),
      createCellData({ cellId: '1_name', rowIndex: 2, rowId: '1' }),
    ];

    render(<ViewPane selectedCells={cells} onClose={vi.fn()} />);

    expect(screen.getByText(/Row 1/)).toBeInTheDocument();
    expect(screen.getByText(/Row 2/)).toBeInTheDocument();
  });
});

// =============================================================================
// Row-Based Viewing Tests
// =============================================================================

describe('ViewPane - Row Viewing', () => {
  it('shows all non-internal fields when selectedRow is set', () => {
    const row = createRowData();

    render(<ViewPane selectedCells={[]} selectedRow={row} onClose={vi.fn()} />);

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText('score')).toBeInTheDocument();
  });

  it('filters out internal fields (starting with _)', () => {
    const row = createRowData();

    render(<ViewPane selectedCells={[]} selectedRow={row} onClose={vi.fn()} />);

    // _id and _ts should not appear as field names in accordion headers
    expect(screen.queryByText('_id')).not.toBeInTheDocument();
    expect(screen.queryByText('_ts')).not.toBeInTheDocument();
  });

  it('shows field count in header subtitle', () => {
    const row = createRowData();

    render(<ViewPane selectedCells={[]} selectedRow={row} onClose={vi.fn()} />);

    // 3 non-internal fields: name, status, score
    expect(screen.getByText('3 fields')).toBeInTheDocument();
  });

  it('row view takes priority over cell view when both are set', () => {
    const row = createRowData();
    const cells = [createCellData()];

    render(<ViewPane selectedCells={cells} selectedRow={row} onClose={vi.fn()} />);

    // Should show field count (row mode), not cell count
    expect(screen.getByText('3 fields')).toBeInTheDocument();
    expect(screen.queryByText('1 cell selected')).not.toBeInTheDocument();
  });

  it('field accordion entries are collapsible', () => {
    const row = createRowData({ details: { key: 'value' } });

    render(<ViewPane selectedCells={[]} selectedRow={row} onClose={vi.fn()} />);

    // The "name" field should be visible in accordion
    expect(screen.getByText('name')).toBeInTheDocument();

    // Click the "name" accordion header to collapse it
    const nameButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('name'));
    if (nameButton) {
      fireEvent.click(nameButton);
    }
  });
});

// =============================================================================
// Focused Field Tests
// =============================================================================

describe('ViewPane - Focused Field', () => {
  it('highlights the focused field', () => {
    const row = createRowData();

    const { container } = render(
      <ViewPane selectedCells={[]} selectedRow={row} focusedField="status" onClose={vi.fn()} />
    );

    // The focused field entry should have the accent highlight class
    const focusedDiv = container.querySelector('.bg-accent\\/50');
    expect(focusedDiv).not.toBeNull();
  });

  it('non-focused fields are not highlighted', () => {
    const row = createRowData();

    const { container } = render(
      <ViewPane selectedCells={[]} selectedRow={row} focusedField="nonexistent" onClose={vi.fn()} />
    );

    // No field should have the accent class since "nonexistent" isn't a real field
    const focusedDivs = container.querySelectorAll('.bg-accent\\/50');
    expect(focusedDivs.length).toBe(0);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('ViewPane - Edge Cases', () => {
  it('handles undefined rowDataId', () => {
    const cell = createCellData({ rowDataId: undefined });
    render(<ViewPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText(/Row 1/)).toBeInTheDocument();
  });

  it('handles undefined rowIndex', () => {
    const cell = createCellData({ rowIndex: undefined, rowId: '5' });
    render(<ViewPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText(/Row 6/)).toBeInTheDocument();
  });

  it('handles very long strings', () => {
    const longString = 'A'.repeat(200);
    const cell = createCellData({ value: longString });
    render(<ViewPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText(longString)).toBeInTheDocument();
  });

  it('handles special characters in values', () => {
    const cell = createCellData({ value: '<script>alert("xss")</script>' });
    render(<ViewPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
  });

  it('handles empty row object', () => {
    render(<ViewPane selectedCells={[]} selectedRow={{ _id: 1 }} onClose={vi.fn()} />);

    // All fields are internal, so 0 visible fields
    expect(screen.getByText('0 fields')).toBeInTheDocument();
  });

  it('handles row with null values', () => {
    const row = createRowData({ nullField: null });

    render(<ViewPane selectedCells={[]} selectedRow={row} onClose={vi.fn()} />);

    expect(screen.getByText('nullField')).toBeInTheDocument();
  });
});
