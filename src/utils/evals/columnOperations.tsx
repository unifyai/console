import { LogProps, GroupedLogProps } from "@/types/evals/logs";
import { Column, ColumnDef, Table } from "@tanstack/react-table";

/*
  Utility function to sanitize column IDs.
  Removes "Parameters/" or "Entries/" from the beginning of the string if they exist.
*/
 export function sanitizeId(id: string): string {
    if (id.startsWith("Parameters/")) {
        return id.slice("Parameters/".length);
    }
    if (id.startsWith("Entries/")) {
        return id.slice("Entries/".length);
    }
    return id;
}

/*
  Utility function to handle splitting and merging of context and column keys.
  Respects leading/trailing "/" gracefully and handles null/undefined inputs.
*/
export function processContext(
    operation: "split" | "merge",  // 'split' or 'merge'
    context: string | null | undefined,  // The context string (e.g., "Academics/STEM/Physics")
    input: string | null | undefined  // The full path string (e.g., "Academics/STEM/Physics/ans") when splitting or the column key (e.g., "ans") when merging.
): string {
    // Handle null or undefined cases gracefully
    if (!context && !input) {
        return ""; // Both are null/undefined, return an empty string
    }

    if (operation === "split") {
        if (!input) {
            return ""; // No input, return empty string
        }
        if (!context || !input.startsWith(context)) {
            return input; // If context is null/undefined or doesn't match, return input as-is
        }
        // Remove the context and any leading slashes
        return input.slice(context.length).replace(/^\/+/, "");
    } else if (operation === "merge") {
        if (!context) {
            return input || ""; // If context is null/undefined, return input as-is or empty string
        }
        if (!input) {
            return context; // If input is null/undefined, return context as-is
        }
        // Ensure context ends with "/" if not already and concatenate with the column key
        return context.replace(/\/+$/, "") + "/" + input.replace(/^\/+/, "");
    }
    throw new Error("Invalid operation. Use 'split' or 'merge'.");
}

/*
  Flatten columns recursively to include all parent and child columns
*/
export const flattenColumnIDs = (columns: ColumnDef<LogProps | GroupedLogProps>[]): string[] =>
    columns.flatMap((column) => {
        // Include the current column's id
        const currentIDs = column.id || "";

        // Recursively flatten child columns, if they exist
        const childPaths = (column as any).columns
        ? flattenColumnIDs((column as any).columns as ColumnDef<LogProps | GroupedLogProps>[])
        : [];

        // Return the current path along with child paths
        return [currentIDs, ...childPaths];
    });

export function getAllChildColumns(column: Column<any>):  Column<any>[] {
    const children:  Column<any>[] = [];

    if (column.columnDef.meta?.isParent) {
        column.columns.forEach(childColumn => {
            children.push(childColumn);
            children.push(...getAllChildColumns(childColumn));
        });
    }

    return children;
}

export function isAllChildrenGrouped(column: Column<any>, grouping: string[]): boolean {
    const children = getAllChildColumns(column);
    const allGrouped = children.length > 0 && children.every(child => grouping.includes(child.columnDef.id as string));

    return allGrouped;
}

/*
  Utility function to recursively update child visibility
*/
export const updateChildrenVisibility = (
    visibility: { [key: string]: boolean },
    parentKey: string,
    isVisible: boolean
): { [key: string]: boolean } => {
    const updatedVisibility = { ...visibility };

    Object.keys(visibility).forEach((key) => {
        // Match children of the current parent using the parentKey
        if (key.startsWith(`${parentKey}/`)) {
            updatedVisibility[key] = isVisible; // Set visibility
            // Recursively update children of the current child
            Object.assign(updatedVisibility, updateChildrenVisibility(updatedVisibility, key, isVisible));
        }
    });

    // After updating children, ensure parent visibility matches if all children match
    const childKeys = Object.keys(visibility).filter((key) => key.startsWith(`${parentKey}/`));
    const allChildrenMatch = childKeys.every((childKey) => updatedVisibility[childKey] === isVisible);

    if (allChildrenMatch) {
        updatedVisibility[parentKey] = isVisible;
    }

    return updatedVisibility;
};
  
/*
  Utility function to recursively update parent visibility
*/
export const updateParentVisibility = (
    visibility: { [key: string]: boolean },
    childKey: string
): { [key: string]: boolean } => {
    const updatedVisibility = { ...visibility };
    const parentKey = childKey.substring(0, childKey.lastIndexOf("/")); // Get the parent key

    if (parentKey) {
        // Check all siblings of the current child
        const siblingKeys = Object.keys(visibility).filter(
            (key) => key.startsWith(`${parentKey}/`) && key !== childKey
        );
        const allSiblingsVisible = siblingKeys.every((siblingKey) => updatedVisibility[siblingKey]);
        const allSiblingsHidden = siblingKeys.every((siblingKey) => !updatedVisibility[siblingKey]);
  
         // If all siblings and the current child are visible/hidden, update the parent visibility
        if ((allSiblingsVisible && updatedVisibility[childKey]) || (allSiblingsHidden && !updatedVisibility[childKey])) {
            updatedVisibility[parentKey] = updatedVisibility[childKey];
    
            // Recursively update the parent's parent
            Object.assign(updatedVisibility, updateParentVisibility(updatedVisibility, parentKey));
        }
    }
    return updatedVisibility;
};
  
