"use client";

import { useEffect, useState, forwardRef } from "react";
import { FolderTree, Group, LoaderCircle } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { sanitizeId } from "@/utils/interfaces/table/columnOperations";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";

type ColumnContextProps = {
    interactive?: boolean,
    column: Column<any, unknown>,
    context: string | null,
    setContext: (context: string | null) => void,
    data: any[],
    renderMode: "button" | "menuItem"
}

const ColumnContext = (({
    interactive,
    column,
    context,
    setContext,
    data,
    renderMode
}: ColumnContextProps) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[data])

    const sanitizedId = sanitizeId(column.columnDef.id as string);
    const isActive = context === sanitizedId;

    const tooltip = isActive
        ? `Unset Context`
        : `Set ${column.columnDef.header} Context`;

    const variant = isActive ? "primary" : undefined;

    const onClick = () => {
        setContext(isActive ? null : sanitizedId);
        setLoading(true);
    };

    const icon = loading ? <LoaderCircle className="animate-spin text-white"/> : <FolderTree />;

    return (
        renderMode === "menuItem" ? (
            <DropdownMenuItem onClick={onClick} className="flex items-center gap-2 cursor-pointer">
                <FolderTree className="h-4 w-4"/>
                <span>Set as context</span>
            </DropdownMenuItem>
        ) : (
            <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick} disabled={interactive == false || loading}
        />
        )
    );
});

export default ColumnContext;
