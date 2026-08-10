'use client';

import type { Column, Cell, Header, Table } from '@tanstack/react-table';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useQueryState } from 'nuqs';
import { parseAsArrayOf, parseAsString } from 'nuqs';
import { getPartAfterFirstUnderscore } from '@/utils/interfaces/selection/selection';
import { isImeComposing } from '@/utils/keyboard';

export type UseCellSelectionProps = {
  table: Table<any>;
  selectedCells: string[];
  setSelectedCells: (selectedCells: string[]) => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>; // The element that actually scrolls
  tableHeaderRef?: React.RefObject<HTMLElement | null>; // The <thead> element
  tableFooterRef?: React.RefObject<HTMLElement | null>; // The <tfoot> element
};

const isNotUndefinedCell = (cell: Cell<any, any>) =>
  cell.getValue() !== undefined || cell.column.id === 'RowNumbering';
const isValidAdjacentTarget = (cell: Cell<any, any>) =>
  !cell.getIsPlaceholder() && !cell.getIsAggregated() && isNotUndefinedCell(cell);
const isVisibleCell = (cell: Cell<any, any>) => cell.column.getIsVisible();
const isValidIndexSelectionTarget = (cell: Cell<any, any>) =>
  isValidAdjacentTarget(cell) && cell.column.id != 'RowNumbering';
const isValidSelectionTarget = (cell: Cell<any, any>) =>
  isValidIndexSelectionTarget(cell) && isVisibleCell(cell);
const isRowIndexCell = (cell: Cell<any, any>) => cell.column.id === 'RowNumbering';

