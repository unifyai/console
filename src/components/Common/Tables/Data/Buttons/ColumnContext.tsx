import { FolderTree } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";
import { sanitizeId } from "@/utils/evals/columnOperations";

const ColumnContext = ({
    interactive,
    column,
    context,
    setContext
}: {
    interactive?: boolean,
    column: Column<any, unknown>,
    context: string | null,
    setContext: (context: string | null) => void
}) => {
    const sanitizedId = sanitizeId(column.columnDef.id as string);
    const isActive = context === sanitizedId;

    const tooltip = isActive
        ? `Unset Context`
        : `Set ${column.columnDef.header} Context`;

    const variant = isActive ? "primary" : undefined;

    const onClick = () => {
        setContext(isActive ? null : sanitizedId);
    };

    return (
        <ActionButton
            tooltip={tooltip}
            icon={<FolderTree />}
            variant={variant}
            onClick={onClick}
            disabled={interactive == false}
        />
    );
};

export default ColumnContext;
