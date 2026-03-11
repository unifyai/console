/**
 * useCellSelection Hook Unit Tests
 *
 * Tests for the cell selection hook covering:
 * - Single cell selection
 * - Multi-select (Ctrl/Cmd+click)
 * - Range selection (Shift+click)
 * - Select all (Ctrl+A)
 * - Keyboard navigation
 * - Copy callback (Ctrl+C)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCellSelection } from '@/components/Pages/Table/useCellSelection';
import type { Table, Cell, Row, Column } from '@tanstack/react-table';

// =============================================================================
// Mock Factories
// =============================================================================

function createMockCell(rowId: string, columnId: string): Cell<Record<string, unknown>, unknown> {
  return {
    id: `${rowId}_${columnId}`,
    row: { id: rowId } as Row<Record<string, unknown>>,
    column: { id: columnId } as Column<Record<string, unknown>, unknown>,
    getIsPlaceholder: () => false,
    getValue: () => `value_${rowId}_${columnId}`,
  } as Cell<Record<string, unknown>, unknown>;
}

function createMockRow(rowId: string, columnIds: string[]): Row<Record<string, unknown>> {
  const cells = columnIds.map((colId) => createMockCell(rowId, colId));
  return {
    id: rowId,
    getAllCells: () => cells,
    getVisibleCells: () => cells,
  } as unknown as Row<Record<string, unknown>>;
}

function createMockTable(rowCount: number, columnIds: string[]): Table<Record<string, unknown>> {
  const rows = Array.from({ length: rowCount }, (_, i) => createMockRow(String(i), columnIds));

  const columns = columnIds.map((id) => ({
    id,
    getIsVisible: () => true,
    getLeafColumns: () => [{ id }],
  }));

  const headers = columnIds.map((id) => ({
    column: { id, getLeafColumns: () => [{ id }] },
    getContext: () => ({
      table: {
        getRowModel: () => ({ rows }),
      },
    }),
  }));

  return {
    getRowModel: () => ({ rows }),
    getVisibleLeafColumns: () => columns,
    getLeafHeaders: () => headers,
  } as unknown as Table<Record<string, unknown>>;
}

// =============================================================================
// Setup
// =============================================================================

let mockTable: Table<Record<string, unknown>>;
let selectedCells: string[];
let setSelectedCells: Mock<(cells: string[]) => void>;

beforeEach(() => {
  mockTable = createMockTable(5, ['name', 'status', 'value']);
  selectedCells = [];
  setSelectedCells = vi.fn((cells: string[]) => {
    selectedCells = cells;
  });
});

// =============================================================================
// Selection State Tests
// =============================================================================

describe('useCellSelection - Selection State', () => {
  it('returns initial empty selection state', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: [],
        setSelectedCells,
      })
    );

    expect(result.current.isCellSelected).toBeDefined();
    expect(result.current.clearSelection).toBeDefined();
    expect(result.current.selectAll).toBeDefined();
  });

  it('isCellSelected returns true for selected cells', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['0_name', '1_status'],
        setSelectedCells,
      })
    );

    const cell0 = createMockCell('0', 'name');
    const cell1 = createMockCell('1', 'status');
    const cell2 = createMockCell('2', 'value');

    expect(result.current.isCellSelected(cell0)).toBe(true);
    expect(result.current.isCellSelected(cell1)).toBe(true);
    expect(result.current.isCellSelected(cell2)).toBe(false);
  });

  it('isAllRowSelected returns true only when all data cells in row are selected', () => {
    const { result: partial } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['1_name'],
        setSelectedCells,
      })
    );

    expect(partial.current.isAllRowSelected('0')).toBe(false);
    expect(partial.current.isAllRowSelected('1')).toBe(false);

    const { result: full } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['1_name', '1_status', '1_value'],
        setSelectedCells,
      })
    );

    expect(full.current.isAllRowSelected('1')).toBe(true);
  });

  it('clearSelection clears all selected cells', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['0_name', '1_status'],
        setSelectedCells,
      })
    );

    act(() => {
      result.current.clearSelection();
    });

    expect(setSelectedCells).toHaveBeenCalledWith([]);
  });
});

// =============================================================================
// Select All Tests
// =============================================================================

describe('useCellSelection - Select All', () => {
  it('selectAll selects all cells in table', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: [],
        setSelectedCells,
      })
    );

    act(() => {
      result.current.selectAll();
    });

    // 5 rows × 3 columns = 15 cells
    expect(setSelectedCells).toHaveBeenCalledWith(
      expect.arrayContaining([
        '0_name',
        '0_status',
        '0_value',
        '1_name',
        '1_status',
        '1_value',
        '2_name',
        '2_status',
        '2_value',
        '3_name',
        '3_status',
        '3_value',
        '4_name',
        '4_status',
        '4_value',
      ])
    );
    expect(setSelectedCells.mock.calls[0][0]).toHaveLength(15);
  });

  it('selectAll excludes specified column', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: [],
        setSelectedCells,
        excludeColumnId: 'status',
      })
    );

    act(() => {
      result.current.selectAll();
    });

    // 5 rows × 2 columns (excluding 'status') = 10 cells
    const selectedCellIds = setSelectedCells.mock.calls[0][0];
    expect(selectedCellIds).toHaveLength(10);
    expect(selectedCellIds.every((id: string) => !id.includes('_status'))).toBe(true);
  });
});

// =============================================================================
// Keyboard Navigation Tests
// =============================================================================

describe('useCellSelection - Keyboard Navigation', () => {
  it('Escape clears selection', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['0_name'],
        setSelectedCells,
      })
    );

    const event = {
      key: 'Escape',
      preventDefault: vi.fn(),
      target: { tagName: 'DIV' },
    } as unknown as React.KeyboardEvent<HTMLElement>;

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(setSelectedCells).toHaveBeenCalledWith([]);
  });

  it('Ctrl+A triggers selectAll', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: [],
        setSelectedCells,
      })
    );

    const event = {
      key: 'a',
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
      target: { tagName: 'DIV' },
    } as unknown as React.KeyboardEvent<HTMLElement>;

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(setSelectedCells).toHaveBeenCalled();
    expect(setSelectedCells.mock.calls[0][0]).toHaveLength(15);
  });

  it('Cmd+A triggers selectAll on Mac', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: [],
        setSelectedCells,
      })
    );

    const event = {
      key: 'a',
      ctrlKey: false,
      metaKey: true,
      preventDefault: vi.fn(),
      target: { tagName: 'DIV' },
    } as unknown as React.KeyboardEvent<HTMLElement>;

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(setSelectedCells).toHaveBeenCalled();
  });

  it('Ctrl+C calls onCopy callback when cells selected', () => {
    const onCopy = vi.fn();

    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['0_name', '1_status'],
        setSelectedCells,
        onCopy,
      })
    );

    const event = {
      key: 'c',
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
      target: { tagName: 'DIV' },
    } as unknown as React.KeyboardEvent<HTMLElement>;

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onCopy).toHaveBeenCalled();
  });

  it('Ctrl+C does nothing when no cells selected', () => {
    const onCopy = vi.fn();

    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: [],
        setSelectedCells,
        onCopy,
      })
    );

    const event = {
      key: 'c',
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
      target: { tagName: 'DIV' },
    } as unknown as React.KeyboardEvent<HTMLElement>;

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onCopy).not.toHaveBeenCalled();
  });

  it('ignores keyboard events when focus is in input', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['0_name'],
        setSelectedCells,
      })
    );

    const event = {
      key: 'Escape',
      preventDefault: vi.fn(),
      target: { tagName: 'INPUT' },
    } as unknown as React.KeyboardEvent<HTMLElement>;

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(setSelectedCells).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Mouse Event Tests
// =============================================================================

describe('useCellSelection - Mouse Events', () => {
  it('single click selects a cell', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: [],
        setSelectedCells,
      })
    );

    const cell = createMockCell('0', 'name');
    const event = {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    } as React.MouseEvent<HTMLElement>;

    act(() => {
      result.current.handleCellMouseDown(event, cell);
    });

    expect(setSelectedCells).toHaveBeenCalledWith(['0_name']);
  });

  it('clicking selected cell deselects it', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['0_name'],
        setSelectedCells,
      })
    );

    const cell = createMockCell('0', 'name');
    const event = {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    } as React.MouseEvent<HTMLElement>;

    act(() => {
      result.current.handleCellMouseDown(event, cell);
    });

    expect(setSelectedCells).toHaveBeenCalledWith([]);
  });

  it('Ctrl+click toggles cell in selection', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['0_name'],
        setSelectedCells,
      })
    );

    const cell = createMockCell('1', 'status');
    const event = {
      shiftKey: false,
      ctrlKey: true,
      metaKey: false,
    } as React.MouseEvent<HTMLElement>;

    act(() => {
      result.current.handleCellMouseDown(event, cell);
    });

    expect(setSelectedCells).toHaveBeenCalledWith(['0_name', '1_status']);
  });

  it('Ctrl+click on selected cell removes it', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: ['0_name', '1_status'],
        setSelectedCells,
      })
    );

    const cell = createMockCell('0', 'name');
    const event = {
      shiftKey: false,
      ctrlKey: true,
      metaKey: false,
    } as React.MouseEvent<HTMLElement>;

    act(() => {
      result.current.handleCellMouseDown(event, cell);
    });

    expect(setSelectedCells).toHaveBeenCalledWith(['1_status']);
  });

  it('handleCellMouseUp resets mouse state', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        table: mockTable,
        selectedCells: [],
        setSelectedCells,
      })
    );

    // Should not throw
    expect(() => {
      act(() => {
        result.current.handleCellMouseUp();
      });
    }).not.toThrow();
  });
});