export const useCellSelection = ({
  table,
  selectedCells,
  setSelectedCells,
  scrollContainerRef,
  tableHeaderRef,
  tableFooterRef,
}: UseCellSelectionProps) => {
  const [selectedStartCell, setSelectedStartCell] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const allCells = table.getRowModel().rows.flatMap((row) => row.getAllCells());
  const [expandedCells, setExpandedCells] = useState(
    Object.fromEntries(allCells.map((cell) => [cell.id, false]))
  );
  const isCellExpanded = (cell: Cell<any, unknown>) =>
    expandedCells[cell.id as keyof typeof expandedCells] === true;

  // --- Auto-scroll logic ---
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollSpeedRef = useRef<number>(100);
  const edgeThresholdRef = useRef<number>(50); // Pixels from edge (header bottom / footer top)

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
      scrollDirectionRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(
    (direction: 'up' | 'down') => {
      stopAutoScroll(); // Ensure only one interval runs
      scrollDirectionRef.current = direction;

      const scrollContainer = scrollContainerRef?.current;
      if (!scrollContainer) return;

      scrollIntervalRef.current = setInterval(() => {
        const amount = scrollSpeedRef.current * (direction === 'up' ? -1 : 1);
        // Only scroll if there's room
        if (direction === 'up' && scrollContainer.scrollTop > 0) {
          scrollContainer.scrollTop += amount;
        } else if (
          direction === 'down' &&
          scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight
        ) {
          scrollContainer.scrollTop += amount;
        } else {
          // Stop if we hit the edge
          stopAutoScroll();
        }
      }, 50); // Adjust interval timing (ms) as needed
    },
    [scrollContainerRef, stopAutoScroll]
  );

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      stopAutoScroll();
    };
  }, [stopAutoScroll]);

  // --- Keyboard scroll logic ---
  const scrollToRow = useCallback(
    (index: number) => {
      const rowModel = table.getRowModel();
      const targetRow = rowModel.rows[index];
      if (!targetRow) {
        console.warn(`[DataTable] No row found at index ${index}.`);
        return;
      }

      const scrollContainer = scrollContainerRef?.current;
      if (!scrollContainer) return;

      const targetRowElement = scrollContainer.querySelector(
        `tr[data-row-id="${targetRow.id}"]`
      ) as HTMLElement;
      if (!targetRowElement) {
        console.warn(`[DataTable] Could not find DOM element for row with id ${targetRow.id}.`);
        return;
      }

      targetRowElement.scrollIntoView({
        block: 'nearest',
        behavior: 'auto',
      });
    },
    [scrollContainerRef, table]
  );

  const scrollToColumn = useCallback(
    (columnId: string) => {
      const scrollContainer = scrollContainerRef?.current;
      if (!scrollContainer) return;

      const headerElement = scrollContainer.querySelector(
        `th[data-column-id="${columnId}"]`
      ) as HTMLElement;
      if (!headerElement) {
        console.warn(`[DataTable] Could not find header element for column id ${columnId}.`);
        return;
      }

      headerElement.scrollIntoView({
        inline: 'nearest',
        behavior: 'auto',
      });
    },
    [scrollContainerRef]
  );

  /* Handle keyboard navigation */
  const handleCellsKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // An IME committing a conversion inside a cell editor must not be read as
    // grid navigation (Enter would expand the cell mid-word).
    if (isImeComposing(e)) return;
    const target = e.target as HTMLElement;
    if (
      (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
    ) {
      e.stopPropagation();
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        navigateDown();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        navigateUp();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        navigateLeft();
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        navigateRight();
        break;
      }
      case 'Escape': {
        e.preventDefault();
        deselectAll();
        break;
      }
      case 'Enter': {
        e.preventDefault();
        expandCellContent();
        break;
      }
    }
  };

  const deselectAll = () => setSelectedCells([]);

  const toggleExpansion = (selectedCell: string) => {
    let newExpandedCells = { ...expandedCells };
    newExpandedCells = { ...newExpandedCells, [selectedCell]: !newExpandedCells[selectedCell] };
    setExpandedCells(newExpandedCells);
  };

  const getCellFromID = (cellID: string) => allCells.find((c) => c.id === cellID)!;

  const navigateUp = () => {
    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRowIndex = table
      .getRowModel()
      .rows.findIndex((row) => row.id === selectedCell.split('_').at(0));
    const nextRowIndex = selectedRowIndex - 1;
    // Add guard for negative row index
    if (nextRowIndex < 0) {
      console.warn('[Navigate] Previous row index is negative. No action taken.');
      return;
    }
    const previousRow = table.getRowModel().rows[nextRowIndex];

    // Check if entire row is selected (implies row index cell was clicked)
    const leafColumns = table
      .getAllLeafColumns()
      .filter((col) => col.id !== 'RowNumbering' && !col.getIsGrouped());
    const leafColumnIds = leafColumns.map((col) => col.id);
    const selected = selectedCells.filter((cell) =>
      leafColumnIds.includes(getPartAfterFirstUnderscore(cell))
    );
    const isEntireRowSelected =
      selected.length === leafColumns.length &&
      selected.every((cell) => cell.split('_')[0] === selectedCell.split('_')[0]);

    if (isEntireRowSelected) {
      const rowCells = previousRow.getAllCells();
      const validCells = rowCells.filter((c) => isValidIndexSelectionTarget(c));
      setSelectedCells(validCells.map((c) => getCellSelectionData(c)));
      scrollToRow?.(nextRowIndex - 2);
      return;
    }

    const previousCellId = getCellSelectionData(
      previousRow
        .getAllCells()
        .find((c) => c.column.id === getPartAfterFirstUnderscore(selectedCell))!
    );
    if (previousRow && isValidAdjacentTarget(getCellFromID(previousCellId))) {
      setSelectedCells([previousCellId]);
      scrollToRow?.(nextRowIndex - 2);
      if (isCellExpanded(getCellFromID(selectedCell))) toggleExpansion(previousCellId);
    }
  };

  const navigateDown = () => {
    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRowIndex = table
      .getRowModel()
      .rows.findIndex((row) => row.id === selectedCell.split('_').at(0));
    const nextRowIndex = selectedRowIndex + 1;
    const nextRow = table.getRowModel().rows[nextRowIndex];

    // Check if entire row is selected (implies row index cell was clicked)
    const leafColumns = table
      .getAllLeafColumns()
      .filter((col) => col.id !== 'RowNumbering' && !col.getIsGrouped());
    const leafColumnIds = leafColumns.map((col) => col.id);
    const selected = selectedCells.filter((cell) =>
      leafColumnIds.includes(getPartAfterFirstUnderscore(cell))
    );
    const isEntireRowSelected =
      selected.length === leafColumns.length &&
      selected.every((cell) => cell.split('_')[0] === selectedCell.split('_')[0]);

    if (isEntireRowSelected && nextRow) {
      const rowCells = nextRow.getAllCells();
      const validCells = rowCells.filter((c) => isValidIndexSelectionTarget(c));
      setSelectedCells(validCells.map((c) => getCellSelectionData(c)));
      scrollToRow?.(nextRowIndex + 2);
      return;
    }

    const nextCellId = getCellSelectionData(
      nextRow.getAllCells().find((c) => c.column.id === getPartAfterFirstUnderscore(selectedCell))!
    );
    if (nextRow && isValidAdjacentTarget(getCellFromID(nextCellId))) {
      setSelectedCells([nextCellId]);
      scrollToRow?.(nextRowIndex + 2);
      if (isCellExpanded(getCellFromID(selectedCell))) toggleExpansion(nextCellId);
    }
  };

  const navigateLeft = () => {
    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    // Check if entire row is selected (implies row index cell was clicked)
    const visibleLeafColumns = table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== 'RowNumbering');
    const visibleLeafColumnIds = visibleLeafColumns.map((col) => col.id);
    const visibleSelectedCells = selectedCells.filter((cell) =>
      visibleLeafColumnIds.includes(getPartAfterFirstUnderscore(cell))
    );
    const isEntireRowSelected =
      visibleSelectedCells.length === visibleLeafColumns.length &&
      visibleSelectedCells.every((cell) => cell.split('_')[0] === selectedCell.split('_')[0]);

    // Prevent navigation if entire row is selected (equivalent to being on row index cell)
    if (isEntireRowSelected) {
      return;
    }

    const selectedRow = table.getRow(selectedCell.split('_').at(0) as string);
    const selectedColumnIndex = selectedRow
      .getAllCells()
      .filter((cell) => cell.column.getIsVisible())
      .findIndex((c) => c.id === selectedCell);
    const previousCell = selectedRow.getAllCells().filter((cell) => cell.column.getIsVisible())[
      selectedColumnIndex - 1
    ];
    if (previousCell && isValidSelectionTarget(previousCell)) {
      const previousCellId = getCellSelectionData(previousCell);
      setSelectedCells([previousCellId]);
      scrollToColumn?.(previousCell.column.id);
      if (isCellExpanded(getCellFromID(selectedCell))) toggleExpansion(previousCellId);
    }
  };

  const navigateRight = () => {
    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRow = table.getRow(selectedCell.split('_').at(0) as string);

    // Check if entire row is selected (implies row index cell was clicked)
    const visibleLeafColumns = table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== 'RowNumbering');
    const visibleLeafColumnIds = visibleLeafColumns.map((col) => col.id);
    const visibleSelectedCells = selectedCells.filter((cell) =>
      visibleLeafColumnIds.includes(getPartAfterFirstUnderscore(cell))
    );
    const isEntireRowSelected =
      visibleSelectedCells.length === visibleLeafColumns.length &&
      visibleSelectedCells.every((cell) => cell.split('_')[0] === selectedCell.split('_')[0]);

    // If entire row is selected, select the first valid cell in the row
    if (isEntireRowSelected) {
      const rowCells = selectedRow.getAllCells();
      const firstValidCell = rowCells.find((c) => isValidSelectionTarget(c));
      if (firstValidCell) {
        const nextCellId = getCellSelectionData(firstValidCell);
        setSelectedCells([nextCellId]);
        scrollToColumn?.(firstValidCell.column.id);
      }
      return;
    }

    const selectedColumnIndex = selectedRow
      .getAllCells()
      .filter((cell) => cell.column.getIsVisible())
      .findIndex((c) => c.id === selectedCell);
    const nextCell = selectedRow.getAllCells().filter((cell) => cell.column.getIsVisible())[
      selectedColumnIndex + 1
    ];
    if (nextCell && isValidSelectionTarget(nextCell)) {
      const nextCellId = getCellSelectionData(nextCell);
      setSelectedCells([nextCellId]);
      scrollToColumn?.(nextCell.column.id);
      if (isCellExpanded(getCellFromID(selectedCell))) toggleExpansion(nextCellId);
    }
  };

  const expandCellContent = () => {
    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const cell = allCells.find(
      (c) =>
        c.column.id === getPartAfterFirstUnderscore(selectedCell) &&
        c.row.id === selectedCell.split('_')[0]
    )!;
    if (isValidSelectionTarget(cell)) toggleExpansion(selectedCell);
  };

  /* Handle click selection */
  const isRowSelected = (rowId: string) =>
    selectedCells.find((c) => c.split('_').at(0) === rowId) !== undefined;

  const isCellSelected = (cell: Cell<any, any>) =>
    selectedCells.find((c) => c === cell.id) !== undefined;

  const updateRangeSelection = (target: Cell<any, any> | Header<any, any>) => {
    if (!selectedStartCell) {
      return;
    }

    // Define end of range cell as:
    // - the last cell of a row if the cell being dragged over is an index cell, or
    // - the last cell of the last leaf column if the cell being dragged over is a header, or
    // - the cell being dragged over otherwise
    let selectedEndCell = selectedStartCell;
    if ('row' in target) {
      const cell = target as Cell<any, any>;
      if (isRowIndexCell(cell)) {
        const startRowId = selectedStartCell.split('_')[0];
        const endRowId = (target as Cell<any, any>).row.id;
        const rows = table.getRowModel().rows;
        const startIdx = rows.findIndex((r) => r.id === startRowId);
        const endIdx = rows.findIndex((r) => r.id === endRowId);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          // Gather all valid index-selection targets (includes hidden)
          const newSelection = rows.slice(from, to + 1).flatMap((row) =>
            row
              .getAllCells()
              .filter((c) => isValidIndexSelectionTarget(c))
              .map((c) => getCellSelectionData(c))
          );
          setSelectedCells(newSelection);
        }
        return;
      } else if (isValidSelectionTarget(cell)) selectedEndCell = getCellSelectionData(cell);
    } else if ('depth' in target) {
      const header = target as Header<any, any>;
      const columnCells = getCellsFromHeader(header);
      const validCells = columnCells.filter((c) => isValidSelectionTarget(c));
      const lastCell = validCells.at(-1);
      if (lastCell) selectedEndCell = getCellSelectionData(lastCell);
    }

    // Compute selection range and update selected cells, filtering out non-valid selection targets
    const selectedCellsInRange = getCellsBetween(
      table,
      selectedStartCell,
      selectedEndCell
    ) as string[];
    const validTableCellsIds = table.getRowModel().rows.flatMap((row) =>
      row
        .getAllCells()
        .filter((c) => isValidSelectionTarget(c))
        .map((c) => c.id)
    );
    const startIndex = selectedCells.findIndex((c) => c === selectedStartCell);
    const prevSelectedCells = selectedCells.slice(0, startIndex);
    const newCellSelection = selectedCellsInRange.filter(
      (c) => c !== selectedStartCell && validTableCellsIds.includes(c)
    );
    setSelectedCells([...prevSelectedCells, selectedStartCell, ...newCellSelection]);
  };

  const handleCellMouseDown = (
    e: React.MouseEvent<HTMLElement>,
    target: Cell<any, any> | Header<any, any>
  ) => {
    /* Handle cell click */
    if ('row' in target) {
      const cell = target as Cell<any, any>;

      // If grouped, placeholder, or aggregated cell, do nothing
      if (!isValidAdjacentTarget(cell)) return;

      // Simple click:
      // - Select / deselect all row cells when clicking on index cell, if the row has any cell, or
      // - Select single cell, or deselect all if clicking on a selected cell
      if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
        let selectedStartCell = getCellSelectionData(cell);
        if (isRowIndexCell(cell)) {
          const rowCells = cell.row.getAllCells();
          const validCells = rowCells.filter((c) => isValidIndexSelectionTarget(c));
          const firstCell = validCells.at(0);
          if (firstCell) {
            selectedStartCell = getCellSelectionData(firstCell);
            setSelectedCells(
              validCells.every((c) => selectedCells.includes(c.id))
                ? []
                : validCells.map((c) => getCellSelectionData(c))
            );
          }
        } else {
          setSelectedCells(
            selectedCells.find((c) => c === cell.id) !== undefined
              ? []
              : [getCellSelectionData(cell)]
          );
        }
        if (!isMouseDown) {
          setSelectedStartCell(selectedStartCell);
        }
      }

      // Ctrl (Cmd for Macs) click:
      // - Append /remove all row cells when clicking on index cell, if row has any cell, or
      // - Append single cell, or desect it if already selected
      if (e.ctrlKey || e.metaKey) {
        let selectedStartCell = getCellSelectionData(cell);
        if (isRowIndexCell(cell)) {
          const rowCells = cell.row.getAllCells();
          const validCells = rowCells.filter((c) => isValidIndexSelectionTarget(c));
          const firstCell = validCells.at(0);
          if (firstCell) {
            selectedStartCell = getCellSelectionData(firstCell);
            setSelectedCells(
              validCells.every((c) => selectedCells.includes(c.id))
                ? selectedCells.filter((c) => !validCells.map((c) => c.id).includes(c))
                : [...selectedCells, ...validCells.map((c) => getCellSelectionData(c))]
            );
          }
        } else {
          setSelectedCells(
            selectedCells.find((c) => c === cell.id) !== undefined
              ? selectedCells.filter((cellId) => cellId !== cell.id)
              : [...selectedCells, getCellSelectionData(cell)]
          );
        }
        if (!isMouseDown) {
          setSelectedStartCell(selectedStartCell);
        }
      }

      // Shift click: Select a cell range
      if (e.shiftKey) {
        updateRangeSelection(cell);
      }
    } else if ('depth' in target) {
      /* Handle header click */
      const header = target as Header<any, any>;

      // Sets valid cells for selection. Applies to all columns if clicking on index column header
      const columnCells =
        header.column.id === 'RowNumbering'
          ? getSelectableTableCells(table)
          : getCellsFromHeader(header);
      const validCells = columnCells.filter((c) => isValidSelectionTarget(c));

      // Select cells if the column has any, otherwise do nothing
      if (validCells.length) {
        const firstCell = validCells.at(0) as Cell<any, any>;

        // Simple click: Select all leaf columns cells when clicking
        if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
          setSelectedCells(
            validCells.every((c) => selectedCells.includes(c.id))
              ? []
              : validCells.map((c) => getCellSelectionData(c))
          );
          if (!isMouseDown) {
            setSelectedStartCell(getCellSelectionData(firstCell));
          }
        }

        // Ctrl (Cmd for Macs) click: Append all column leaf cells when clicking on index cell
        if (e.ctrlKey || e.metaKey) {
          setSelectedCells(
            validCells.every((c) => selectedCells.includes(c.id))
              ? selectedCells.filter((c) => !validCells.map((c) => c.id).includes(c))
              : [...selectedCells, ...validCells.map((c) => getCellSelectionData(c))]
          );
          if (!isMouseDown) {
            setSelectedStartCell(getCellSelectionData(firstCell));
          }
        }

        // Shift click: Select a cell range
        if (e.shiftKey) {
          updateRangeSelection(header);
        }
      }
    }

    setIsMouseDown(true);
  };

  const handleCellMouseUp = (
    e: React.MouseEvent<HTMLElement>,
    _tagrget: Cell<any, any> | Header<any, any>
  ) => {
    setIsMouseDown(false);
    stopAutoScroll();
  };

  const handleCellMouseOver = (
    e: React.MouseEvent<HTMLElement>,
    target: Cell<any, any> | Header<any, any>
  ) => {
    if (!isMouseDown) {
      stopAutoScroll(); // Stop scroll if mouse button is released elsewhere
      return;
    }

    // --- Auto-scroll logic ---
    const scrollContainer = scrollContainerRef?.current;
    const tableHeader = tableHeaderRef?.current;
    const tableFooter = tableFooterRef?.current;

    // Need all refs to calculate boundaries correctly
    if (scrollContainer && tableHeader && tableFooter) {
      const containerRect = scrollContainer.getBoundingClientRect(); // Viewport rect of the scrollable area
      const headerRect = tableHeader.getBoundingClientRect(); // Viewport rect of the sticky header
      const footerRect = tableFooter.getBoundingClientRect(); // Viewport rect of the sticky footer
      const mouseY = e.clientY; // Mouse position relative to viewport
      const edgeThreshold = edgeThresholdRef.current;

      // --- Define trigger zones based on VISIBLE edges within the scroll container ---

      // Top Zone: Below the header's bottom edge, within the threshold
      const topEdgeZoneLimit = headerRect.bottom + edgeThreshold;
      // Bottom Zone: Above the footer's top edge, within the threshold
      const bottomEdgeZoneLimit = footerRect.top - edgeThreshold;

      // --- Check if cursor is within the calculated trigger zones ---

      // Check for UP scroll trigger:
      // Mouse MUST be below the header bottom.
      // Mouse MUST be within the threshold distance below the header bottom.
      // Mouse MUST also be within the scroll container's visible top boundary (prevents triggering if header is scrolled way up)
      if (mouseY > headerRect.bottom && mouseY < topEdgeZoneLimit && mouseY > containerRect.top) {
        // Check if container can scroll up and we aren't already scrolling up
        if (scrollContainer.scrollTop > 0 && scrollDirectionRef.current !== 'up') {
          // console.log(`Scroll UP Trigger: mouseY=${mouseY.toFixed(0)}, headerBottom=${headerRect.bottom.toFixed(0)}, topZoneLimit=${topEdgeZoneLimit.toFixed(0)}`);
          startAutoScroll('up');
        } else if (scrollContainer.scrollTop <= 0) {
          stopAutoScroll(); // Stop if we hit the top
        }
      }
      // Check for DOWN scroll trigger:
      // Mouse MUST be above the footer top.
      // Mouse MUST be within the threshold distance above the footer top.
      // Mouse MUST also be within the scroll container's visible bottom boundary (prevents triggering if footer is scrolled way down)
      else if (
        mouseY < footerRect.top &&
        mouseY > bottomEdgeZoneLimit &&
        mouseY < containerRect.bottom
      ) {
        // Check if container can scroll down and we aren't already scrolling down
        const canScrollDown =
          scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (canScrollDown && scrollDirectionRef.current !== 'down') {
          // console.log(`Scroll DOWN Trigger: mouseY=${mouseY.toFixed(0)}, footerTop=${footerRect.top.toFixed(0)}, bottomZoneLimit=${bottomEdgeZoneLimit.toFixed(0)}`);
          startAutoScroll('down');
        } else if (!canScrollDown) {
          stopAutoScroll(); // Stop if we hit the bottom
        }
      }
      // Cursor is not in a trigger zone
      else {
        stopAutoScroll();
      }
    } else {
      // One or more refs are missing, stop scrolling
      stopAutoScroll();
    }

    // --- Range selection update (only if mouse is down and start cell exists) ---
    if (e.buttons === 1 && selectedStartCell) {
      updateRangeSelection(target);
    }
  };

  return {
    handleCellMouseDown,
    handleCellMouseUp,
    handleCellMouseOver,
    handleCellsKeyDown,
    isCellSelected,
    isRowSelected,
    isCellExpanded,
    setExpandedCells,
  };
};

