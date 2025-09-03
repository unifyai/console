import { ReactNode, Dispatch, SetStateAction } from "react";
import { Row, Cell, Table } from "@tanstack/react-table";
import { StateProps } from "@/types/dataTable";
import { TableRow } from "@/components/UI/table";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import DataTableCell from "./Cell";
import { LogProps, GroupedLogProps } from "@/types/interfaces/logs";
import { RowExpandingProps } from "../Buttons/RowExpanding";
import RowResize from "../Buttons/RowResize";

interface DataTableRowProps<TData extends LogProps | GroupedLogProps> {
    row: Row<TData>;
    table: Table<TData>;
    state: StateProps;
    setRowSizing: (updater: (old: {[key: string]: number}) => {[key: string]: number}) => void;
    setExpandingRowId: (id: string | null) => void;
    expandingRowId: string | null;
    RowExpanding?: (props: RowExpandingProps) => ReactNode;
    ExtraCellContent?: (cell: Cell<TData, unknown>, isCellExpanded: (cell: Cell<TData, unknown>) => boolean, setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>) => ReactNode;
    AggregatedCell?: (cell: Cell<TData, unknown>, row: Row<TData>) => ReactNode;
    renderSkeletonRows: (count?: number) => ReactNode;
    cellSelection: any;
    isCellSelected: (cell: Cell<TData, unknown>) => boolean;
    isRowSelected?: ((row: Row<TData>) => boolean) | ((rowId: string) => boolean);
    isCellExpanded: (cell: Cell<TData, unknown>) => boolean;
    setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>;
    selectedCells: string[];
    resizeMap: {[x: string]: (event: unknown) => void;};
    draggingColumns: any;
    isAnimating: boolean;
    setDraggingColumnPinner: (state: any) => void;
    rightmostColumnId?: string;
    editingCellId?: string | null;
    setEditingCellId?: (id: string | null) => void;
    // Inline editing
    editEnabled?: boolean;
    isCellMutable?: (cell: Cell<TData, unknown>) => boolean;
    onCommitCellEdit?: (payload: { rowIds: string[]; source: "entries" | "params"; path: (string | number)[]; newValue: any }) => Promise<void>;
    onBlockedEdit?: (cell: Cell<TData, unknown>) => void;
}

export default function DataTableRow<TData extends LogProps | GroupedLogProps>({
    row,
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
    isRowSelected,
    isCellExpanded,
    setExpandedCells,
    selectedCells,
    resizeMap,
    draggingColumns,
    isAnimating,
    setDraggingColumnPinner,
    rightmostColumnId,
    editingCellId,
    setEditingCellId,
    editEnabled,
    isCellMutable,
    onCommitCellEdit,
    onBlockedEdit
}: DataTableRowProps<TData>) {
    const isExpanding = expandingRowId === row.original.id;
    const rowHeight = state.rowSizing?.[row.id];
    const hasSkeletonSubRows = isExpanding && 'groupCount' in row.original && typeof row.original.groupCount === 'number' && row.original.groupCount > 0 && !row.original.isPopulated;
    const rowIsSelected = (() => {
      if (!isRowSelected) return false;
      try {
        // Try Row<TData>
        // @ts-ignore
        if (isRowSelected.length === 1 && typeof isRowSelected === 'function') {
          // Attempt call with row
          return (isRowSelected as (row: Row<TData>) => boolean)(row);
        }
      } catch (_) {}
      try {
        // Fallback: call with row.id as string
        return (isRowSelected as (rowId: string) => boolean)(String(row.id));
      } catch (_) {
        return false;
      }
    })();
    return (
        <>
            <TableRow key={row.id} data-row-id={row.id} className={`snap-start relative group/row ${rowIsSelected ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : ''}`} style={{ height: rowHeight ? `${rowHeight}px` : undefined }}>
                {row.getVisibleCells().map(cell => (
                    <SortableContext key={cell.id} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                        <DataTableCell
                            cell={cell}
                            row={row}
                            table={table}
                            selectedCells={selectedCells}
                            isCellSelected={isCellSelected}
                            cellSelection={cellSelection}
                            resizeMap={resizeMap}
                            ExtraCellContent={ExtraCellContent}
                            AggregatedCell={AggregatedCell}
                            isCellExpanded={isCellExpanded}
                            setExpandedCells={setExpandedCells}
                            draggingColumns={draggingColumns}
                            RowExpanding={RowExpanding}
                            isAnimating={isAnimating}
                            expandingRowId={expandingRowId}
                            setExpandingRowId={setExpandingRowId}
                            state={state}
                            setDraggingColumnPinner={setDraggingColumnPinner}
                            isRightmost={cell.column.id === rightmostColumnId}
                            editingCellId={editingCellId}
                            setEditingCellId={setEditingCellId}
                            // Inline editing
                            editEnabled={!!editEnabled}
                            isCellMutable={isCellMutable}
                            onCommitCellEdit={onCommitCellEdit}
                            onBlockedEdit={onBlockedEdit}
                        />
                    </SortableContext>
                ))}
                <RowResize row={row} setRowSizing={setRowSizing} />
            </TableRow>
            {hasSkeletonSubRows && renderSkeletonRows(2)}
        </>
    );
}