/*
  Main function to update visibility for a given column
*/
export const updateColumnVisibility = (
    visibility: { [key: string]: boolean },
    columnKey: string,
    isVisible: boolean
): { [key: string]: boolean } => {
    let updatedVisibility = { ...visibility };
  
    // Update children recursively if the column is a parent
    if (Object.keys(visibility).some((key) => key.startsWith(`${columnKey}/`))) {
        updatedVisibility = updateChildrenVisibility(updatedVisibility, columnKey, isVisible);
    }

    // Update the column itself
    updatedVisibility[columnKey] = isVisible;

    // Check and update parent columns recursively
    updatedVisibility = updateParentVisibility(updatedVisibility, columnKey);
    return updatedVisibility;
};

/*
  Utility function to get immediate siblings for a column. The returned
  siblings respect the order defined in the columnOrder array.
*/
export const getImmediateSiblings = (
    column: Column<any, unknown>,
    currentDepth: number,
    columnOrder: string[]
): string[] => {
    if (!column.parent) return [];

    const siblingColumns = column.parent.columns;
    return siblingColumns
        .filter((siblingCol: Column<any, unknown>) => 
            siblingCol.columnDef.meta?.renderedDepth === currentDepth && 
            columnOrder.includes(siblingCol.id as string)
        )
        .map((siblingCol: Column<any, unknown>) => siblingCol.id as string)
        .sort((a, b) => columnOrder.indexOf(a) - columnOrder.indexOf(b));  // Sort based on columnOrder indices
};

/*
  Utility function to get immediate hidden siblings for a column
*/
export const getImmediateHiddenSiblings = (
    column: Column<any, unknown>,
    currentDepth: number,
    columnOrder: string[],
    columnVisibility: { [key: string]: boolean }
): string[] => {
    if (!column.parent) return [];

    const immediateSiblings = getImmediateSiblings(column, currentDepth, columnOrder);
    return immediateSiblings.filter((sibling) => !columnVisibility[sibling]);
};

/*
  Get the next column at the same rendered depth
*/
export const getNextColumnAtSameDepth = (
    column: Column<any, unknown>,
    columnOrder: string[],
    table: Table<any>
): Column<any, unknown> | undefined => {
    const currentDepth = column.columnDef.meta?.renderedDepth;
    const currentIndex = columnOrder.indexOf(column.id);
    
    if (currentIndex === -1 || currentDepth === undefined) return undefined;

    const allColumns = table.getAllColumns();
    
    // Look through columns after the current one
    for (let i = currentIndex + 1; i < columnOrder.length; i++) {
        const nextColId = columnOrder[i];
        const nextCol = allColumns.find(c => c.id === nextColId);
        
        if (nextCol && nextCol.columnDef.meta?.renderedDepth === currentDepth) {
            return nextCol;
        }
    }
    
    return undefined;
};

/*
  Get the previous column at the same rendered depth
*/
export const getPreviousColumnAtSameDepth = (
    column: Column<any, unknown>,
    columnOrder: string[],
    table: Table<any>
): Column<any, unknown> | undefined => {
    const currentDepth = column.columnDef.meta?.renderedDepth;
    const currentIndex = columnOrder.indexOf(column.id);
    
    if (currentIndex === -1 || currentDepth === undefined) return undefined;

    const allColumns = table.getAllColumns();

    // Look through columns before the current one
    for (let i = currentIndex - 1; i >= 0; i--) {
        const prevColId = columnOrder[i];
        const prevCol = allColumns.find(c => c.id === prevColId);
        
        if (prevCol && prevCol.columnDef.meta?.renderedDepth === currentDepth) {
            return prevCol;
        }
    }
    
    return undefined;
};

/*
  Get the next leaf column in the column order
*/
export const getNextLeafColumn = (
    column: Column<any, unknown>,
    columnOrder: string[],
    table: Table<any>
): Column<any, unknown> | undefined => {
    const currentIndex = columnOrder.indexOf(column.id);
    if (currentIndex === -1) return undefined;
    
    const leafColumns = table.getAllLeafColumns();
    const currentLeafIndex = leafColumns.findIndex(c => c.id === column.id);
    
    if (currentLeafIndex === -1 || currentLeafIndex === leafColumns.length - 1) return undefined;
    
    return leafColumns[currentLeafIndex + 1];
};

/*
  Get the previous leaf column in the column order
*/
export const getPreviousLeafColumn = (
    column: Column<any, unknown>,
    columnOrder: string[],
    table: Table<any>
): Column<any, unknown> | undefined => {
    const currentIndex = columnOrder.indexOf(column.id);
    if (currentIndex === -1) return undefined;
    
    const leafColumns = table.getAllLeafColumns();
    const currentLeafIndex = leafColumns.findIndex(c => c.id === column.id);
    
    if (currentLeafIndex <= 0) return undefined;
    
    return leafColumns[currentLeafIndex - 1];
};
