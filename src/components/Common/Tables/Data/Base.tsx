"use client";

import { useRef, ReactNode, MouseEvent, JSX, Ref, Dispatch, SetStateAction, useState, useEffect } from "react";

import { ColumnFiltersState, ColumnPinningState, GroupingState, Header, SortingState, Updater, useReactTable } from "@tanstack/react-table";
import { getFilteredRowModel, getExpandedRowModel } from "@tanstack/react-table";
import { ColumnDef, Table as TanstackTable, Column as TanstackColumn, Cell as TanstackCell, Row as TanstackRow } from "@tanstack/react-table";
import { DraggingColumnPinnerState } from "@/types/evals/columns";

import { useSensors, useSensor, MouseSensor, TouchSensor, KeyboardSensor, DragStartEvent, DragMoveEvent, DragOverEvent, DragEndEvent, DragCancelEvent } from "@dnd-kit/core";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import { getCoreRowModel, handleDragCancel, handleDragEnd, handleDragMove, handleDragOver, handleDragStart, mergeHeadersHorizontally } from "@/utils/evals/table";
import { getParentID } from "@/utils/evals/columnOperations";
import { Table, TableHeader, TableRow, TableBody, TableCell, TableFooter } from "@/components/UI/table";

import DataTableHeader from "./Content/Header";
import DataTableRow from "./Content/Row";

import { StateProps, SetStateProps } from "@/types/dataTable";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import { useCellSelection } from "@/hooks/Logs/useCellSelection";
import { useTableGrouping } from "@/hooks/useTableGrouping";
import { RowExpandingProps } from "./Buttons/RowExpanding";

