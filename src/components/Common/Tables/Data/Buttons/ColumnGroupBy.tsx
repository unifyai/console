import { Group } from "lucide-react";
import { Ungroup } from "lucide-react";
import { Column } from "@tanstack/react-table";
import ActionButton from "@/components/Common/Buttons/Action";

const ColumnGroupBy = ({column}: {
    column: Column<any, unknown>
}) => {
    const states = [
        { key: false, tooltip: "Ungroup by", icon: <Group/> },
        { key: true, tooltip: "Group by", icon: <Ungroup/> },
    ];
    const state = states.find(state => state.key === column.getIsGrouped())!;
    const tooltip = state.tooltip;
    const variant = column.getIsGrouped() ? "primary" : undefined;
    const icon = state.icon;
    const onClick = () => column.toggleGrouping();
    return (
        <ActionButton tooltip={tooltip} icon={icon} variant={variant} onClick={onClick}/>
    );
}

export default ColumnGroupBy;
