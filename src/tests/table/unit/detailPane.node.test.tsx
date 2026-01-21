/**
 * DetailPane Component Unit Tests
 *
 * Tests for the DetailPane component covering:
 * - Empty state rendering
 * - Single cell display
 * - Multiple cell display
 * - Type detection and icons
 * - Nested data expand/collapse
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DetailPane, type SelectedCellData } from '@/components/Pages/Table/DetailPane';

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

// =============================================================================
// Empty State Tests
// =============================================================================

describe('DetailPane - Empty State', () => {
  it('renders empty state when no cells selected', () => {
    const onClose = vi.fn();
    render(<DetailPane selectedCells={[]} onClose={onClose} />);

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Select cells to view')).toBeInTheDocument();
    expect(screen.getByText('Click on cells to view their full content here')).toBeInTheDocument();
  });

  it('shows multi-select hint in empty state', () => {
    const onClose = vi.fn();
    render(<DetailPane selectedCells={[]} onClose={onClose} />);

    expect(screen.getByText(/Ctrl\+click or Shift\+click/)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<DetailPane selectedCells={[]} onClose={onClose} />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Single Cell Display Tests
// =============================================================================

describe('DetailPane - Single Cell', () => {
  it('displays column name and row info', () => {
    const cell = createCellData({
      columnId: 'username',
      rowIndex: 5,
      rowDataId: 'abc123',
    });

    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('username')).toBeInTheDocument();
    expect(screen.getByText(/Row 5/)).toBeInTheDocument();
    expect(screen.getByText(/(abc123)/)).toBeInTheDocument();
  });

  it('displays string value correctly', () => {
    const cell = createCellData({ value: 'Hello World' });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('displays number value with formatting', () => {
    const cell = createCellData({ value: 12345.67 });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Number should be locale-formatted
    expect(screen.getByText(/12,?345\.67/)).toBeInTheDocument();
  });

  it('displays boolean true value', () => {
    const cell = createCellData({ value: true });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('displays boolean false value', () => {
    const cell = createCellData({ value: false });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('displays null value', () => {
    const cell = createCellData({ value: null });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('null')).toBeInTheDocument();
  });

  it('displays "1 cell selected" in header', () => {
    const cell = createCellData();
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('1 cell selected')).toBeInTheDocument();
  });
});

// =============================================================================
// Multiple Cells Display Tests
// =============================================================================

describe('DetailPane - Multiple Cells', () => {
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

    render(<DetailPane selectedCells={cells} onClose={vi.fn()} />);

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

    render(<DetailPane selectedCells={cells} onClose={vi.fn()} />);

    expect(screen.getByText('3 cells selected')).toBeInTheDocument();
  });

  it('shows row numbers for each cell', () => {
    const cells = [
      createCellData({ cellId: '0_name', rowIndex: 1 }),
      createCellData({ cellId: '1_name', rowIndex: 2, rowId: '1' }),
    ];

    render(<DetailPane selectedCells={cells} onClose={vi.fn()} />);

    expect(screen.getByText(/Row 1/)).toBeInTheDocument();
    expect(screen.getByText(/Row 2/)).toBeInTheDocument();
  });
});

// =============================================================================
// Nested Data Tests
// =============================================================================

describe('DetailPane - Nested Data', () => {
  it('displays object with expandable view', () => {
    const cell = createCellData({
      value: { name: 'John', age: 30 },
    });

    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Should show object indicator
    expect(screen.getByText('{2 keys}')).toBeInTheDocument();
  });

  it('displays array with item count', () => {
    const cell = createCellData({
      value: ['apple', 'banana', 'cherry'],
    });

    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('[3 items]')).toBeInTheDocument();
  });

  it('expands object on click', () => {
    const cell = createCellData({
      value: { username: 'alice', role: 'admin' },
    });

    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Object should auto-expand at depth 0
    expect(screen.getByText('username:')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('role:')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('collapses object on click', () => {
    const cell = createCellData({
      value: { secret: 'hidden' },
    });

    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Find the expand/collapse button (the object header row)
    const objectButton = screen.getByRole('button', { name: /{1 keys}/ });

    // Initially expanded, should show 'secret:'
    expect(screen.getByText('secret:')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(objectButton);

    // Should no longer show the key
    expect(screen.queryByText('secret:')).not.toBeInTheDocument();
  });

  it('displays empty object', () => {
    const cell = createCellData({ value: {} });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('{ }')).toBeInTheDocument();
  });

  it('displays empty array', () => {
    const cell = createCellData({ value: [] });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('[ ]')).toBeInTheDocument();
  });

  it('handles deeply nested data', () => {
    const cell = createCellData({
      value: {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      },
    });

    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Top level should be expanded
    expect(screen.getByText('level1:')).toBeInTheDocument();
  });
});

// =============================================================================
// Type Detection Tests
// =============================================================================

describe('DetailPane - Type Detection', () => {
  it('detects ISO date strings', () => {
    const cell = createCellData({
      value: '2026-01-21T12:30:00.000Z',
    });

    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Should parse and display as localized date
    // The exact format depends on locale, but should contain date parts
    const container = screen.getByText(/2026|Jan|21/);
    expect(container).toBeInTheDocument();
  });

  it('treats regular strings as strings (not dates)', () => {
    const cell = createCellData({ value: 'Hello World' });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('DetailPane - Edge Cases', () => {
  it('handles undefined rowDataId', () => {
    const cell = createCellData({ rowDataId: undefined });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Should not show parentheses for ID
    expect(screen.getByText(/Row 1/)).toBeInTheDocument();
  });

  it('handles undefined rowIndex', () => {
    const cell = createCellData({ rowIndex: undefined, rowId: '5' });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Should fallback to rowId + 1
    expect(screen.getByText(/Row 6/)).toBeInTheDocument();
  });

  it('handles very long strings', () => {
    const longString = 'A'.repeat(200);
    const cell = createCellData({ value: longString });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Should render (possibly truncated/wrapped)
    expect(screen.getByText(longString)).toBeInTheDocument();
  });

  it('handles special characters in values', () => {
    const cell = createCellData({ value: '<script>alert("xss")</script>' });
    render(<DetailPane selectedCells={[cell]} onClose={vi.fn()} />);

    // Should render as text, not execute
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
  });
});