interface DataTableProps<TData extends LogProps | GroupedLogProps> {
    className?: string;
    interactive?: boolean;
    auto_update?: boolean;
    data: TData[];
    columns: ColumnDef<TData, unknown>[];
    state: StateProps;
    setState: SetStateProps;
    error?: string;
    scrollContainerRef?: React.RefObject<HTMLDivElement>,
    onRenameColumn?: (oldName: string, newName: string) => void;
    FooterCell?: (column: TanstackColumn<any | unknown>, resizeMap: {[x: string]: (event: unknown) => void;}, table: TanstackTable<any | unknown>, draggingColumnPinner: DraggingColumnPinnerState, setDraggingColumnPinner: (draggingColumnPinner: DraggingColumnPinnerState) => void, columnPinning: ColumnPinningState, columnOrder: string[]) => ReactNode; 
    ColumnGroupBy?: (column: TanstackColumn<any | unknown>, groupLoading: boolean, setGroupLoading: (groupLoading: boolean) => void, setIsGrouped: (isGrouped: boolean) => void, setGroupSortLoading: (groupSortLoading: boolean) => void, renderMode: "button" | "menuItem") => ReactNode;
    ColumnGroupSort?: (column: TanstackColumn<any | unknown>, groupSortLoading: boolean, setGroupSortLoading: (groupSortLoading: boolean) => void, setSortingDirection: (sortingDirection: "asc" | "desc" | false) => void, renderMode: "button" | "menuItem", direction?: "asc" | "desc") => ReactNode;
    ColumnFilters?: (column: TanstackColumn<any | unknown>, filterLoading: boolean, setIsFiltered: (isFiltered: boolean) => void, setFilterLoading: (filterLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode: "button" | "menuItem") => ReactNode;
    ColumnDelete?: (column: TanstackColumn<any | unknown>) => ReactNode;
    ColumnCreate?: (previousColumn: string, setOpen: (open: boolean) => void) => ReactNode;
    ColumnUpdate?: (key: string, updateLoading: boolean, setUpdateLoading: (updateLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode: "button" | "menuItem") => ReactNode;
    AggregatedCell?: (cell: TanstackCell<any, unknown>, row: TanstackRow<any | unknown>) => ReactNode;
    ExtraCellContent?: (cell: TanstackCell<any, unknown>, isCellExpanded: (cell: TanstackCell<any, unknown>) => boolean, setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>) => ReactNode;
    ExtraComponents?: (table: TanstackTable<any | unknown>) => ReactNode;
    RowExpanding?: (props: RowExpandingProps) => ReactNode;
}

export default function DataTable<TData extends LogProps | GroupedLogProps>({
    className,
    interactive,
    auto_update,
    data,
    columns,
    state,
    setState,
    error,
    scrollContainerRef,
    onRenameColumn,
    FooterCell,
    ColumnGroupBy,
    ColumnGroupSort,
    ColumnDelete,
    ColumnFilters,
    ColumnCreate,
    ColumnUpdate,
    AggregatedCell,
    ExtraCellContent,
    ExtraComponents,
    RowExpanding,
}: DataTableProps<TData>) {
    // Internal state management
    const [isUpdatingLogs, setIsUpdatingLogs] = useState(false);
    const [expandingRowId, setExpandingRowId] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const setUpdatedState = (
        state: any, setterFunction: (x: any) => void, updater: Updater<any>
    ) => {
        const updated = typeof updater === "function" ? updater(state) : updater;

        if (JSON.stringify(updated) != JSON.stringify(state)) {
            setterFunction(updated);
        }
    };

    const { isGroupingUpdating, setIsGroupingUpdating } = useTableGrouping(
        state.grouping,
        setIsUpdatingLogs
    );

    const [columnActionsApplied, setColumnActionsApplied] = useState<{ [depth: number]: { [columnId: string]: boolean } }>({});

    // Refs for Header and Footer to calculate visible portion of the table body
    const tableHeaderRef = useRef<HTMLTableSectionElement>(null); // For <thead>
    const tableFooterRef = useRef<HTMLTableSectionElement>(null); // For <tfoot>

    // Dynamically adjust scroll-padding-top so rows snap just below the header, even if it resizes
    useEffect(() => {
        const header = tableHeaderRef.current;
        const container = scrollContainerRef?.current;
        if (!header || !container) return;
        // Create a ResizeObserver to watch header height changes
        const ro = new ResizeObserver(() => {
            container.style.scrollPaddingTop = `${header.clientHeight}px`;
        });
        ro.observe(header);
        // Initial measurement
        container.style.scrollPaddingTop = `${header.clientHeight}px`;
        return () => ro.disconnect();
    }, [scrollContainerRef, tableHeaderRef]);

    // Effect to handle data updates
    useEffect(() => {
        setIsGroupingUpdating(false);
        setIsUpdatingLogs(false);
    }, [data]);

    // Init table
    const table = useReactTable({
        data,
        columns,
        state,
        autoResetExpanded: false,
        enableColumnResizing: true,
        columnResizeMode: "onChange",
        onColumnVisibilityChange: (updater: Updater<{ [k: string]: boolean }>) => setUpdatedState(
            state.columnVisibility, setState.setColumnVisibility, updater
        ),
        onColumnOrderChange: (updater: Updater<string[]>) => setUpdatedState(state.columnOrder, setState.setColumnOrder, updater),
        // onGroupingChange: (updater: Updater<GroupingState>) => setUpdatedState(state.grouping, setState.setGrouping, updater),
        onSortingChange: (updater: Updater<SortingState>) => setUpdatedState(state.sorting, setState.setSorting, updater),
        onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => setUpdatedState(
            state.columnFilters, setState.setColumnFilters, updater
        ),
        onColumnPinningChange: (updater: Updater<ColumnPinningState>) => setUpdatedState(state.columnPinning, setState.setColumnPinning, updater),
        onColumnSizingChange: setState.setColumnSizing,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        manualGrouping: true,
        groupedColumnMode: false,
        manualSorting: true,
        getRowId(originalRow, index, parent) {
            return (originalRow as LogProps | GroupedLogProps).id.toString()
        },
        getSubRows(originalRow: TData, index: number): TData[] | undefined {
            if (!('subRows' in originalRow)) return undefined;
            
            const row = originalRow as GroupedLogProps;
            const subRows = row.subRows;
            return subRows as TData[];
        },
        meta: {
            createColumn: () => {
                // updateLogs(...).then(...)
                // window.location.reload();
        },
        }
    });

    // When grouping changes, move grouped columns to the left in the column order
    useEffect(() => {
      const groupingIds = state.grouping as string[];
      if (!groupingIds.length) return;
      const currentOrder = state.columnOrder;
      // Preserve the index column if present
      const rowNum = currentOrder.find(id => id === "RowNumbering");
      // Other columns excluding the index
      const rest = currentOrder.filter(id => id !== "RowNumbering");
      // Build a set of all IDs to move: include grouping keys and their entire header groups
      const moveSet = new Set<string>();
      groupingIds.forEach(groupId => {
        // Always include the grouping key itself if present
        if (rest.includes(groupId)) {
          moveSet.add(groupId);
        }
        // Determine the immediate parent header ID (if any)
        const lastSlash = groupId.lastIndexOf('/');
        if (lastSlash > -1) {
          const parentId = groupId.slice(0, lastSlash);
          // Include the parent header ID
          if (rest.includes(parentId)) {
            moveSet.add(parentId);
          }
          // Include all descendants (siblings) under this parent
          rest.forEach(id => {
            if (id.startsWith(parentId + '/')) {
              moveSet.add(id);
            }
          });
        }
      });
      // Partition rest into those to move and remaining, preserving original order
      const grouped = rest.filter(id => moveSet.has(id));
      // Within each parent group, put newly grouped columns first
      grouped.sort((a, b) => {
        const pa = getParentID(a);
        const pb = getParentID(b);
        if (pa === pb) {
          const aIsG = groupingIds.includes(a);
          const bIsG = groupingIds.includes(b);
          if (aIsG !== bIsG) return aIsG ? -1 : 1;
        }
        return 0;
      });
      const remaining = rest.filter(id => !moveSet.has(id));
      const newOrder = [
        ...(rowNum ? [rowNum] : []),
        ...grouped,
        ...remaining,
      ];
      if (JSON.stringify(newOrder) !== JSON.stringify(currentOrder)) {
        setState.setColumnOrder(newOrder);
      }
    }, [state.grouping]);

    // Set up drag-and-drop
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {})
    );

