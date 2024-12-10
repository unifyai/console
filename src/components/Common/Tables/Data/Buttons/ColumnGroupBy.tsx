import { Group } from "lucide-react";
import { Ungroup } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";

const ColumnGroupBy = ({column}: {
    column: Column<any, unknown>
}) => {
    return (
        <ActionButton
            tooltip={`${column.getIsGrouped() ? "Ungroup by" : "Group by"}`}
            icon={column.getIsGrouped() ? <Ungroup/> : <Group/>}
            onClick={() => column.toggleGrouping()}
        />
    );
}

export default ColumnGroupBy;