const getCellSelectionData = (cell: Cell<any, any>) => cell.id;

const getSelectedCellTableData = (table: Table<any>, cell: string) => {
  const row = table.getRow(cell.split('_').at(0) as string);
  return row.getAllCells().find((c) => c.id === cell);
};

const getCellsBetween = (table: Table<any>, cell1: string, cell2: string) => {
  const cell1Data = getSelectedCellTableData(table, cell1);
  const cell2Data = getSelectedCellTableData(table, cell2);
  if (!cell1Data || !cell2Data) return [];

  const rows = table.getRowModel().rows;

  const cell1RowIndex = rows.findIndex(({ id }) => id === cell1Data.row.id);
  const cell2RowIndex = rows.findIndex(({ id }) => id === cell2Data.row.id);
  const selectedRows = rows.slice(
    Math.min(cell1RowIndex, cell2RowIndex),
    Math.max(cell1RowIndex, cell2RowIndex) + 1
  );

  let cell1ColumnIndex = cell1Data.column.getIndex();
  let cell2ColumnIndex = cell2Data.column.getIndex();
  let columns: Column<any, unknown>[];
  if (cell2ColumnIndex < 0) {
    cell1ColumnIndex = 0;
    cell2ColumnIndex = rows[0].getAllCells().length;
    columns = table
      .getAllLeafColumns()
      .slice(
        Math.min(cell1ColumnIndex, cell2ColumnIndex),
        Math.max(cell1ColumnIndex, cell2ColumnIndex) + 1
      );
  } else {
    columns = table
      .getAllLeafColumns()
      .filter((column) => column.getIsVisible())
      .slice(
        Math.min(cell1ColumnIndex, cell2ColumnIndex),
        Math.max(cell1ColumnIndex, cell2ColumnIndex) + 1
      );
  }

  return selectedRows.flatMap((row) =>
    columns.map((column) => {
      const tableCell = row.getAllCells().find((cell) => cell.column.id === column.id);
      if (!tableCell) return null;
      return getCellSelectionData(tableCell);
    })
  );
};

