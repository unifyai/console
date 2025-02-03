"use client";

import type { Cell, Header, Table } from "@tanstack/react-table";
import { useState } from "react";
import { useQueryState } from "nuqs";
import { parseAsArrayOf, parseAsString } from "nuqs";
import { getPartAfterFirstUnderscore } from "@/utils/evals/selection";

export type UseCellSelectionProps = {
  table: Table<any>;
  scrollToRow?: (index: number) => void;
  selectedCells: string[],
  setSelectedCells: (selectedCells: string[]) => void,
};

export const useCellSelection = ({
  table,
  scrollToRow,
  selectedCells,
  setSelectedCells
}: UseCellSelectionProps) => {

  const [selectedStartCell, setSelectedStartCell] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const allCells = table.getRowModel().rows.flatMap(row => row.getAllCells())
  const [expandedCells, setExpandedCells] = useState(
    Object.fromEntries(
      allCells.map(cell => [cell.id, false])
    )
  );
  const isCellExpanded = (cell: Cell<any, unknown>) => expandedCells[cell.id as keyof typeof expandedCells] === true

  /* Handle keyboard navigation */
  const handleCellsKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        navigateDown();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        navigateUp();
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        navigateLeft();
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        navigateRight();
        break;
      }
      case "Escape": {
        e.preventDefault();
        deselectAll();
        break;
      }
      case "Enter": {
        e.preventDefault();
        expandCellContent();
        break;
      }
    }
  };

  const deselectAll = () => setSelectedCells([])

  const toggleExpansion = (selectedCell: string) => {
    let newExpandedCells = { ...expandedCells }
    newExpandedCells = { ...newExpandedCells, [selectedCell]: !newExpandedCells[selectedCell] }
    setExpandedCells(newExpandedCells)
  }

  const getCellFromID = (cellID: string) => allCells.find(c => c.id === cellID)!

  const navigateUp = () => {

    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRowIndex = table
      .getRowModel()
      .rows.findIndex((row) => row.id === selectedCell.split("_").at(0));
    const nextRowIndex = selectedRowIndex - 1;
    // Add guard for negative row index
    if (nextRowIndex < 0) {
      console.warn("[Navigate] Previous row index is negative. No action taken.");
      return;
    }
    const previousRow = table.getRowModel().rows[nextRowIndex];

    // Check if entire row is selected (implies row index cell was clicked)
    const visibleLeafColumns = table.getVisibleLeafColumns().filter(col => col.id !== "RowNumbering");
    const visibleLeafColumnIds = visibleLeafColumns.map(col => col.id);
    const visibleSelectedCells = selectedCells.filter(cell => visibleLeafColumnIds.includes(getPartAfterFirstUnderscore(cell)));
    const isEntireRowSelected = visibleSelectedCells.length === visibleLeafColumns.length &&
      visibleSelectedCells.every(cell => cell.split("_")[0] === selectedCell.split("_")[0]);

    if (isEntireRowSelected) {
      const rowCells = previousRow.getAllCells();
      const validCells = rowCells.filter(c => isValidSelectionTarget(c));
      setSelectedCells(validCells.map(c => getCellSelectionData(c)));
      scrollToRow?.(nextRowIndex);
      return;
    }

    const previousCellId = getCellSelectionData(
      previousRow
        .getAllCells()
        .find((c) => c.column.id === getPartAfterFirstUnderscore(selectedCell))!
    )
    if (previousRow && isValidAdjacentTarget(getCellFromID(previousCellId))) {
      setSelectedCells([previousCellId]);
      scrollToRow?.(nextRowIndex);
      if (isCellExpanded(getCellFromID(selectedCell)))
        toggleExpansion(previousCellId);
    }
  };

  const navigateDown = () => {

    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRowIndex = table
      .getRowModel()
      .rows.findIndex((row) => row.id === selectedCell.split("_").at(0));
    const nextRowIndex = selectedRowIndex + 1;
    const nextRow = table.getRowModel().rows[nextRowIndex];
    
    // Check if entire row is selected (implies row index cell was clicked)
    const visibleLeafColumns = table.getVisibleLeafColumns().filter(col => col.id !== "RowNumbering");
    const visibleLeafColumnIds = visibleLeafColumns.map(col => col.id);
    const visibleSelectedCells = selectedCells.filter(cell => visibleLeafColumnIds.includes(getPartAfterFirstUnderscore(cell)));
    const isEntireRowSelected = visibleSelectedCells.length === visibleLeafColumns.length &&
      visibleSelectedCells.every(cell => cell.split("_")[0] === selectedCell.split("_")[0]);

    if (isEntireRowSelected && nextRow) {
      const rowCells = nextRow.getAllCells();
      const validCells = rowCells.filter(c => isValidSelectionTarget(c));
      setSelectedCells(validCells.map(c => getCellSelectionData(c)));
      scrollToRow?.(nextRowIndex);
      return;
    }

    const nextCellId = getCellSelectionData(
      nextRow
        .getAllCells()
        .find((c) => c.column.id === getPartAfterFirstUnderscore(selectedCell))!,
    );
    if (nextRow && isValidAdjacentTarget(getCellFromID(nextCellId))) {
      setSelectedCells([nextCellId]);
      scrollToRow?.(nextRowIndex);
      if (isCellExpanded(getCellFromID(selectedCell)))
        toggleExpansion(nextCellId);
    }
  };

  const navigateLeft = () => {

    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    // Check if entire row is selected (implies row index cell was clicked)
    const visibleLeafColumns = table.getVisibleLeafColumns().filter(col => col.id !== "RowNumbering");
    const visibleLeafColumnIds = visibleLeafColumns.map(col => col.id);
    const visibleSelectedCells = selectedCells.filter(cell => visibleLeafColumnIds.includes(getPartAfterFirstUnderscore(cell)));
    const isEntireRowSelected = visibleSelectedCells.length === visibleLeafColumns.length &&
      visibleSelectedCells.every(cell => cell.split("_")[0] === selectedCell.split("_")[0]);

    // Prevent navigation if entire row is selected (equivalent to being on row index cell)
    if (isEntireRowSelected) {
      return;
    }

    const selectedRow = table.getRow(selectedCell.split("_").at(0) as string);
    const selectedColumnIndex = selectedRow
      .getAllCells()
      .filter(cell => cell.column.getIsVisible())
      .findIndex((c) => c.id === selectedCell);
    const previousCell = selectedRow.getAllCells().filter(cell => cell.column.getIsVisible())[selectedColumnIndex - 1];
    if (previousCell && isValidSelectionTarget(previousCell)) {
      const previousCellId = getCellSelectionData(previousCell)
      setSelectedCells([previousCellId]);
      if (isCellExpanded(getCellFromID(selectedCell)))
        toggleExpansion(previousCellId);
    }
  };

  const navigateRight = () => {

    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRow = table.getRow(selectedCell.split("_").at(0) as string);
    
    // Check if entire row is selected (implies row index cell was clicked)
    const visibleLeafColumns = table.getVisibleLeafColumns().filter(col => col.id !== "RowNumbering");
    const visibleLeafColumnIds = visibleLeafColumns.map(col => col.id);
    const visibleSelectedCells = selectedCells.filter(cell => visibleLeafColumnIds.includes(getPartAfterFirstUnderscore(cell)));
    const isEntireRowSelected = visibleSelectedCells.length === visibleLeafColumns.length &&
      visibleSelectedCells.every(cell => cell.split("_")[0] === selectedCell.split("_")[0]);

    // If entire row is selected, select the first valid cell in the row
    if (isEntireRowSelected) {
      const rowCells = selectedRow.getAllCells();
      const firstValidCell = rowCells.find(c => isValidSelectionTarget(c));
      if (firstValidCell) {
        const nextCellId = getCellSelectionData(firstValidCell);
        setSelectedCells([nextCellId]);
      }
      return;
    }

    const selectedColumnIndex = selectedRow
      .getAllCells()
      .filter(cell => cell.column.getIsVisible())
      .findIndex((c) => c.id === selectedCell);
    const nextCell = selectedRow.getAllCells().filter(cell => cell.column.getIsVisible())[selectedColumnIndex + 1];
    if (nextCell && isValidSelectionTarget(nextCell)) {
      const nextCellId = getCellSelectionData(nextCell)
      setSelectedCells([nextCellId]);
      if (isCellExpanded(getCellFromID(selectedCell)))
        toggleExpansion(nextCellId);
    }
  };

  const expandCellContent = () => {

    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const cell = allCells.find(c =>
      c.column.id === getPartAfterFirstUnderscore(selectedCell) &&
      c.row.id === selectedCell.split("_")[0]
    )!;
    if (isValidSelectionTarget(cell))
      toggleExpansion(selectedCell);
  }

  /* Handle click selection */
  const isRowSelected = (rowId: string) =>
    selectedCells.find((c) => c.split("_").at(0) === rowId) !== undefined;

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
    if ("row" in target) {
      const cell = target as Cell<any, any>
      if (isRowIndexCell(cell)) {
        const rowCells = cell.row.getAllCells()
        const validCells = rowCells.filter(c => isValidSelectionTarget(c));
        const lastCell = validCells.at(-1)
        if (lastCell)
          selectedEndCell = getCellSelectionData(lastCell);
      }
      else if (isValidSelectionTarget(cell))
        selectedEndCell = getCellSelectionData(cell)
    }
    else if ("depth" in target) {
      const header = target as Header<any, any>
      const columnCells = getCellsFromHeader(header);
      const validCells = columnCells.filter(c => isValidSelectionTarget(c));
      const lastCell = validCells.at(-1);
      if (lastCell)
        selectedEndCell = getCellSelectionData(lastCell);
    }

    // Compute selection range and update selected cells, filtering out non-valid selection targets
    const selectedCellsInRange = getCellsBetween(table, selectedStartCell, selectedEndCell) as string[];
    const validTableCellsIds = table.getRowModel().rows.flatMap(row =>
      row.getAllCells().filter(c =>
        isValidSelectionTarget(c)).map(c => c.id)
    )
    const startIndex = selectedCells.findIndex(
      (c) => c === selectedStartCell,
    );
    const prevSelectedCells = selectedCells.slice(0, startIndex);
    const newCellSelection = selectedCellsInRange.filter((c) =>
      c !== selectedStartCell && validTableCellsIds.includes(c),
    );
    setSelectedCells([...prevSelectedCells, selectedStartCell, ...newCellSelection]);
  };

  const isValidAdjacentTarget = (cell: Cell<any, any>) =>
    !cell.getIsPlaceholder() &&
    !cell.getIsAggregated() &&
    !cell.getIsGrouped() &&
    cell.column.getIsVisible()
  const isValidSelectionTarget = (cell: Cell<any, any>) => isValidAdjacentTarget(cell) && cell.column.id != "RowNumbering";

  const isRowIndexCell = (cell: Cell<any, any>) => cell.column.id === "RowNumbering"

  const handleCellMouseDown = (
    e: React.MouseEvent<HTMLElement>,
    target: Cell<any, any> | Header<any, any>
  ) => {

    /* Handle cell click */
    if ("row" in target) {

      const cell = target as Cell<any, any>;

      // If grouped, placeholder, or aggregated cell, do nothing
      if (!isValidAdjacentTarget(cell)) return;

      // Simple click:
      // - Select / deselect all row cells when clicking on index cell, if the row has any cell, or
      // - Select single cell, or deselect all if clicking on a selected cell
      if (!e.ctrlKey && !e.shiftKey) {
        let selectedStartCell = getCellSelectionData(cell)
        if (isRowIndexCell(cell)) {
          const rowCells = cell.row.getAllCells();
          const validCells = rowCells.filter(c => isValidSelectionTarget(c));
          const firstCell = validCells.at(0);
          if (firstCell) {
            selectedStartCell = getCellSelectionData(firstCell)
            setSelectedCells(
              validCells.every(c => selectedCells.includes(c.id))
                ? []
                : validCells.map(c => getCellSelectionData(c))
            )
          }
        } else {
          setSelectedCells(selectedCells.find((c) => c === cell.id) !== undefined
            ? []
            : [getCellSelectionData(cell)]
          );
        }
        if (!isMouseDown) {
          setSelectedStartCell(selectedStartCell);
        }
      }

      // Ctrl click:
      // - Append /remove all row cells when clicking on index cell, if row has any cell, or
      // - Append single cell, or desect it if already selected
      if (e.ctrlKey) {
        let selectedStartCell = getCellSelectionData(cell)
        if (isRowIndexCell(cell)) {
          const rowCells = cell.row.getAllCells();
          const validCells = rowCells.filter(c => isValidSelectionTarget(c));
          const firstCell = validCells.at(0);
          if (firstCell) {
            selectedStartCell = getCellSelectionData(firstCell)
            setSelectedCells(
              validCells.every(c => selectedCells.includes(c.id))
                ? selectedCells.filter(c => !validCells.map(c => c.id).includes(c))
                : [...selectedCells, ...validCells.map(c => getCellSelectionData(c))]
            )
          }
        } else {
          setSelectedCells(
            selectedCells.find((c) => c === cell.id) !== undefined
              ? selectedCells.filter((cellId) => cellId !== cell.id)
              : [...selectedCells, getCellSelectionData(cell)],
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

    }

    /* Handle header click */
    else if ("depth" in target) {

      const header = target as Header<any, any>

      // Sets valid cells for selection. Applies to all columns if clicking on index column header
      const columnCells = header.column.id === "RowNumbering" ? getSelectableTableCells(table) : getCellsFromHeader(header)
      const validCells = columnCells.filter(c => isValidSelectionTarget(c))

      // Select cells if the column has any, otherwise do nothing
      if (validCells.length) {

        const firstCell = validCells.at(0) as Cell<any, any>;

        // Simple click: Select all leaf columns cells when clicking
        if (!e.ctrlKey && !e.shiftKey) {
          setSelectedCells(
            validCells.every(c => selectedCells.includes(c.id))
              ? []
              : validCells.map(c => getCellSelectionData(c))
          )
          if (!isMouseDown) {
            setSelectedStartCell(getCellSelectionData(firstCell));
          }
        }

        // Ctrl click: Append all column leaf cells when clicking on index cell
        if (e.ctrlKey) {
          setSelectedCells(
            validCells.every(c => selectedCells.includes(c.id))
              ? selectedCells.filter(c => !validCells.map(c => c.id).includes(c))
              : [...selectedCells, ...validCells.map(c => getCellSelectionData(c))]
          )
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
    _tagrget: Cell<any, any> | Header<any, any>,
  ) => {
    if (!e.shiftKey) {
    }

    setIsMouseDown(false);
  };

  const handleCellMouseOver = (
    e: React.MouseEvent<HTMLElement>,
    target: Cell<any, any> | Header<any, any>,
  ) => {
    if (e.buttons !== 1) return;

    if (isMouseDown) {
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
    setExpandedCells
  };
};

const getCellSelectionData = (cell: Cell<any, any>) => cell.id;

const getSelectedCellTableData = (table: Table<any>, cell: string) => {
  const row = table.getRow(cell.split("_").at(0) as string);
  return row.getAllCells().find((c) => c.id === cell);
};

const getCellsBetween = (
  table: Table<any>,
  cell1: string,
  cell2: string,
) => {
  const cell1Data = getSelectedCellTableData(table, cell1);
  const cell2Data = getSelectedCellTableData(table, cell2);
  if (!cell1Data || !cell2Data) return [];

  const rows = table.getRowModel().rows;

  const cell1RowIndex = rows.findIndex(({ id }) => id === cell1Data.row.id);
  const cell2RowIndex = rows.findIndex(({ id }) => id === cell2Data.row.id);

  const cell1ColumnIndex = cell1Data.column.getIndex();
  const cell2ColumnIndex = cell2Data.column.getIndex();

  const selectedRows = rows.slice(
    Math.min(cell1RowIndex, cell2RowIndex),
    Math.max(cell1RowIndex, cell2RowIndex) + 1,
  );

  const columns = table
    .getAllLeafColumns()
    .filter(column => column.getIsVisible())
    .slice(
      Math.min(cell1ColumnIndex, cell2ColumnIndex),
      Math.max(cell1ColumnIndex, cell2ColumnIndex) + 1,
    );

  return selectedRows.flatMap((row) =>
    columns.map((column) => {
      const tableCell = row
        .getAllCells()
        .find((cell) => cell.column.id === column.id);
      if (!tableCell) return null;
      return getCellSelectionData(tableCell);
    }),
  );
};

export const getCellsFromHeader = (header: Header<any, any>) => {
  const leafColumns = header.column.getLeafColumns().map(col => col.id)
  const tableCells = header.getContext().table.getRowModel().rows.flatMap(row => row.getAllCells())
  const columnCells = tableCells.filter(cell => leafColumns.includes(cell.column.id))
  return columnCells
}

export const getSelectableTableCells = (table: Table<any | unknown>) => {
  const headers = table.getLeafHeaders().filter(h => !h.column.getIsGrouped() && h.column.id != "RowNumbering")
  const columnCells = headers.flatMap(h => getCellsFromHeader(h))
  return Array.from(new Set(columnCells))
}

/* 
  Original Hook: 
  https://gist.github.com/joshkay/fc8bab0561583dd48fecce93022fc7a2#file-usecellselection-ts-L343
*/
