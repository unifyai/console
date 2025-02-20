import { ReactNode, Dispatch, SetStateAction } from "react";
import { Row, Cell, Table } from "@tanstack/react-table";
import { StateProps } from "@/types/dataTable";
import { TableRow } from "@/components/UI/table";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import DataTableCell from "./Cell";
import { LogProps, GroupedLogProps } from "@/types/evals/logs";
import { RowExpandingProps } from "../Buttons/RowExpanding";

interface DataTableRowProps<TData extends LogProps | GroupedLogProps> {
    row: Row<TData>;
    table: Table<TData>;
    state: StateProps;
    setExpandingRowId: (id: string | null) => void;
    expandingRowId: string | null;
    RowExpanding?: (props: RowExpandingProps) => ReactNode;
    ExtraCellContent?: (cell: Cell<TData, unknown>, isCellExpanded: (cell: Cell<TData, unknown>) => boolean, setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>) => ReactNode;
    AggregatedCell?: (cell: Cell<TData, unknown>, row: Row<TData>) => ReactNode;
    renderSkeletonRows: (count?: number) => ReactNode;
    cellSelection: any;
    isCellSelected: (cell: Cell<TData, unknown>) => boolean;
    isCellExpanded: (cell: Cell<TData, unknown>) => boolean;
    setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>;
    selectedCells: string[];
    resizeMap: {[x: string]: (event: unknown) => void;};
    draggingColumns: any;
    isAnimating: boolean;
}

export default function DataTableRow<TData extends LogProps | GroupedLogProps>({
    row,
    table,
    state,
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
    isAnimating
}: DataTableRowProps<TData>) {
    const isExpanding = expandingRowId === row.original.id;
    const hasSkeletonSubRows = isExpanding && 'groupCount' in row.original && typeof row.original.groupCount === 'number' && row.original.groupCount > 0 && !row.original.isPopulated;

    return (
        <>
            <TableRow key={row.id}>
                {row.getVisibleCells().map(cell => (
                    <SortableContext key={cell.id} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                        <DataTableCell
                            cell={cell}
                            row={row}
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
                            setExpandingRowId={setExpandingRowId}
                            state={state}
                        />
                    </SortableContext>
                ))}
            </TableRow>
            {hasSkeletonSubRows && renderSkeletonRows(4)}
        </>
    );
}
