import { Column } from "@tanstack/react-table";
import { CircleMinus, Minus } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

const ColumnHide = ({column}: {column: Column<any | unknown>}) => {
    return <ActionButton tooltip="Hide" icon={<CircleMinus />} onClick={() => column.toggleVisibility()}/>
}

export default ColumnHide;
