import { Group } from "lucide-react";
import { Ungroup } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { getAllChildColumns, isAllChildrenGrouped } from "@/utils/evals/column-operations";

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
    const isParentColumn = column.columns?.length > 0;
    
    const isGrouped = isParentColumn 
        ? isAllChildrenGrouped(column, grouping)
        : grouping.includes(column.id);

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
                    id => !childColumns.some(col => col.id === id)
                );
                setGrouping(newGrouping);
            } else {
                // Add all child columns to grouping at once
                const newGrouping = [
                    ...grouping,
                    ...childColumns.map(col => col.id).filter(id => !grouping.includes(id))
                ];
                setGrouping(newGrouping);
            }
        } else {
            const newGrouping = grouping.includes(column.id)
                ? grouping.filter(id => id !== column.id)
                : [...grouping, column.id];
            setGrouping(newGrouping);
        }
    };

    return (
        <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick}/>
    );
}

export default ColumnGroupBy;
