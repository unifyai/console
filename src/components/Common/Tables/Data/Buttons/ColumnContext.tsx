"use client";

import { useEffect, useState, forwardRef } from "react";
import { FolderTree, LoaderCircle } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { sanitizeId } from "@/utils/evals/columnOperations";

type ColumnContextProps = {
    interactive?: boolean,
    column: Column<any, unknown>,
    context: string | null,
    setContext: (context: string | null) => void,
    data: any[]
}

const ColumnContext = forwardRef<HTMLButtonElement, ColumnContextProps>(({
    interactive,
    column,
    context,
    setContext,
    data
}, ref) => {

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
        <ActionButton
            ref={ref}
            tooltip={tooltip}
            icon={icon}
            variant={variant}
            onClick={onClick}
            disabled={interactive == false || loading}
        />
    );
});

ColumnContext.displayName = "ColumnContext";

export default ColumnContext;
