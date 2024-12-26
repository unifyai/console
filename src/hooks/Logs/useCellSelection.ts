"use client";

import type { Cell, Header, Table } from "@tanstack/react-table";
import { useState } from "react";
import { useQueryState } from "nuqs";
import { parseAsArrayOf, parseAsString } from "nuqs";
import { getPartAfterFirstUnderscore } from "@/utils/evals/selection";

export type UseCellSelectionProps = {
  table: Table<any>;
  scrollToRow?: (index: number) => void;
};

export const useCellSelection = ({
  table,
  scrollToRow,
}: UseCellSelectionProps) => {

  const [selectedCells, setSelectedCells]  = useQueryState("selected", parseAsArrayOf(parseAsString).withDefault([]))
  const [selectedStartCell, setSelectedStartCell] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

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
    }
  };

  const deselectAll = () => setSelectedCells([])

  const navigateUp = () => {
    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRowIndex = table
      .getRowModel()
      .rows.findIndex((row) => row.id === selectedCell.split("_").at(0));
    const nextRowIndex = selectedRowIndex - 1;
    const previousRow = table.getRowModel().rows[nextRowIndex];
    if (previousRow) {
      setSelectedCells([
        getCellSelectionData(
          previousRow
            .getAllCells()
            .find((c) => c.column.id === getPartAfterFirstUnderscore(selectedCell))!,
        ),
      ]);
      scrollToRow?.(nextRowIndex);
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
    if (nextRow) {
      setSelectedCells([
        getCellSelectionData(
          nextRow
            .getAllCells()
            .find((c) => c.column.id === getPartAfterFirstUnderscore(selectedCell))!,
        ),
      ]);
      scrollToRow?.(nextRowIndex);
    }
  };

  const navigateLeft = () => {
    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRow = table.getRow(selectedCell.split("_").at(0) as string);
    const selectedColumnIndex = selectedRow
      .getAllCells()
      .findIndex((c) => c.id === selectedCell);
    const previousCell = selectedRow.getAllCells()[selectedColumnIndex - 1];
    if (previousCell && isValidSelectionTarget(previousCell)) {
      setSelectedCells([getCellSelectionData(previousCell)]);
    }
  };

  const navigateRight = () => {
    const selectedCell = selectedCells[selectedCells.length - 1];
    if (!selectedCell) {
      return;
    }

    const selectedRow = table.getRow(selectedCell.split("_").at(0) as string);
    const selectedColumnIndex = selectedRow
      .getAllCells()
      .findIndex((c) => c.id === selectedCell);
    const nextCell = selectedRow.getAllCells()[selectedColumnIndex + 1];
    if (nextCell) {
      setSelectedCells([getCellSelectionData(nextCell)]);
    }
  };

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
    setSelectedCells((prev) => {
      const startIndex = prev.findIndex(
        (c) => c === selectedStartCell,
      );
      const prevSelectedCells = prev.slice(0, startIndex);
      const newCellSelection = selectedCellsInRange.filter((c) => 
        c !== selectedStartCell && validTableCellsIds.includes(c),
      );
      
      return [...prevSelectedCells, selectedStartCell, ...newCellSelection];
    });
  };

  const isValidAdjacentTarget = (cell: Cell<any, any>) => 
    !cell.getIsPlaceholder() && 
    !cell.getIsAggregated() && 
    !cell.getIsGrouped()
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
      // - Select all row cells when clicking on index cell, if the row has any cell, or
      // - Select single cell, or deselect all if clicking on a selected cell
      if (!e.ctrlKey && !e.shiftKey) {
        let selectedStartCell = getCellSelectionData(cell)
        if (isRowIndexCell(cell)) {
          const rowCells = cell.row.getAllCells();
          const validCells = rowCells.filter(c => isValidSelectionTarget(c));
          const firstCell = validCells.at(0);
          if (firstCell) {
            selectedStartCell = getCellSelectionData(firstCell)
            setSelectedCells(validCells.map(c => getCellSelectionData(c)))
          } 
        } else {
          setSelectedCells((prev) => prev.find((c) => c === cell.id) !== undefined
            ? null
            : [getCellSelectionData(cell)]
          );
        }
        if (!isMouseDown) {
          setSelectedStartCell(selectedStartCell);
        }
      }
  
      // Ctrl click:
      // - Append all row cells when clicking on index cell, if row has any cell, or
      // - Append single cell, or desect it if already selected
      if (e.ctrlKey) {
        let selectedStartCell = getCellSelectionData(cell)
        if (isRowIndexCell(cell)) {
          const rowCells = cell.row.getAllCells();
          const validCells = rowCells.filter(c => isValidSelectionTarget(c));
          const firstCell = validCells.at(0);
          if (firstCell) {
            selectedStartCell = getCellSelectionData(firstCell)
            setSelectedCells((prev) => 
              [...prev, ...validCells.map(c => getCellSelectionData(c))]
            )
          }
        } else {
          setSelectedCells((prev) =>
            prev.find((c) => c === cell.id) !== undefined
              ? prev.filter(( cellId ) => cellId !== cell.id)
              : [...prev, getCellSelectionData(cell)],
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
      const columnCells = getCellsFromHeader(header)
      const validCells = columnCells.filter(c => isValidSelectionTarget(c))

      // Select cells if the column has any, otherwise do nothing
      if (validCells.length) {

        const firstCell = validCells.at(0) as Cell<any, any>;

        // Simple click: Select all leaf columns cells when clicking
        if (!e.ctrlKey && !e.shiftKey) {
          setSelectedCells(validCells.map(c => getCellSelectionData(c)))
          if (!isMouseDown) {
            setSelectedStartCell(getCellSelectionData(firstCell));
          }
        }
        
        // Ctrl click: Append all column leaf cells when clicking on index cell
        if (e.ctrlKey) {
          setSelectedCells((prev) => 
            [...prev, ...validCells.map(c => getCellSelectionData(c))]
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

const getCellsFromHeader = (header: Header<any, any>) => {
  const leafColumns = header.column.getLeafColumns().map(col => col.id)
  const tableCells = header.getContext().table.getRowModel().rows.flatMap(row => row.getAllCells())
  const columnCells = tableCells.filter(cell => leafColumns.includes(cell.column.id))
  return columnCells
}

/* 
  Original Hook: 
  https://gist.github.com/joshkay/fc8bab0561583dd48fecce93022fc7a2#file-usecellselection-ts-L343
*/

/* 
ToDo:
    - Handle entry deletion: delete entries or delete all row if all entries of a row selected
*/
