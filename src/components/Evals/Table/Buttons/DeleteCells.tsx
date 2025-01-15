"use client";

import { useKeyPressEvent } from "react-use";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { useState } from "react";
import { ResponseProps } from "@/types/common";
import { LogFieldsProps, LogProps } from "@/types/evals/logs";
import { getPartAfterFirstUnderscore } from "@/utils/evals/selection";
import { processContext, sanitizeId } from "@/utils/evals/columnOperations";

const DeleteCells = ({ selectedCells, logs, deleteLogFields, context }: {
	selectedCells: string[],
	logs: LogProps[],
	deleteLogFields: (fields: LogFieldsProps) => Promise<ResponseProps>,
	context: string | undefined
}) => {
	const [showDialog, setShowDialog] = useState(false);
	
	const deletableCells = selectedCells.filter(cell => {
		const id = cell.split("_").at(0) as string
		const column = sanitizeId(getPartAfterFirstUnderscore(cell))
		const idMatch = (log: LogProps) => parseInt(log.id) === parseInt(id)
		const valueMatch = (log: LogProps) => log.entries[column] != undefined || log.params[column] != undefined
		return logs.findIndex(log => idMatch(log) && valueMatch(log)) != -1 
	})

	useKeyPressEvent("Backspace", () => {
		if (deletableCells.length > 0) {
			setShowDialog(true);
		}
	});

	useKeyPressEvent("Delete", () => {
		if (deletableCells.length > 0) {
			setShowDialog(true);
		}
	});

	const fieldsToDelete = deletableCells.map(cell => [
		parseInt(cell.split("_").at(0) as string), 
		context ? processContext("merge", context, sanitizeId(getPartAfterFirstUnderscore(cell))) : sanitizeId(getPartAfterFirstUnderscore(cell)) 
	])

	return (showDialog &&
		<DeleteDialog
			deletingFunction={deleteLogFields}
			resource={fieldsToDelete}
			type="log entries"
			showDialog={showDialog}
			setShowDialog={setShowDialog}
		/>
	);
}
export default DeleteCells;
