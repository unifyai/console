import React, { ReactNode, Dispatch, SetStateAction } from 'react';
import { Row, Cell, Table, useReactTable } from '@tanstack/react-table';
import { StateProps } from '@/types/dataTable';
import DataTableRow from './Row';
import { LogProps, GroupedLogProps } from '@/types/interfaces/logs';
import { RowExpandingProps } from '../Buttons/RowExpanding';
import { GroupLoadMoreProps } from '../Buttons/GroupLoadMore';

interface SubRowsContainerProps<TData extends LogProps | GroupedLogProps> {
  parentRow: Row<TData>;
  subRows: Row<TData>[];
  table: Table<TData>;
  state: StateProps;
  setRowSizing: (updater: (old: { [key: string]: number }) => { [key: string]: number }) => void;
  setExpandingRowId: (id: string | null) => void;
  expandingRowId: string | null;
  RowExpanding?: (props: RowExpandingProps) => ReactNode;
  ExtraCellContent?: (
    cell: Cell<TData, unknown>,
    isCellExpanded: (cell: Cell<TData, unknown>) => boolean,
    setExpandedCells: Dispatch<SetStateAction<{ [k: string]: boolean }>>
  ) => ReactNode;
  AggregatedCell?: (cell: Cell<TData, unknown>, row: Row<TData>) => ReactNode;
  renderSkeletonRows: (count?: number) => ReactNode;
  cellSelection: any;
  isCellSelected: (cell: Cell<TData, unknown>) => boolean;
  isCellExpanded: (cell: Cell<TData, unknown>) => boolean;
  setExpandedCells: Dispatch<SetStateAction<{ [k: string]: boolean }>>;
  selectedCells: string[];
  resizeMap: { [x: string]: (event: unknown) => void };
  draggingColumns: any;
  isAnimating: boolean;
  setDraggingColumnPinner: (state: any) => void;
  columnCount: number;

  // GroupLoadMore component and props
  GroupLoadMore?: React.ComponentType<
    Partial<GroupLoadMoreProps> & { position?: 'before' | 'after' }
  > | null;
  interactive?: boolean;

  // Bidirectional loading support
  bidirectionalEnabled?: boolean;
  bidirectionalInfo?: {
    windowStart: number;
    windowEnd: number;
    isAtStart: boolean;
    isAtEnd: boolean;
    pagesInMemory: number;
    maxPagesInMemory: number;
  };

  rightmostColumnId: string;
}

/**
 * SubRowsContainer handles rendering subRows and the GroupLoadMore component
 * directly into the parent table's flow.
 */
export default function SubRowsContainer<TData extends LogProps | GroupedLogProps>({
  parentRow,
  subRows,
  table,
  state,
  setRowSizing,
  setExpandingRowId,
  expandingRowId,
  RowExpanding,
  ExtraCellContent,
  AggregatedCell,
  renderSkeletonRows,
  cellSelection,
  isCellSelected,
  isCellExpanded,
  setExpandedCells,
  selectedCells,
  resizeMap,
  draggingColumns,
  isAnimating,
  setDraggingColumnPinner,
  columnCount,
  GroupLoadMore,
  interactive = true,
  bidirectionalEnabled = false,
  bidirectionalInfo,
  rightmostColumnId,
}: SubRowsContainerProps<TData>) {
  // Create a nested table instance to pass correct options down, but without rendering a new table element
  const nestedTable = useReactTable({
    ...table.options,
    data: subRows.map((row) => row.original),
  });

  // Recursively render subRows and their own subRows as a flat list of table rows
  const renderSubRow = (row: Row<TData>): ReactNode => {
    const rowSubRows = subRows.filter((subRow) => {
      const subRowParentId = (subRow as any).parentId;
      return subRowParentId === row.id;
    });

    return (
      <React.Fragment key={row.id}>
        {/* Render the subRow itself as a regular DataTableRow */}
        <DataTableRow
          row={row}
          table={nestedTable}
          state={state}
          setRowSizing={setRowSizing}
          setExpandingRowId={setExpandingRowId}
          expandingRowId={expandingRowId}
          RowExpanding={RowExpanding}
          ExtraCellContent={ExtraCellContent}
          AggregatedCell={AggregatedCell}
          renderSkeletonRows={renderSkeletonRows}
          cellSelection={cellSelection}
          isCellSelected={isCellSelected}
          isCellExpanded={isCellExpanded}
          setExpandedCells={setExpandedCells}
          selectedCells={selectedCells}
          resizeMap={resizeMap}
          draggingColumns={draggingColumns}
          isAnimating={isAnimating}
          setDraggingColumnPinner={setDraggingColumnPinner}
        />

        {/* Recursively render this row's subRows if expanded and they exist */}
        {row.getIsExpanded() && rowSubRows.length > 0 && (
          <SubRowsContainer
            parentRow={row}
            subRows={rowSubRows}
            table={nestedTable}
            state={state}
            setRowSizing={setRowSizing}
            setExpandingRowId={setExpandingRowId}
            expandingRowId={expandingRowId}
            RowExpanding={RowExpanding}
            ExtraCellContent={ExtraCellContent}
            AggregatedCell={AggregatedCell}
            renderSkeletonRows={renderSkeletonRows}
            cellSelection={cellSelection}
            isCellSelected={isCellSelected}
            isCellExpanded={isCellExpanded}
            setExpandedCells={setExpandedCells}
            selectedCells={selectedCells}
            resizeMap={resizeMap}
            draggingColumns={draggingColumns}
            isAnimating={isAnimating}
            setDraggingColumnPinner={setDraggingColumnPinner}
            columnCount={columnCount}
            rightmostColumnId={rightmostColumnId}
            GroupLoadMore={GroupLoadMore}
            interactive={interactive}
            bidirectionalEnabled={bidirectionalEnabled}
            bidirectionalInfo={bidirectionalInfo}
          />
        )}
      </React.Fragment>
    );
  };

  // Get direct children of the parentRow
  const directChildren = subRows.filter((subRow) => {
    const subRowParentId = (subRow as any).parentId;
    return subRowParentId === parentRow.id;
  });

  // Don't render anything if there are no direct sub-rows to display.
  if (directChildren.length === 0) {
    return null;
  }

  // Render as a fragment to inject rows directly into the parent table's body
  return (
    <>
      {/* GroupLoadMore for Load Previous - render BEFORE subrows */}
      {GroupLoadMore && bidirectionalEnabled && (
        <GroupLoadMore
          key={`${parentRow.id}-before`}
          groupId={parentRow.id}
          colSpan={columnCount}
          interactive={interactive}
          position="before"
        />
      )}

      {/* Render direct children and their nested subRows */}
      {directChildren.map(renderSubRow)}

      {/* GroupLoadMore for Load More - render AFTER subrows */}
      {GroupLoadMore && (
        <GroupLoadMore
          key={`${parentRow.id}-after`}
          groupId={parentRow.id}
          colSpan={columnCount}
          interactive={interactive}
          position="after"
        />
      )}
    </>
  );
}
