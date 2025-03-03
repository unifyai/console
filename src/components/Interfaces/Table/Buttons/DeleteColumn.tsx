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
    
    const deletingFunction = async (project: string, context : string | null) => {
        const sanitizedField = columnContext ? processContext("merge", columnContext, sanitizeId(column)) : sanitizeId(column)
        const ids : any = await getLogFieldsIds(project, context ?? null, columnContext ?? null, null, null, null, null, sanitizedField, null, null, null, null, "True", null)
        const fieldsToDelete : [number, string][] = ids.map((id: number) => ([id, sanitizeId(column)]))
        return deleteLogFields(project, context, fieldsToDelete, "all")
    }
	const args = [project, context]
    const dialog = (showDialog &&
		<DeleteDialog
			deletingFunction={deletingFunction}
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