    const visibleColumns = table.getVisibleLeafColumns();

    // Reorder columns: move grouped columns (state.grouping) to the left in grouping order
    const groupingIds = state.grouping as string[];
    // Extract the index column if present
    const indexColumn = visibleColumns.find(col => col.id === "RowNumbering");
    // Other columns excluding the index column
    const otherColumns = visibleColumns.filter(col => col.id !== "RowNumbering");

    // Grouped columns in the order of grouping state
    const groupedColumns = groupingIds
        .map(id => otherColumns.find(col => col.id === id))
        .filter((col): col is typeof otherColumns[0] => Boolean(col));

    // Remaining columns that are not grouped
    const remainingColumns = otherColumns.filter(col => !groupingIds.includes(col.id));

    // Compose final columns: index, grouped, then remaining
    const finalColumns = [
        ...(indexColumn ? [indexColumn] : []),
        ...groupedColumns,
        ...remainingColumns,
    ];

    const resizeMap = table.getFlatHeaders().map(
        (header: Header<TData, unknown>) => ({[header.column.id]: header.getResizeHandler()})
    ).reduce((acc: { [key: string]: (event: unknown) => void }, curr: { [key: string]: (event: unknown) => void }) => ({...acc, ...curr}), {});

    const { isCellSelected, isRowSelected, isCellExpanded, setExpandedCells, ...cellSelection } = useCellSelection({
        table,
        selectedCells: state.selectedCells,
        setSelectedCells: setState.setSelectedCells,
        scrollContainerRef: scrollContainerRef,
        tableHeaderRef: tableHeaderRef,
        tableFooterRef: tableFooterRef,  
    });

    // Helper function to render skeleton rows
    const renderSkeletonRows = (count: number = 2) => (
        Array.from({ length: count }).map((_, rowIdx) => (
            <TableRow key={rowIdx} className="animate-pulse">
                {finalColumns.map((col, colIdx) => (
                    <TableCell key={colIdx} className="p-2">
                        <div className="h-4 bg-muted rounded" />
                    </TableCell>
                ))}
            </TableRow>
        ))
    );

    const handleDragStartWrapper = (event: DragStartEvent) => {
        handleDragStart(
            event,
            state.draggingColumns,
            setState.setDraggingColumns,
            table.getAllFlatColumns(),
        );
    }

    const handleDragMoveWrapper = (event: DragMoveEvent) => {
        handleDragMove(
            event,
            state.draggingColumns,
            setState.setDraggingColumns,
            table.getAllFlatColumns(),
        );
    }

    const handleDragOverWrapper = (event: DragOverEvent) => {
        handleDragOver(event, state.draggingColumns, setState.setDraggingColumns, table.getAllFlatColumns());
    }

    const handleDragEndWrapper = (event: DragEndEvent) => {
        handleDragEnd(
            event,
            state.columnOrder,
            setState.setColumnOrder,
            state.grouping,
            setState.setGrouping,
            setState.setDraggingColumns,
            table.getAllFlatColumns(),
        );
    }

    const handleDragCancelWrapper = (event: DragCancelEvent) => {
        handleDragCancel(setState.setDraggingColumns);
    }

