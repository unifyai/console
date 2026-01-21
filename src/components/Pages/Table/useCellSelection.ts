'use client';

import type { Cell, Header, Table } from '@tanstack/react-table';
import { useRef, useState, useCallback } from 'react';

/**
 * Cell Selection Hook for TableViewer
 *
 * Provides full cell selection functionality:
 * - Single click to select a cell
 * - Ctrl/Cmd+click to toggle cells (multi-select)
 * - Shift+click to select a range
 * - Click row to select entire row
 * - Click column header to select entire column
 * - Drag to select range
 * - Keyboard navigation (arrows, Escape)
 *
 * Adapted from Interfaces useCellSelection but simplified for read-only table views.
 */

// =============================================================================
// Types
// =============================================================================

export interface UseCellSelectionProps {
  table: Table<Record<string, unknown>>;
  selectedCells: string[];
  setSelectedCells: (cells: string[]) => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Column ID to exclude from selection (e.g., row number column) */
  excludeColumnId?: string;
  /** Callback for Ctrl+C - copies selected cells */
  onCopy?: () => void;
}

export interface UseCellSelectionReturn {
  handleCellMouseDown: (
    e: React.MouseEvent<HTMLElement>,
    cell: Cell<Record<string, unknown>, unknown>
  ) => void;
  handleCellMouseUp: (e: React.MouseEvent<HTMLElement>) => void;
  handleCellMouseOver: (
    e: React.MouseEvent<HTMLElement>,
    cell: Cell<Record<string, unknown>, unknown>
  ) => void;
  handleHeaderMouseDown: (
    e: React.MouseEvent<HTMLElement>,
    header: Header<Record<string, unknown>, unknown>
  ) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  isCellSelected: (cell: Cell<Record<string, unknown>, unknown>) => boolean;
  isRowSelected: (rowId: string) => boolean;
  clearSelection: () => void;
  selectAll: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

const getCellId = (cell: Cell<Record<string, unknown>, unknown>): string => cell.id;

// A cell is valid for selection if it's not a placeholder
// We allow null/undefined values (shown as em-dash) to be selected
const isValidCell = (cell: Cell<Record<string, unknown>, unknown>): boolean =>
  !cell.getIsPlaceholder();

// =============================================================================
// Hook Implementation
// =============================================================================

export function useCellSelection({
  table,
  selectedCells,
  setSelectedCells,
  scrollContainerRef,
  excludeColumnId,
  onCopy,
}: UseCellSelectionProps): UseCellSelectionReturn {
  // Track the starting cell for range selection
  const [selectedStartCell, setSelectedStartCell] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Get all cells from the table (excluding specified column)
  const getAllCells = useCallback(
    () =>
      table
        .getRowModel()
        .rows.flatMap((row) =>
          row.getAllCells().filter((c) => !excludeColumnId || c.column.id !== excludeColumnId)
        ),
    [table, excludeColumnId]
  );

  const getCellFromId = useCallback(
    (cellId: string): Cell<Record<string, unknown>, unknown> | undefined =>
      getAllCells().find((c) => c.id === cellId),
    [getAllCells]
  );

  // ==========================================================================
  // Selection State Helpers
  // ==========================================================================

  const clearSelection = useCallback(() => {
    setSelectedCells([]);
    setSelectedStartCell(null);
  }, [setSelectedCells]);

  const isCellSelected = useCallback(
    (cell: Cell<Record<string, unknown>, unknown>): boolean => selectedCells.includes(cell.id),
    [selectedCells]
  );

  const isRowSelected = useCallback(
    (rowId: string): boolean => selectedCells.some((cellId) => cellId.startsWith(`${rowId}_`)),
    [selectedCells]
  );

  // ==========================================================================
  // Range Selection
  // ==========================================================================

  const getCellsBetween = useCallback(
    (cell1Id: string, cell2Id: string): string[] => {
      const cell1 = getCellFromId(cell1Id);
      const cell2 = getCellFromId(cell2Id);
      if (!cell1 || !cell2) return [];

      const rows = table.getRowModel().rows;
      const visibleColumns = table.getVisibleLeafColumns();

      // Find row indices
      const row1Idx = rows.findIndex((r) => r.id === cell1.row.id);
      const row2Idx = rows.findIndex((r) => r.id === cell2.row.id);
      const [startRowIdx, endRowIdx] = row1Idx < row2Idx ? [row1Idx, row2Idx] : [row2Idx, row1Idx];

      // Find column indices
      const col1Idx = visibleColumns.findIndex((c) => c.id === cell1.column.id);
      const col2Idx = visibleColumns.findIndex((c) => c.id === cell2.column.id);
      const [startColIdx, endColIdx] = col1Idx < col2Idx ? [col1Idx, col2Idx] : [col2Idx, col1Idx];

      // Collect all cells in the rectangle
      const cellIds: string[] = [];
      for (let rowIdx = startRowIdx; rowIdx <= endRowIdx; rowIdx++) {
        const row = rows[rowIdx];
        for (let colIdx = startColIdx; colIdx <= endColIdx; colIdx++) {
          const column = visibleColumns[colIdx];
          const cell = row.getAllCells().find((c) => c.column.id === column.id);
          if (cell && isValidCell(cell)) {
            cellIds.push(getCellId(cell));
          }
        }
      }

      return cellIds;
    },
    [getCellFromId, table]
  );

  const updateRangeSelection = useCallback(
    (endCell: Cell<Record<string, unknown>, unknown>) => {
      if (!selectedStartCell) return;

      const cellsInRange = getCellsBetween(selectedStartCell, getCellId(endCell));

      // Keep any cells selected before the start cell, then add the range
      const startIdx = selectedCells.indexOf(selectedStartCell);
      const prevCells = startIdx >= 0 ? selectedCells.slice(0, startIdx) : [];

      // Dedupe and set
      const newSelection = Array.from(new Set([...prevCells, ...cellsInRange]));
      setSelectedCells(newSelection);
    },
    [selectedStartCell, selectedCells, getCellsBetween, setSelectedCells]
  );

  // ==========================================================================
  // Row Selection
  // ==========================================================================

  const selectEntireRow = useCallback(
    (rowId: string, addToSelection: boolean = false) => {
      const row = table.getRowModel().rows.find((r) => r.id === rowId);
      if (!row) return;

      const rowCellIds = row
        .getVisibleCells()
        .filter((c) => isValidCell(c))
        .map((c) => getCellId(c));

      if (addToSelection) {
        // Check if row is already fully selected
        const allSelected = rowCellIds.every((id) => selectedCells.includes(id));
        if (allSelected) {
          // Deselect the row
          setSelectedCells(selectedCells.filter((id) => !rowCellIds.includes(id)));
        } else {
          // Add row to selection
          setSelectedCells(Array.from(new Set([...selectedCells, ...rowCellIds])));
        }
      } else {
        // Replace selection with this row
        const allSelected = rowCellIds.every((id) => selectedCells.includes(id));
        setSelectedCells(allSelected ? [] : rowCellIds);
      }

      // Set start cell for potential range extension
      if (rowCellIds.length > 0) {
        setSelectedStartCell(rowCellIds[0]);
      }
    },
    [table, selectedCells, setSelectedCells]
  );

  // ==========================================================================
  // Column Selection
  // ==========================================================================

  const selectEntireColumn = useCallback(
    (columnId: string, addToSelection: boolean = false) => {
      const rows = table.getRowModel().rows;
      const columnCellIds: string[] = [];

      rows.forEach((row) => {
        const cell = row.getAllCells().find((c) => c.column.id === columnId);
        if (cell && isValidCell(cell)) {
          columnCellIds.push(getCellId(cell));
        }
      });

      if (addToSelection) {
        const allSelected = columnCellIds.every((id) => selectedCells.includes(id));
        if (allSelected) {
          setSelectedCells(selectedCells.filter((id) => !columnCellIds.includes(id)));
        } else {
          setSelectedCells(Array.from(new Set([...selectedCells, ...columnCellIds])));
        }
      } else {
        const allSelected = columnCellIds.every((id) => selectedCells.includes(id));
        setSelectedCells(allSelected ? [] : columnCellIds);
      }

      if (columnCellIds.length > 0) {
        setSelectedStartCell(columnCellIds[0]);
      }
    },
    [table, selectedCells, setSelectedCells]
  );

  // ==========================================================================
  // Select All
  // ==========================================================================

  const selectAll = useCallback(() => {
    const allCellIds = getAllCells()
      .filter((c) => isValidCell(c))
      .map((c) => getCellId(c));
    setSelectedCells(allCellIds);
    if (allCellIds.length > 0) {
      setSelectedStartCell(allCellIds[0]);
    }
  }, [getAllCells, setSelectedCells]);

  // ==========================================================================
  // Keyboard Navigation
  // ==========================================================================

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Don't intercept if user is in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl+A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Ctrl+C: Copy selected cells
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedCells.length > 0 && onCopy) {
          e.preventDefault();
          onCopy();
        }
        return;
      }

      const lastSelected = selectedCells[selectedCells.length - 1];
      if (!lastSelected && e.key !== 'Escape') return;

      const lastCell = lastSelected ? getCellFromId(lastSelected) : undefined;

      switch (e.key) {
        case 'Escape': {
          e.preventDefault();
          clearSelection();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (!lastCell) return;
          const rows = table.getRowModel().rows;
          const currentRowIdx = rows.findIndex((r) => r.id === lastCell.row.id);
          if (currentRowIdx > 0) {
            const prevRow = rows[currentRowIdx - 1];
            const newCell = prevRow.getAllCells().find((c) => c.column.id === lastCell.column.id);
            if (newCell && isValidCell(newCell)) {
              setSelectedCells([getCellId(newCell)]);
              setSelectedStartCell(getCellId(newCell));
            }
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (!lastCell) return;
          const rows = table.getRowModel().rows;
          const currentRowIdx = rows.findIndex((r) => r.id === lastCell.row.id);
          if (currentRowIdx < rows.length - 1) {
            const nextRow = rows[currentRowIdx + 1];
            const newCell = nextRow.getAllCells().find((c) => c.column.id === lastCell.column.id);
            if (newCell && isValidCell(newCell)) {
              setSelectedCells([getCellId(newCell)]);
              setSelectedStartCell(getCellId(newCell));
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (!lastCell) return;
          const visibleCells = lastCell.row.getVisibleCells().filter((c) => isValidCell(c));
          const currentIdx = visibleCells.findIndex((c) => c.id === lastCell.id);
          if (currentIdx > 0) {
            const prevCell = visibleCells[currentIdx - 1];
            setSelectedCells([getCellId(prevCell)]);
            setSelectedStartCell(getCellId(prevCell));
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (!lastCell) return;
          const visibleCells = lastCell.row.getVisibleCells().filter((c) => isValidCell(c));
          const currentIdx = visibleCells.findIndex((c) => c.id === lastCell.id);
          if (currentIdx < visibleCells.length - 1) {
            const nextCell = visibleCells[currentIdx + 1];
            setSelectedCells([getCellId(nextCell)]);
            setSelectedStartCell(getCellId(nextCell));
          }
          break;
        }
      }
    },
    [selectedCells, getCellFromId, table, clearSelection, setSelectedCells, selectAll, onCopy]
  );

  // ==========================================================================
  // Mouse Event Handlers
  // ==========================================================================

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>, cell: Cell<Record<string, unknown>, unknown>) => {
      if (!isValidCell(cell)) return;

      const cellId = getCellId(cell);

      // Shift+click: Range selection
      if (e.shiftKey && selectedStartCell) {
        updateRangeSelection(cell);
        setIsMouseDown(true);
        return;
      }

      // Ctrl/Cmd+click: Toggle cell in selection
      if (e.ctrlKey || e.metaKey) {
        if (selectedCells.includes(cellId)) {
          setSelectedCells(selectedCells.filter((id) => id !== cellId));
        } else {
          setSelectedCells([...selectedCells, cellId]);
          setSelectedStartCell(cellId);
        }
        setIsMouseDown(true);
        return;
      }

      // Simple click: Select single cell (or deselect if already selected)
      if (selectedCells.length === 1 && selectedCells[0] === cellId) {
        clearSelection();
      } else {
        setSelectedCells([cellId]);
        setSelectedStartCell(cellId);
      }
      setIsMouseDown(true);
    },
    [selectedCells, selectedStartCell, setSelectedCells, clearSelection, updateRangeSelection]
  );

  const handleCellMouseUp = useCallback(() => {
    setIsMouseDown(false);
  }, []);

  const handleCellMouseOver = useCallback(
    (e: React.MouseEvent<HTMLElement>, cell: Cell<Record<string, unknown>, unknown>) => {
      // Only extend selection if mouse is down (drag selection)
      if (!isMouseDown || !selectedStartCell) return;

      // Extend range selection
      if (e.buttons === 1) {
        updateRangeSelection(cell);
      }
    },
    [isMouseDown, selectedStartCell, updateRangeSelection]
  );

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>, header: Header<Record<string, unknown>, unknown>) => {
      const columnId = header.column.id;
      const isCtrlClick = e.ctrlKey || e.metaKey;

      selectEntireColumn(columnId, isCtrlClick);
    },
    [selectEntireColumn]
  );

  return {
    handleCellMouseDown,
    handleCellMouseUp,
    handleCellMouseOver,
    handleHeaderMouseDown,
    handleKeyDown,
    isCellSelected,
    isRowSelected,
    clearSelection,
    selectAll,
  };
}
