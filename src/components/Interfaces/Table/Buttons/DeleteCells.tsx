"use client";

import { useKeyPressEvent } from "react-use";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { useState, useCallback } from "react";
import { ResponseProps } from "@/types/common";
import { GroupedLogProps, LogFieldsProps, LogProps } from "@/types/evals/logs";
import { getPartAfterFirstUnderscore } from "@/utils/evals/selection";
import { processContext, sanitizeId } from "@/utils/evals/columnOperations";
import { maybeFlattenGroupedLogs } from "@/utils/evals/grouping";
import { useRouter } from "next/navigation";

const DeleteCells = ({ project, selectedCells, logs, deleteLogFields, context, columnContext, setPending }: {
	project: string,
	selectedCells: string[],
	logs: LogProps[] | GroupedLogProps[],
	deleteLogFields: (project: string, context: string | null, ids_and_fields: LogFieldsProps, source_type: string | null) => Promise<ResponseProps>,
	context: string | undefined,
	columnContext: string | undefined,
    setPending: (pending: boolean) => void
}) => {

	const router = useRouter();
    const onDelete = () => {
        router.refresh();
        setPending(true);
    }

	const [showDialog, setShowDialog] = useState(false);

	const flattenedLogs = maybeFlattenGroupedLogs(logs);
	const deletableCells = selectedCells.filter(cell => {
		const id = cell.split("_").at(0) as string
		const column = sanitizeId(getPartAfterFirstUnderscore(cell))
		const idMatch = (log: LogProps) => String(log.id) === String(id)
		return flattenedLogs.findIndex(log => idMatch(log))
	})

	// Skip dialog trigger when pressing backspace / delete within an editable element
    const handlePotentialDeleteKey = useCallback((event: KeyboardEvent) => {
        if (deletableCells.length === 0) {
            return;
        }
        const target = event.target as HTMLElement;
        const isEditingInput = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );
        if (!isEditingInput && deletableCells.length > 0) {
            setShowDialog(true);
        }
    }, [deletableCells, setShowDialog]);

	useKeyPressEvent("Backspace", handlePotentialDeleteKey);
	useKeyPressEvent("Delete", handlePotentialDeleteKey);

	const fieldsToDelete = deletableCells.map(cell => [
		parseInt(cell.split("_").at(0) as string),
		columnContext ? processContext("merge", columnContext, sanitizeId(getPartAfterFirstUnderscore(cell))) : sanitizeId(getPartAfterFirstUnderscore(cell))
	])

	const args = fieldsToDelete.length > 0 ? [project, context, { fields: fieldsToDelete }, null] : [];

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