"use client";

import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { useState, useRef } from "react";
import { processContext, sanitizeId } from "@/utils/interfaces/table/columnOperations";
import { LogsActions } from "@/types/interfaces/grid";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Trash } from "lucide-react";
import { useTableAutoUpdateQuery } from "@/hooks/Interfaces/Query/useTableAutoUpdateQuery";
import { FieldsActions } from "@/types/interfaces/grid";
import { ContextActions } from "@/types/interfaces/grid";
import { ProjectsActions } from "@/types/interfaces/grid";

type ColumnDeleteProps = {
    tileId: string,
    tabId: string,
    project: string,
    context: string | undefined,
    columnContext: string | undefined,
    column: string,
    interactive: boolean,
    setPending: (pending: boolean) => void,
    getLogFieldsIds: LogsActions["get"],
    deleteLogFields: LogsActions["delete"],
    logsActions: LogsActions,
    projectsActions: ProjectsActions,
    contextActions: ContextActions,
    fieldsActions: FieldsActions
}
    
const ColumnDelete = ({ 
    tileId, 
    tabId, 
    project, 
    context, 
    columnContext, 
    column, 
    interactive, 
    setPending, 
    getLogFieldsIds, 
    deleteLogFields,
    logsActions,
    projectsActions,
    contextActions,
    fieldsActions
}: ColumnDeleteProps) => {
	
    const [showDialog, setShowDialog] = useState(false);
    const pendingRef = useRef(false);
    
    // Use the table auto-update hook to get manual refresh functionality
    const { manualRefresh } = useTableAutoUpdateQuery(
        tileId,
        tabId,
        project,
        pendingRef.current,
        logsActions,
        projectsActions,
        contextActions,
        fieldsActions,
    );

    const onDelete = async () => {
        // Set table pending state and use manual refresh
        setPending(true);
        await manualRefresh();
        setPending(false); // Only clear pending after manual refresh completes
    }

    const sanitizedField = columnContext ? processContext("merge", columnContext, sanitizeId(column)) : sanitizeId(column)
	const args = [project, context, [[null, sanitizedField]]]

    const dialog = (showDialog &&
		<DeleteDialog
			deletingFunction={deleteLogFields}
			args={args}
			type="column"
			showDialog={showDialog}
			setShowDialog={setShowDialog}
            onDelete={onDelete}
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
                <span>Delete column</span>
            </div>
            {dialog}
        </DropdownMenuItem>
    )
}
export default ColumnDelete;
