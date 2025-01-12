import { LogProps } from "@/types/evals/logs";
import { Column, ColumnDef } from "@tanstack/react-table";

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
  Flatten columns recursively to include all parent and child columns
*/
export const flattenColumnIDs = (columns: ColumnDef<LogProps>[]): string[] =>
    columns.flatMap((column) => {
        // Include the current column's id
        const currentIDs = column.id || "";

        // Recursively flatten child columns, if they exist
        const childPaths = (column as any).columns
        ? flattenColumnIDs((column as any).columns as ColumnDef<LogProps>[])
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