export const getCellsFromHeader = (header: Header<any, any>) => {
  const leafColumns = header.column.getLeafColumns().map((col) => col.id);
  const tableCells = header
    .getContext()
    .table.getRowModel()
    .rows.flatMap((row) => row.getAllCells());
  const columnCells = tableCells.filter((cell) => leafColumns.includes(cell.column.id));
  return columnCells;
};

export const getSelectableTableCells = (table: Table<any | unknown>) => {
  const headers = table
    .getLeafHeaders()
    .filter((h) => !h.column.getIsGrouped() && h.column.id != 'RowNumbering');
  const columnCells = headers
    .flatMap((h) => getCellsFromHeader(h))
    .filter((cell) => isNotUndefinedCell(cell));
  return Array.from(new Set(columnCells));
};

export const deselectFromClickOutside = (
  event: React.MouseEvent<HTMLElement, MouseEvent>,
  containerRef: React.RefObject<HTMLDivElement>,
  selectedCells: string[],
  setSelected: (selected: string | undefined) => void,
  customClasses: string[] = []
) => {
  const target = event.target as Node;
  const containerElement = containerRef.current;

  // Ensure refs and target are valid
  if (!containerElement || !target || !(target instanceof Element)) {
    return;
  }

  // Selector for elements that should PREVENT deselection
  // This includes active interactive elements AND table data cells (td)
  const keepSelectionSelector = [
    // === Interactive Widgets & Inputs ===
    '[role="menu"]', // Radix/Shadcn Menus (the container)
    '[role="menuitem"]', // Radix/Shadcn Menu items
    '[role="menuitemcheckbox"]', // Radix/Shadcn Menu checkbox items
    '[role="menuitemradio"]', // Radix/Shadcn Menu radio items
    '[role="dialog"]', // Radix/Shadcn Dialogs
    '[role="alertdialog"]', // Radix/Shadcn Alert Dialogs
    '[data-radix-popper-content]', // Radix general popper content (covers menus, selects, dialogs etc.)
    'input', // Standard inputs
    'textarea', // Text areas
    'select', // Select dropdowns (native)
    'option', // Options within native select

    // === Table Specific Elements ===
    'tbody td', // Allow clicks on table DATA cells (let DataTable handle selection)
    'thead th', // Note: Excludes tfoot td (footer)

    // === Specific Interactive Components by Class/Attribute (Examples) ===
    // Add classes/ids if specific buttons/links should NOT deselect
    // e.g., '.keep-selection-button', '[data-keep-selection="true"]'
    [
      ...customClasses.map((customClass) =>
        customClass.startsWith('.') ? customClass : `.${customClass}`
      ),
    ],
  ].join(', ');

  // 1. Check if the click is on or inside an element that should PREVENT deselection
  if (target.closest(keepSelectionSelector)) {
    return; // Keep selection / Let the element handle its own logic
  }

  // 2. If not prevented by the check above, and the click is inside the main container, DESELECT.
  if (containerElement.contains(target)) {
    if (selectedCells.length > 0) {
      setSelected('');
    }
  }
  // Clicks outside the container are ignored
};
