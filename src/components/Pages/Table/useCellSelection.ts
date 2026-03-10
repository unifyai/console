'use client';

import type { Cell, Header, Table } from '@tanstack/react-table';
import { useRef, useState, useCallback, type MutableRefObject } from 'react';

/**
 * Cell Selection Hook for TableViewer
 *
 * Mirrors the interfaces useCellSelection hook, simplified for read-only table views.
 * Handles: single click, Ctrl/Cmd multi-select, Shift range, drag range,
 * row selection via RowNumbering cells, column selection via header clicks/drag,
 * keyboard navigation (arrows, Escape, Ctrl+A, Ctrl+C).
 */

// =============================================================================
// Types
// =============================================================================

type AnyCell = Cell<Record<string, unknown>, unknown>;
type AnyHeader = Header<Record<string, unknown>, unknown>;
type AnyTable = Table<Record<string, unknown>>;

export interface UseCellSelectionProps {
  table: AnyTable;
  selectedCells: string[];
  setSelectedCells: (cells: string[]) => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Column ID to treat as the row-index column (e.g. 'RowNumbering') */
  excludeColumnId?: string;
  onCopy?: () => void;
}

export interface UseCellSelectionReturn {
  /** Unified mouse-down for cells (including RowNumbering) and headers */
  handleCellMouseDown: (e: React.MouseEvent<HTMLElement>, target: AnyCell | AnyHeader) => void;
  handleCellMouseUp: () => void;
  /** Unified mouse-over for cells (including RowNumbering) and headers during drag */
  handleCellMouseOver: (e: React.MouseEvent<HTMLElement>, target: AnyCell | AnyHeader) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  isCellSelected: (cell: AnyCell) => boolean;
  /** True when ALL data cells of the row are selected (for RowNumbering highlight) */
  isAllRowSelected: (rowId: string) => boolean;
  clearSelection: () => void;
  selectAll: () => void;
  wasDraggingRef: MutableRefObject<boolean>;
}

// =============================================================================
// Helpers
// =============================================================================

const getCellId = (cell: AnyCell): string => cell.id;

const isRowIndexCell = (cell: AnyCell, excludeId?: string): boolean =>
  !!excludeId && cell.column.id === excludeId;

const isValidCell = (cell: AnyCell): boolean => !cell.getIsPlaceholder();

const isDataCell = (cell: AnyCell, excludeId?: string): boolean =>
  isValidCell(cell) && !isRowIndexCell(cell, excludeId);

const getCellsFromHeader = (header: AnyHeader): AnyCell[] => {
  const leafColumns = header.column.getLeafColumns().map((col) => col.id);
  return header
    .getContext()
    .table.getRowModel()
    .rows.flatMap((row) => row.getAllCells())
    .filter((cell) => leafColumns.includes(cell.column.id));
};

const getSelectableTableCells = (table: AnyTable, excludeId?: string): AnyCell[] => {
  const headers = table.getLeafHeaders().filter((h) => !excludeId || h.column.id !== excludeId);
  return headers.flatMap((h) => getCellsFromHeader(h)).filter((cell) => isValidCell(cell));
};

// =============================================================================
// Hook
// =============================================================================

