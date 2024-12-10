import { Column } from "@tanstack/react-table";
import { X } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

const ColumnHide = ({column}: {column: Column<any | unknown>}) => {
    return <ActionButton tooltip="Hide" icon={<X/>} onClick={() => column.toggleVisibility()}/>
}

export default ColumnHide;
