"use client";

import type { Cell, Table } from "@tanstack/react-table";
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
    if (
      previousCell && 
      isValidSelectionTarget(previousCell) &&
      previousCell.column.id !== "RowNumbering" // Temporarily disable numbering cell selection
    ) {
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

  const isRowSelected = (rowId: string) =>
    selectedCells.find((c) => c.split("_").at(0) === rowId) !== undefined;

  const isCellSelected = (cell: Cell<any, any>) =>
    selectedCells.find((c) => c === cell.id) !== undefined;

  const updateRangeSelection = (cell: Cell<any, any>) => {
    if (!selectedStartCell) {
      return;
    }

    const selectedCellsInRange = getCellsBetween(
      table,
      selectedStartCell,
      getCellSelectionData(cell),
    ) as string[];

    setSelectedCells((prev) => {
      const startIndex = prev.findIndex(
        (c) => c === selectedStartCell,
      );
      const prevSelectedCells = prev.slice(0, startIndex);
      const newCellSelection = selectedCellsInRange.filter(
        (c) => c !== selectedStartCell,
      );

      return [...prevSelectedCells, selectedStartCell, ...newCellSelection];
    });
  };

  const isValidSelectionTarget = (cell: Cell<any, any>) => 
    !cell.getIsPlaceholder() && 
    !cell.getIsAggregated() && 
    !cell.getIsGrouped() &&
    cell.column.id != "RowNumbering" // Temporarily disable numbering cell selection

  const handleCellMouseDown = (
    e: React.MouseEvent<HTMLElement>,
    cell: Cell<any, any>,
  ) => {
    
    if (!isValidSelectionTarget(cell)) return;

    if (!e.ctrlKey && !e.shiftKey) {
      setSelectedCells([getCellSelectionData(cell)]);
      if (!isMouseDown) {
        setSelectedStartCell(getCellSelectionData(cell));
      }
    }

    if (e.ctrlKey) {
      setSelectedCells((prev) =>
        prev.find((c) => c === cell.id) !== undefined
          ? prev.filter(( cellId ) => cellId !== cell.id)
          : [...prev, getCellSelectionData(cell)],
      );
      if (!isMouseDown) {
        setSelectedStartCell(getCellSelectionData(cell));
      }
    }

    if (e.shiftKey) {
      updateRangeSelection(cell);
    }

    setIsMouseDown(true);
  };

  const handleCellMouseUp = (
    e: React.MouseEvent<HTMLElement>,
    _cell: Cell<any, any>,
  ) => {
    if (!e.shiftKey) {
    }

    setIsMouseDown(false);
  };

  const handleCellMouseOver = (
    e: React.MouseEvent<HTMLElement>,
    cell: Cell<any, any>,
  ) => {
    if (e.buttons !== 1) return;

    if (isMouseDown) {
      updateRangeSelection(cell);
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


/* 
  Original Hook: 
  https://gist.github.com/joshkay/fc8bab0561583dd48fecce93022fc7a2#file-usecellselection-ts-L343
*/

/* 
ToDo:
    - Handle index column cell selection
    - Handle entry deletion
*/