export function useCellSelection({
  table,
  selectedCells,
  setSelectedCells,
  scrollContainerRef,
  excludeColumnId,
  onCopy,
}: UseCellSelectionProps): UseCellSelectionReturn {
  const [selectedStartCell, setSelectedStartCell] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const wasDraggingRef = useRef(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Selection state helpers
  // ──────────────────────────────────────────────────────────────────────────

  const clearSelection = useCallback(() => {
    setSelectedCells([]);
    setSelectedStartCell(null);
  }, [setSelectedCells]);

  const isCellSelected = useCallback(
    (cell: AnyCell): boolean => selectedCells.includes(cell.id),
    [selectedCells]
  );

  const isAllRowSelected = useCallback(
    (rowId: string): boolean => {
      const row = table.getRowModel().rows.find((r) => r.id === rowId);
      if (!row) return false;
      const dataCells = row
        .getAllCells()
        .filter((c) => isDataCell(c, excludeColumnId) && c.column.getIsVisible());
      if (dataCells.length === 0) return false;
      return dataCells.every((c) => selectedCells.includes(c.id));
    },
    [table, selectedCells, excludeColumnId]
  );

  const selectAll = useCallback(() => {
    const allCellIds = getSelectableTableCells(table, excludeColumnId).map(getCellId);
    setSelectedCells(allCellIds);
    if (allCellIds.length > 0) setSelectedStartCell(allCellIds[0]);
  }, [table, excludeColumnId, setSelectedCells]);

  // ──────────────────────────────────────────────────────────────────────────
  // Range helpers
  // ──────────────────────────────────────────────────────────────────────────

  const getCellFromId = useCallback(
    (cellId: string): AnyCell | undefined => {
      const rows = table.getRowModel().rows;
      for (const row of rows) {
        const cell = row.getAllCells().find((c) => c.id === cellId);
        if (cell) return cell;
      }
      return undefined;
    },
    [table]
  );

  const getCellsBetween = useCallback(
    (cell1Id: string, cell2Id: string): string[] => {
      const cell1 = getCellFromId(cell1Id);
      const cell2 = getCellFromId(cell2Id);
      if (!cell1 || !cell2) return [];

      const rows = table.getRowModel().rows;
      const visibleColumns = table
        .getVisibleLeafColumns()
        .filter((c) => !excludeColumnId || c.id !== excludeColumnId);

      const row1Idx = rows.findIndex((r) => r.id === cell1.row.id);
      const row2Idx = rows.findIndex((r) => r.id === cell2.row.id);
      const [startRow, endRow] = row1Idx < row2Idx ? [row1Idx, row2Idx] : [row2Idx, row1Idx];

      const col1Idx = visibleColumns.findIndex((c) => c.id === cell1.column.id);
      const col2Idx = visibleColumns.findIndex((c) => c.id === cell2.column.id);
      const [startCol, endCol] = col1Idx < col2Idx ? [col1Idx, col2Idx] : [col2Idx, col1Idx];

      const ids: string[] = [];
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const col = visibleColumns[c];
          const cell = rows[r].getAllCells().find((x) => x.column.id === col.id);
          if (cell && isValidCell(cell)) ids.push(getCellId(cell));
        }
      }
      return ids;
    },
    [getCellFromId, table, excludeColumnId]
  );

  /** Select all data cells in a contiguous range of rows */
  const selectRowRange = useCallback(
    (startRowId: string, endRowId: string) => {
      const rows = table.getRowModel().rows;
      const startIdx = rows.findIndex((r) => r.id === startRowId);
      const endIdx = rows.findIndex((r) => r.id === endRowId);
      if (startIdx === -1 || endIdx === -1) return;
      const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

      const ids: string[] = [];
      for (let i = lo; i <= hi; i++) {
        rows[i]
          .getAllCells()
          .filter((c) => isDataCell(c, excludeColumnId) && c.column.getIsVisible())
          .forEach((c) => ids.push(getCellId(c)));
      }
      setSelectedCells(ids);
    },
    [table, setSelectedCells, excludeColumnId]
  );

  const updateRangeSelection = useCallback(
    (target: AnyCell | AnyHeader) => {
      if (!selectedStartCell) return;

      // RowNumbering cell drag → row range selection
      if ('row' in target) {
        const cell = target as AnyCell;
        if (isRowIndexCell(cell, excludeColumnId)) {
          const startRowId = selectedStartCell.split('_')[0];
          selectRowRange(startRowId, cell.row.id);
          return;
        }
      }

      // Determine end cell id
      let endCellId = selectedStartCell;
      if ('row' in target) {
        const cell = target as AnyCell;
        if (isDataCell(cell, excludeColumnId)) endCellId = getCellId(cell);
      } else if ('depth' in target) {
        const header = target as AnyHeader;
        const columnCells = getCellsFromHeader(header).filter((c) =>
          isDataCell(c, excludeColumnId)
        );
        const last = columnCells.at(-1);
        if (last) endCellId = getCellId(last);
      }

      const range = getCellsBetween(selectedStartCell, endCellId);
      const startIdx = selectedCells.indexOf(selectedStartCell);
      const prev = startIdx >= 0 ? selectedCells.slice(0, startIdx) : [];
      setSelectedCells(Array.from(new Set([...prev, ...range])));
    },
    [
      selectedStartCell,
      selectedCells,
      getCellsBetween,
      setSelectedCells,
      excludeColumnId,
      selectRowRange,
    ]
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Keyboard navigation
  // ──────────────────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedCells.length > 0 && onCopy) {
          e.preventDefault();
          onCopy();
        }
        return;
      }

      const lastId = selectedCells[selectedCells.length - 1];
      if (!lastId && e.key !== 'Escape') return;
      const lastCell = lastId ? getCellFromId(lastId) : undefined;

      const dataCols = table
        .getVisibleLeafColumns()
        .filter((c) => !excludeColumnId || c.id !== excludeColumnId);

      // Check if entire row is selected
      const isRowMode = (() => {
        if (!lastCell) return false;
        const rowDataCells = lastCell.row
          .getAllCells()
          .filter((c) => isDataCell(c, excludeColumnId) && c.column.getIsVisible());
        return rowDataCells.length > 0 && rowDataCells.every((c) => selectedCells.includes(c.id));
      })();

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          clearSelection();
          break;
        case 'ArrowUp': {
          e.preventDefault();
          if (!lastCell) return;
          const rows = table.getRowModel().rows;
          const idx = rows.findIndex((r) => r.id === lastCell.row.id);
          if (idx <= 0) return;
          const prevRow = rows[idx - 1];
          if (isRowMode) {
            const cells = prevRow
              .getAllCells()
              .filter((c) => isDataCell(c, excludeColumnId) && c.column.getIsVisible());
            setSelectedCells(cells.map(getCellId));
            if (cells.length) setSelectedStartCell(getCellId(cells[0]));
          } else {
            const nc = prevRow.getAllCells().find((c) => c.column.id === lastCell.column.id);
            if (nc && isValidCell(nc)) {
              setSelectedCells([getCellId(nc)]);
              setSelectedStartCell(getCellId(nc));
            }
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (!lastCell) return;
          const rows = table.getRowModel().rows;
          const idx = rows.findIndex((r) => r.id === lastCell.row.id);
          if (idx >= rows.length - 1) return;
          const nextRow = rows[idx + 1];
          if (isRowMode) {
            const cells = nextRow
              .getAllCells()
              .filter((c) => isDataCell(c, excludeColumnId) && c.column.getIsVisible());
            setSelectedCells(cells.map(getCellId));
            if (cells.length) setSelectedStartCell(getCellId(cells[0]));
          } else {
            const nc = nextRow.getAllCells().find((c) => c.column.id === lastCell.column.id);
            if (nc && isValidCell(nc)) {
              setSelectedCells([getCellId(nc)]);
              setSelectedStartCell(getCellId(nc));
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (!lastCell || isRowMode) return;
          const colIdx = dataCols.findIndex((c) => c.id === lastCell.column.id);
          if (colIdx > 0) {
            const prevCol = dataCols[colIdx - 1];
            const nc = lastCell.row.getAllCells().find((c) => c.column.id === prevCol.id);
            if (nc && isValidCell(nc)) {
              setSelectedCells([getCellId(nc)]);
              setSelectedStartCell(getCellId(nc));
            }
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (!lastCell) return;
          if (isRowMode) {
            const firstDataCell = lastCell.row
              .getAllCells()
              .find((c) => isDataCell(c, excludeColumnId) && c.column.getIsVisible());
            if (firstDataCell) {
              setSelectedCells([getCellId(firstDataCell)]);
              setSelectedStartCell(getCellId(firstDataCell));
            }
            return;
          }
          const colIdx = dataCols.findIndex((c) => c.id === lastCell.column.id);
          if (colIdx < dataCols.length - 1) {
            const nextCol = dataCols[colIdx + 1];
            const nc = lastCell.row.getAllCells().find((c) => c.column.id === nextCol.id);
            if (nc && isValidCell(nc)) {
              setSelectedCells([getCellId(nc)]);
              setSelectedStartCell(getCellId(nc));
            }
          }
          break;
        }
      }
    },
    [
      selectedCells,
      getCellFromId,
      table,
      clearSelection,
      setSelectedCells,
      selectAll,
      onCopy,
      excludeColumnId,
    ]
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Mouse handlers — unified Cell | Header (mirrors interfaces approach)
  // ──────────────────────────────────────────────────────────────────────────

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>, target: AnyCell | AnyHeader) => {
      wasDraggingRef.current = false;

      if ('row' in target) {
        // ── Cell click ──
        const cell = target as AnyCell;
        if (!isValidCell(cell)) return;

        if (isRowIndexCell(cell, excludeColumnId)) {
          // Row index click → select all data cells in the row
          const rowDataCells = cell.row
            .getAllCells()
            .filter((c) => isDataCell(c, excludeColumnId) && c.column.getIsVisible());
          const ids = rowDataCells.map(getCellId);
          const first = rowDataCells[0];
          const startId = first ? getCellId(first) : null;

          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            const allSelected = ids.every((id) => selectedCells.includes(id));
            setSelectedCells(allSelected ? [] : ids);
          } else if (e.ctrlKey || e.metaKey) {
            const allSelected = ids.every((id) => selectedCells.includes(id));
            setSelectedCells(
              allSelected
                ? selectedCells.filter((id) => !ids.includes(id))
                : [...selectedCells, ...ids]
            );
          } else if (e.shiftKey) {
            updateRangeSelection(cell);
            setIsMouseDown(true);
            return;
          }
          if (startId && !isMouseDown) setSelectedStartCell(startId);
        } else {
          // Data cell click
          const cellId = getCellId(cell);

          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            const already = selectedCells.length === 1 && selectedCells[0] === cellId;
            setSelectedCells(already ? [] : [cellId]);
            if (!isMouseDown) setSelectedStartCell(cellId);
          } else if (e.ctrlKey || e.metaKey) {
            setSelectedCells(
              selectedCells.includes(cellId)
                ? selectedCells.filter((id) => id !== cellId)
                : [...selectedCells, cellId]
            );
            if (!isMouseDown) setSelectedStartCell(cellId);
          } else if (e.shiftKey) {
            updateRangeSelection(cell);
            setIsMouseDown(true);
            return;
          }
        }
      } else if ('depth' in target) {
        // ── Header click ──
        const header = target as AnyHeader;

        // RowNumbering header → select all
        if (excludeColumnId && header.column.id === excludeColumnId) {
          selectAll();
          setIsMouseDown(true);
          return;
        }

        const columnCells = getCellsFromHeader(header).filter((c) =>
          isDataCell(c, excludeColumnId)
        );
        const ids = columnCells.map(getCellId);
        const first = columnCells[0];

        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          const allSelected = ids.length > 0 && ids.every((id) => selectedCells.includes(id));
          setSelectedCells(allSelected ? [] : ids);
          if (first && !isMouseDown) setSelectedStartCell(getCellId(first));
        } else if (e.ctrlKey || e.metaKey) {
          const allSelected = ids.length > 0 && ids.every((id) => selectedCells.includes(id));
          setSelectedCells(
            allSelected
              ? selectedCells.filter((id) => !ids.includes(id))
              : [...selectedCells, ...ids]
          );
          if (first && !isMouseDown) setSelectedStartCell(getCellId(first));
        } else if (e.shiftKey) {
          updateRangeSelection(header);
          setIsMouseDown(true);
          return;
        }
      }

      setIsMouseDown(true);
    },
    [selectedCells, setSelectedCells, isMouseDown, excludeColumnId, updateRangeSelection, selectAll]
  );

  const handleCellMouseUp = useCallback(() => {
    setIsMouseDown(false);
  }, []);

  const handleCellMouseOver = useCallback(
    (e: React.MouseEvent<HTMLElement>, target: AnyCell | AnyHeader) => {
      if (!isMouseDown || !selectedStartCell) return;
      if (e.buttons === 1) {
        wasDraggingRef.current = true;
        updateRangeSelection(target);
      }
    },
    [isMouseDown, selectedStartCell, updateRangeSelection]
  );

  return {
    handleCellMouseDown,
    handleCellMouseUp,
    handleCellMouseOver,
    handleKeyDown,
    isCellSelected,
    isAllRowSelected,
    clearSelection,
    selectAll,
    wasDraggingRef,
  };
}
