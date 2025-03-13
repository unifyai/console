import { Filter, Group, LoaderCircle } from "lucide-react";
import { Ungroup } from "lucide-react";
import { Column, ColumnSort } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { getAllChildColumns, isAllChildrenGrouped } from "@/utils/evals/columnOperations";
import { useState, useEffect, forwardRef } from "react";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";

type ColumnGroupByProps = {
    interactive?: boolean,
    auto_update?: boolean,
    column: Column<any, unknown>,
    data: any[],
    grouping: string[],
    setGrouping: (grouping: string[]) => void,
    setGroupSorting?: (groupSorting: ColumnSort[]) => void,
    groupLoading: boolean,
    setGroupLoading: (groupLoading: boolean) => void,
    setGroupSortLoading?: (groupSortLoading: boolean) => void,
    setIsGrouped: (isGrouped: boolean) => void,
    renderMode: "button" | "menuItem"
}

const ColumnGroupBy = (({
    interactive,
    auto_update,
    column,
    data,
    grouping,
    setGrouping,
    setGroupSorting,
    groupLoading,
    setGroupLoading,
    setGroupSortLoading,
    setIsGrouped,
    renderMode = "button",
}: ColumnGroupByProps) => {

    /* Display loader when data updates */
    useEffect(() => {
        setGroupLoading(false);
    },[data])
    const [spinnerColor, setSpinnerColor] = useState("white");

    // Check if column has child columns
    const isParentColumn = column.columnDef.meta?.isParent;
    const isGrouped = isParentColumn 
        ? isAllChildrenGrouped(column, grouping)
        : grouping.includes(column.columnDef.id as string);

    useEffect(() => {
        setIsGrouped(isGrouped);
    }, [isGrouped])

    const states = [
        { 
            key: false, 
            tooltip: isParentColumn ? "Group all" : "Group by",
            icon: <Group/>
        },
        { 
            key: true, 
            tooltip: isParentColumn ? "Ungroup all" : "Ungroup by",
            icon: <Ungroup/>
        },
    ];

    const state = states.find(state => state.key === isGrouped)!;
    const tooltip = auto_update ? "Auto refresh doesn't work with grouping" : state.tooltip;
    const variant = isGrouped ? "primary" : undefined;
    const icon = groupLoading ? <LoaderCircle className={`animate-spin text-${spinnerColor}`}/> : state.icon;
    const onClick = () => {
        let newGrouping : string[] = [];
        if (isParentColumn) {
            const childColumns = getAllChildColumns(column);

            if (isGrouped) {
                // Remove all child columns from grouping at once
                newGrouping = grouping.filter(
                    id => !childColumns.some(col => col.columnDef.id === id)
                );
                setSpinnerColor("primary");
                setGroupLoading(true);
                setGrouping(newGrouping);
            } else {
                // Add all child columns to grouping at once
                newGrouping = [
                    ...grouping,
                    ...childColumns.map(col => col.columnDef.id).filter(id => !grouping.includes(id as string)) as string[]
                ];
                setSpinnerColor("white");
                setGroupLoading(true);
                setGrouping(newGrouping as string[]);
            }
        } else {
            newGrouping = grouping.includes(column.columnDef.id as string)
                ? grouping.filter(id => id !== column.columnDef.id) as string[]
                : [...grouping, column.columnDef.id as string];
            setSpinnerColor("white");
            setGroupLoading(true);
            setGrouping(newGrouping as string[]);
        }
        if (!newGrouping.length && setGroupSortLoading && setGroupSorting) {
            setGroupSortLoading(true)
            setGroupSorting([])
        }
    };

    return (
        renderMode === "menuItem" ? (
            <DropdownMenuItem onClick={onClick} className="flex items-center gap-2 cursor-pointer">
                <Group className="h-4 w-4"/>
                <span>{isParentColumn ? "Group children columns" : "Group column"}</span>
            </DropdownMenuItem>
        ) : (
            <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={interactive == false || auto_update}/>
        )
    );

});

export default ColumnGroupBy;
