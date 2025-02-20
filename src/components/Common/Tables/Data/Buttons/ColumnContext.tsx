"use client";

import { useEffect, useState } from "react";
import { FolderTree, LoaderCircle } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { sanitizeId } from "@/utils/evals/columnOperations";

type ColumnContextProps = {
    interactive?: boolean,
    column: Column<any, unknown>,
    context: string | null,
    setContext: (context: string | null) => void,
    data: any[],
    renderMode?: "button" | "menuItem"
}

const ColumnContext = ({
    interactive,
    column,
    context,
    setContext,
    data,
    renderMode = "button"
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

    const onClick = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        setContext(isActive ? null : sanitizedId);
        setLoading(true);
    };

    const icon = loading ? <LoaderCircle className="animate-spin text-white"/> : <FolderTree />;

    if (renderMode === "menuItem") {
        return (
            <div onClick={onClick} className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0">
                <FolderTree className="h-4 w-4" />
                <span>{isActive ? "Unset context" : "Set as context"}</span>
            </div>
        );
    }

    return (
        <ActionButton
            tooltip={tooltip}
            icon={icon}
            variant={variant}
            onClick={onClick}
            disabled={interactive == false || loading}
        />
    );
};

export default ColumnContext;