    return (<div className="relative flex h-fit w-full gap-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToHorizontalAxis]}
                    onDragStart={(event) => handleDragStartWrapper(event)}
                    onDragMove={(event) => handleDragMoveWrapper(event)}
                    onDragOver={(event) => handleDragOverWrapper(event)}
                    onDragEnd={(event) => handleDragEndWrapper(event)}
                    onDragCancel={(event) => handleDragCancelWrapper(event)}
                >
                    <Table className={`relative ${className}`} style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
                        <TableHeader ref={tableHeaderRef} className="sticky top-0 z-20 bg-background">
                            {table.getHeaderGroups().map((headerGroup, headerGroupIndex) => (
                                <TableRow key={headerGroup.id}>
                                    <SortableContext items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                        {mergeHeadersHorizontally(headerGroup).map((header) => (
                                            <DataTableHeader
                                                key={header.id}
                                                interactive={interactive}
                                                auto_update={auto_update}
                                                data={data}
                                                header={header}
                                                headerGroupIndex={headerGroupIndex}
                                                table={table}
                                                isCellSelected={isCellSelected}
                                                cellSelection={cellSelection}
                                                resizeMap={resizeMap}
                                                columnVisibility={state.columnVisibility}
                                                setColumnVisibility={setState.setColumnVisibility}
                                                grouping={state.grouping}
                                                setGrouping={setState.setGrouping}
                                                ColumnGroupBy={ColumnGroupBy}
                                                ColumnGroupSort={ColumnGroupSort}
                                                ColumnDelete={ColumnDelete}
                                                ColumnFilters={ColumnFilters}
                                                ColumnCreate={ColumnCreate}
                                                ColumnUpdate={ColumnUpdate}
                                                context={state.context}
                                                setContext={setState.setContext}
                                                draggingColumns={state.draggingColumns}
                                                columnOrder={state.columnOrder}
                                                setColumnOrder={setState.setColumnOrder}
                                                columnPinning={state.columnPinning}
                                                draggingColumnPinner={state.draggingColumnPinner}
                                                setDraggingColumnPinner={setState.setDraggingColumnPinner}
                                                columnActionsApplied={columnActionsApplied}
                                                setColumnActionsApplied={setColumnActionsApplied}
                                                onRenameColumn={onRenameColumn}
                                            />
                                        ))}
                                    </SortableContext>
                                </TableRow>
                            ))}
                        </TableHeader>

                        <TableBody className="contents overflow-y-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                            {isUpdatingLogs 
                                ?   (
                                        // Show skeletons for the entire table when updating logs globally
                                        renderSkeletonRows(2)
                                    ) 
                                : error 
                                    ?   (
                                            // Display potential error message in table as a single cell
                                            <TableRow>
                                                <TableCell colSpan={finalColumns.length} className="text-start text-warning min-w-[150px]" style={{borderRight: "1px solid var(--muted)", borderLeft: "1px solid var(--muted)", borderTop: "1px solid var(--muted)"}}>
                                                    {error}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    :   table.getRowModel().rows?.length 
                                        ?   (
                                                table.getRowModel().rows.map((row) => (
                                                    <>
                                                        <DataTableRow
                                                            key={row.id}
                                                            row={row}
                                                            table={table}
                                                            state={state}
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
                                                            selectedCells={state.selectedCells}
                                                            resizeMap={resizeMap}
                                                            draggingColumns={state.draggingColumns}
                                                            isAnimating={isAnimating}
                                                            setDraggingColumnPinner={setState.setDraggingColumnPinner}
                                                        />
                                                        {/* Show skeletons under the expanding row */}
                                                        {expandingRowId === row.id && 
                                                        'groupCount' in row.original && 
                                                        typeof row.original.groupCount === 'number' &&
                                                        row.original.groupCount > 0 &&
                                                        !row.original.isPopulated &&
                                                        renderSkeletonRows(2)}
                                                    </>
                                                ))
                                            ) 
                                            :   (
                                                    // Display placeholder cell if no entry found
                                                    <TableRow>
                                                        <TableCell colSpan={finalColumns.length} className="text-center min-w-[150px]" style={{borderRight: "1px solid var(--muted)", borderLeft: "1px solid var(--muted)", borderTop: "1px solid var(--muted)"}}>
                                                            No entry found
                                                        </TableCell>
                                                    </TableRow>
                                                )
                            }
                        </TableBody>

                        <TableFooter ref={tableFooterRef} className="sticky bottom-0 z-20 bg-background border-t-2 border-foreground">
                            <TableRow>
                                {isUpdatingLogs ? (
                                    finalColumns.map((_, idx) => (
                                        <TableCell key={idx} className="p-2">
                                            <div className="h-4 bg-muted rounded animate-pulse" />
                                        </TableCell>
                                    ))
                                ) : (
                                    finalColumns.map((column, index) => (
                                        <SortableContext key={index} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                            {FooterCell && FooterCell(column, resizeMap, table, state.draggingColumnPinner, setState.setDraggingColumnPinner, state.columnPinning, state.columnOrder)}
                                        </SortableContext>
                                    ))
                                )}
                            </TableRow>
                        </TableFooter>
                    </Table>
                </DndContext>
                {ExtraComponents && ExtraComponents(table)}
    </div>);
}
