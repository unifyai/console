import { Group } from "lucide-react";
import { Ungroup } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { getAllChildColumns, isAllChildrenGrouped } from "@/utils/evals/columnOperations";

const ColumnGroupBy = ({
    column,
    grouping,
    setGrouping
}: {
    column: Column<any, unknown>,
    grouping: string[],
    setGrouping: (grouping: string[]) => void
}) => {
    // Check if column has child columns
    const isParentColumn = column.columnDef.meta?.isParent;
    const isGrouped = isParentColumn 
        ? isAllChildrenGrouped(column, grouping)
        : grouping.includes(column.columnDef.id as string);

    const states = [
        { 
            key: false, 
            tooltip: isParentColumn ? "Group All" : "Group by", 
            icon: <Group/>
        },
        { 
            key: true, 
            tooltip: isParentColumn ? "Ungroup All" : "Ungroup by", 
            icon: <Ungroup/>
        },
    ];

    const state = states.find(state => state.key === isGrouped)!;
    const tooltip = state.tooltip;
    const variant = isGrouped ? "primary" : undefined;
    const icon = state.icon;
    const onClick = () => {
        if (isParentColumn) {
            const childColumns = getAllChildColumns(column);

            if (isGrouped) {
                // Remove all child columns from grouping at once
                const newGrouping = grouping.filter(
                    id => !childColumns.some(col => col.columnDef.id === id)
                );
                setGrouping(newGrouping);
            } else {
                // Add all child columns to grouping at once
                const newGrouping = [
                    ...grouping,
                    ...childColumns.map(col => col.columnDef.id).filter(id => !grouping.includes(id as string))
                ];
                setGrouping(newGrouping as string[]);
            }
        } else {
            const newGrouping = grouping.includes(column.columnDef.id as string)
                ? grouping.filter(id => id !== column.columnDef.id)
                : [...grouping, column.columnDef.id];

            setGrouping(newGrouping as string[]);
        }
    };

    return (
        <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick}/>
    );
}

export default ColumnGroupBy;
