import { Group, LoaderCircle } from "lucide-react";
import { Ungroup } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { getAllChildColumns, isAllChildrenGrouped } from "@/utils/evals/columnOperations";
import { useState, useEffect } from "react";

const ColumnGroupBy = ({
    interactive,
    column,
    data,
    grouping,
    setGrouping
}: {
    interactive?: boolean,
    column: Column<any, unknown>,
    data: any[],
    grouping: string[],
    setGrouping: (grouping: string[]) => void
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[data])

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
    const icon = loading ? <LoaderCircle className="animate-spin text-white"/> : state.icon;
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
        <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={interactive == false}/>
    );
}

export default ColumnGroupBy;
