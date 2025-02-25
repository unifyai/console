"use client";

import ActionButton from "@/components/Common/Buttons/Action";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from "@/components/UI/dropdown-menu";
import { Table, Header } from "@tanstack/react-table";
import { CirclePlus } from "lucide-react";
import { getImmediateHiddenSiblings, getImmediateSiblings, updateColumnVisibility } from "@/utils/evals/columnOperations";
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
    const currentDepth = header.column.columnDef.meta?.renderedDepth;
    const isUtilColumn = header.column.columnDef.meta?.columnType === "util";

    // Store both all immediate right neighbors and hidden ones
    let immediateRightNeighborIds: string[] = [];
    let hiddenImmediateRightNeighborIds: string[] = [];

    const rawHiddenColumns = (() => {
        // Get the immediate parent column for the current column
        const immediateParent = header.column.parent;

        // Initialize array to store hidden columns
        let hidden: string[] = [];

        // Get hidden siblings of current column
        if (immediateParent && currentDepth !== undefined) {
            const currentHiddenSiblings = getImmediateHiddenSiblings(
                header.column,
                currentDepth,
                columnOrder,
                columnVisibility,
            );
            hidden.push(...currentHiddenSiblings);
        }

        // Find the immediate right neighbors at the same depth that are hidden
        const currentColumnIndex = columnOrder.indexOf(header.column.id);
        if (currentColumnIndex !== -1) {
            // Look at columns to the right of the current column in the columnOrder array
            const allColumns = table.getAllFlatColumns();
            for (let i = currentColumnIndex; i < columnOrder.length; i++) {
                const colId = columnOrder[i];
                const col = allColumns.find(c => c.id === colId);

                // Skip if column or its metadata is not found
                if (!col || !col.columnDef.meta?.renderedDepth) continue;

                // If we find a column at the same depth
                const depth = isUtilColumn ? header.depth - 1 : currentDepth;  // Adjust depth for util columns

                // If no parent, check for hidden columns at the root level
                if (!col.parent?.id) {
                    const hiddenColumns = allColumns
                        .filter(c => c.columnDef.meta?.renderedDepth === depth && !columnVisibility[c.id])
                        .map(c => c.id)
                    hidden.push(...hiddenColumns)
                    break;
                }

                if (col.columnDef.meta.renderedDepth === depth) {
                    // Only consider as immediate right neighbor if it has a different parent
                    if (col.parent?.id !== header.column.parent?.id) {
                        // Get all siblings of this column (including itself)
                        const siblingIds = getImmediateSiblings(col, depth, columnOrder);
                        // Store all immediate right neighbors
                        immediateRightNeighborIds.push(...siblingIds);

                        // Get hidden siblings and store them separately
                        const hiddenSiblings = getImmediateHiddenSiblings(
                            col,
                            depth,
                            columnOrder,
                            columnVisibility,
                        );
                        hidden.push(...hiddenSiblings);
                        hiddenImmediateRightNeighborIds.push(...hiddenSiblings);
                    }

                    // Whether siblings were found or not, we break as we found the first column at our depth
                    break;
                }
            }
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
        if (!isParentColumn && (columnType === "params" || columnType === "util")) {
            return hiddenColumns.length > 0; // Show only if there are hidden columns
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
                                {column.split("/")[column.split("/").length - 1]}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>

    const derived = ColumnCreate ? ColumnCreate(header.column.id, setOpen) : null;
    
    return (
        <div className="absolute -right-2 z-10 hover:opacity-100 opacity-0 transition-all">
            <BaseDropdown button={columnButton} open={open} setOpen={setOpen}>
                {hiddenColumns.length > 0 && hidden}
                {header.column.columnDef.meta?.columnType === "entries" && derived}
            </BaseDropdown>
        </div>
    );
};

export default ColumnShow;
