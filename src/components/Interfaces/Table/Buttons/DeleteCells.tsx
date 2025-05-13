"use client";

import { useKeyPressEvent } from "react-use";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { useState } from "react";
import { ResponseProps } from "@/types/common";
import { GroupedLogProps, LogFieldsProps, LogProps } from "@/types/evals/logs";
import { getPartAfterFirstUnderscore } from "@/utils/evals/selection";
import { processContext, sanitizeId } from "@/utils/evals/columnOperations";
import { maybeFlattenGroupedLogs } from "@/utils/evals/grouping";
import { useRouter } from "next/navigation";

const DeleteCells = ({ project, selectedCells, logs, deleteLogFields, context, columnContext, refresh, setPending }: {
	project: string,
	selectedCells: string[],
	logs: LogProps[] | GroupedLogProps[],
	deleteLogFields: (project: string, context: string | null, ids_and_fields: LogFieldsProps, source_type: string | null) => Promise<ResponseProps>,
	context: string | undefined,
	columnContext: string | undefined,
    refresh: () => Promise<ResponseProps>,
    setPending: (pending: boolean) => void
}) => {

	const router = useRouter();
    const onDelete = () => {
        refresh().then(() => {
            router.refresh();
            setPending(true);
        });
    }

	const [showDialog, setShowDialog] = useState(false);
	
	const flattenedLogs = maybeFlattenGroupedLogs(logs);
	const deletableCells = selectedCells.filter(cell => {
		const id = cell.split("_").at(0) as string
		const column = sanitizeId(getPartAfterFirstUnderscore(cell))
		const idMatch = (log: LogProps) => parseInt(log.id) === parseInt(id)
		const valueMatch = (log: LogProps) => log.entries[column] != undefined || log.params[column] != undefined
		return flattenedLogs.findIndex(log => idMatch(log) && valueMatch(log)) != -1 
	})

	useKeyPressEvent("Backspace", (event) => {
		// Check if the event target is an input, textarea, or other editable element
		const target = event.target as HTMLElement;
		const isEditableElement = 
			target.tagName === "INPUT" || 
			target.tagName === "TEXTAREA" || 
			target.contentEditable === "true";
		
		// Only proceed if not in an editable element and we have deletable cells
		if (!isEditableElement && deletableCells.length > 0) {
			setShowDialog(true);
		}
	});

	useKeyPressEvent("Delete", (event) => {
		// Check if the event target is an input, textarea, or other editable element
		const target = event.target as HTMLElement;
		const isEditableElement = 
			target.tagName === "INPUT" || 
			target.tagName === "TEXTAREA" || 
			target.contentEditable === "true";
		
		// Only proceed if not in an editable element and we have deletable cells
		if (!isEditableElement && deletableCells.length > 0) {
			setShowDialog(true);
		}
	});

	const fieldsToDelete = deletableCells.map(cell => [
		parseInt(cell.split("_").at(0) as string), 
		columnContext ? processContext("merge", columnContext, sanitizeId(getPartAfterFirstUnderscore(cell))) : sanitizeId(getPartAfterFirstUnderscore(cell))
	])

	const args = [project, context, fieldsToDelete]

	return (showDialog &&
		<DeleteDialog
			deletingFunction={deleteLogFields}
			args={args}
			type="log entries"
			showDialog={showDialog}
			setShowDialog={setShowDialog}
			onDelete={onDelete}
		/>
	);
}
export default DeleteCells;
