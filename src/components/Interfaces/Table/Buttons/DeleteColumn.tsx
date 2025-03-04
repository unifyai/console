"use client";

import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { useState } from "react";
import { processContext, sanitizeId } from "@/utils/evals/columnOperations";
import { LogsActions } from "@/types/evals/grid";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Trash } from "lucide-react";

type ColumnDeleteProps = {
    interactive: boolean,
    project: string,
    context: string | undefined,
    columnContext: string | undefined,
    column: string,
    getLogFieldsIds: LogsActions["get"],
    deleteLogFields: LogsActions["delete"]
}
    
const ColumnDelete = ({ interactive, project, column, getLogFieldsIds, deleteLogFields, context, columnContext }: ColumnDeleteProps) => {
	const [showDialog, setShowDialog] = useState(false);
    
    const sanitizedField = columnContext ? processContext("merge", columnContext, sanitizeId(column)) : sanitizeId(column)
	const args = [project, context, [[null, sanitizedField]], "all"]
    const dialog = (showDialog &&
		<DeleteDialog
			deletingFunction={deleteLogFields}
			args={args}
			type="column"
			showDialog={showDialog}
			setShowDialog={setShowDialog}
		/>
	);
    const handleButtonClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setShowDialog(true);
    }

    return (
        <DropdownMenuItem 
            className="flex items-center gap-2 cursor-pointer"
            onSelect={(e) => e.preventDefault()} // Prevent dropdown close
        >
            <div 
                onClick={handleButtonClick} 
                className="flex flex-row gap-2 items-center"
            >
                <Trash className="h-4 w-4"/>
                <span>Delete Column</span>
            </div>
            {dialog}
        </DropdownMenuItem>
    )
}
export default ColumnDelete;
