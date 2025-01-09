import { Column } from "@tanstack/react-table";

export function getAllChildColumns(column: Column<any>): Column<any>[] {
    const children: Column<any>[] = [];
    
    if (column.columns) {
        column.columns.forEach(childColumn => {
            children.push(childColumn);
            children.push(...getAllChildColumns(childColumn));
        });
    }
    
    return children;
}

export function isAllChildrenGrouped(column: Column<any>, grouping: string[]): boolean {
    const children = getAllChildColumns(column);
    const allGrouped = children.length > 0 && children.every(child => grouping.includes(child.id));
    
    return allGrouped;
}
