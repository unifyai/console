"use client";

import { useEffect, useState } from "react";
import { FolderTree, LoaderCircle } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { sanitizeId } from "@/utils/evals/columnOperations";

const ColumnContext = ({
    interactive,
    column,
    context,
    setContext,
    data
}: {
    interactive?: boolean,
    column: Column<any, unknown>,
    context: string | null,
    setContext: (context: string | null) => void,
    data: any[]
}) => {

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
            tooltip={tooltip}
            icon={icon}
            variant={variant}
            onClick={onClick}
            disabled={interactive == false || loading}
        />
    );
};

export default ColumnContext;
