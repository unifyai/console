"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuGroup } from "@/components/UI/dropdown-menu";
import { Table, Header } from "@tanstack/react-table";
import { CirclePlus } from "lucide-react";
import { getImmediateRightNeighbors, getImmediateHiddenSiblings, updateColumnVisibility, sanitizeId, isLastSameParentColumnInColumnOrder } from "@/utils/evals/columnOperations";
import { getColumnGroupIDs, moveGroupInColumnOrder } from "@/utils/evals/table";
import { ReactNode, useState } from "react";

const ColumnShow = ({ table, header, columnVisibility, setColumnVisibility, columnOrder, setColumnOrder, ColumnCreate }: {
    table: Table<any | unknown>,
    header: Header<any, unknown>,
    columnVisibility: { [key: string]: boolean },
    setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
    columnOrder: string[],
    setColumnOrder: (columnOrder: string[]) => void,
    ColumnCreate?: (previousColumn:string, setOpen: (open: boolean) => void) => ReactNode,
}) => {
    const [open, setOpen] = useState<boolean>(false);
    const isParentColumn = header.column.columnDef.meta?.isParent;
    const columnType = header.column.columnDef.meta?.columnType;
    const isUtilColumn = header.column.columnDef.meta?.columnType === "util";
    const currentDepth = isUtilColumn ? header.depth: header.column.columnDef.meta?.renderedDepth;

    // Store both all immediate right neighbors and hidden ones
    let immediateRightNeighborIds: string[] = [];
    let hiddenImmediateRightNeighborIds: string[] = [];

    const rawHiddenColumns = (() => {
        // Initialize array to store hidden columns
        let hidden: string[] = [];

        // Get hidden siblings of current column
        if (currentDepth !== undefined) {
            const currentHiddenSiblings = getImmediateHiddenSiblings(
                header.column,
                currentDepth,
                columnOrder,
                columnVisibility,
                table,
            );
            hidden.push(...currentHiddenSiblings);
        }

        // Find the immediate right neighbors at the same depth that are hidden only if
        // the current column is the last column in the columnOrder array after which we switch to some other parent column
        if (currentDepth !== undefined && isLastSameParentColumnInColumnOrder(header.column, columnOrder, columnVisibility)) {
            const immediateRightNeighbors = getImmediateRightNeighbors(
                header.column,
                currentDepth,
                columnOrder,
                table,
            );
            immediateRightNeighborIds.push(...immediateRightNeighbors);

            // Find the immediate right neighbors at the same depth that are hidden
            const hiddenImmediateRightNeighbors = immediateRightNeighbors.filter((neighbor) => !columnVisibility[neighbor]);
            hidden.push(...hiddenImmediateRightNeighbors);
            hiddenImmediateRightNeighborIds.push(...hiddenImmediateRightNeighbors);
        }    

        return hidden;
    })();

    // Remove any duplicates
    const seen = new Set<string>();
    const hiddenColumns = rawHiddenColumns.filter((col) => {
        if (seen.has(col as string)) {
            return false; // Exclude duplicate
        }
        seen.add(col as string); // Mark as seen
        return true; // Include unique column
    });

    // Fallback: if util/index column and still no hidden columns, list all currently hidden leaf columns
    if (isUtilColumn && hiddenColumns.length === 0) {
        const allHidden = table.getAllLeafColumns()
            .filter(col => !columnVisibility[col.id] && col.id !== "RowNumbering")
            .map(col => col.id as string);
        hiddenColumns.push(...allHidden);
    }

    const displayColumn = (column: string) => {
        const allColumns = table.getAllFlatColumns();
        const columnToShow = allColumns.find((col) => col.columnDef.id === column);

        if (!columnToShow) {
            console.warn("Column not found. No updates made.");
            return;
        }

        // Get the active group IDs (column to show and its children)
        const activeGroupIDs = getColumnGroupIDs(columnToShow);

        // If this is an immediate sibling, handle column order update
        if (!immediateRightNeighborIds.includes(column)) {
            // For regular columns, use current header as target
            const overGroupIDs = getColumnGroupIDs(header.column);
            const newOrder = moveGroupInColumnOrder(columnOrder, activeGroupIDs, overGroupIDs, true);
            setColumnOrder(newOrder);
        } else if (immediateRightNeighborIds.length > 0) {
            // For immediate right neighbors from another parent, use the first column from that group as target
            const firstNeighborId = immediateRightNeighborIds[0];
            const firstNeighborColumn = allColumns.find(col => col.id === firstNeighborId);
            if (firstNeighborColumn) {
                const overGroupIDs = getColumnGroupIDs(firstNeighborColumn);
                const newOrder = moveGroupInColumnOrder(columnOrder, activeGroupIDs, overGroupIDs);
                setColumnOrder(newOrder);
            }
        }

        // Update column visibility for all columns in the active group
        let newVisibility = { ...columnVisibility };
        newVisibility = updateColumnVisibility(newVisibility, column, true);
        setColumnVisibility(newVisibility);
    };

    // Conditions for showing the Plus button
    const shouldShowButton = (() => {
        // Case 1: Leaf headers with columnType "params" or "utils"
        if (!isParentColumn && columnType === "util") {
            // Always allow add column from the index column when table is empty
            return true;
        }

        if (!isParentColumn && columnType === "params") {
            return hiddenColumns.length > 0;
        }

        // Case 2: Leaf headers with columnType "entries"
        if (!isParentColumn && columnType === "entries") {
            return true; // Always show for entries leaf headers
        }

        // Case 3: Parent headers with columnType "params", "entries", "paramsHeader", or "entriesHeader"
        if (
            isParentColumn &&
            (columnType === "params" ||
                columnType === "entries" ||
                columnType === "paramsHeader" ||
                columnType === "entriesHeader")
        ) {
            return hiddenColumns.length > 0; // Show only if there are hidden columns
        }

        return false; // Default: Do not show the button
    })();

    if (!shouldShowButton) return null;

    // Sub components
    const columnButtonLabel = "Add Column";
    const columnButton = <ActionButton tooltip={columnButtonLabel} icon={<CirclePlus />} />
    const hidden =  <DropdownMenuGroup>
                        {hiddenColumns.map((column, index) =>
                            <DropdownMenuItem key={index} onClick={() => {
                                displayColumn(column);
                            }}>
                                {/* Display only the last "/" joined string of the column ID */}
                                {/* e.g. "params/param1/param2" -> "param1/param2" */}
                                {sanitizeId(column).split("/").slice(-2).join("/")}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>

    const derived = ColumnCreate && (columnType === "entries" || columnType === "util")
        ? ColumnCreate(header.column.id, setOpen)
        : null;
    
    return (
        <div className="absolute -right-2 z-10 hover:opacity-100 opacity-0 transition-all">
            <BaseDropdown button={columnButton} open={open} setOpen={setOpen} context="tile">
                {hiddenColumns.length > 0 && hidden}
                {derived}
            </BaseDropdown>
        </div>
    );
};

export default ColumnShow;
