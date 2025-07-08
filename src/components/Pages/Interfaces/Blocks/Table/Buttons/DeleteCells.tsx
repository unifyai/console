"use client";

import { useKeyPressEvent } from "react-use";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { useState, useCallback } from "react";
import { ResponseProps } from "@/types/common";
import { GroupedLogProps, LogFieldsProps, LogProps } from "@/types/interfaces/logs";
import { getPartAfterFirstUnderscore } from "@/utils/interfaces/selection/selection";
import { processContext, sanitizeId } from "@/utils/interfaces/table/columnOperations";
import { maybeFlattenGroupedLogs } from "@/utils/interfaces/table/grouping";
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
		return flattenedLogs.findIndex(log => idMatch(log)) !== -1
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

	const args = fieldsToDelete.length > 0 ? [project, context, fieldsToDelete, 'all'] : [];

	// Show remove-from-context only if every selected row has all its fields selected
	const selectedIds = Array.from(new Set(deletableCells.map(cell => cell.split('_')[0] as string)));
	let removeLabel: string | undefined;
	if (selectedIds.length > 0) {
		const allMatch = selectedIds.every(rowId => {
			const log = flattenedLogs.find(l => String(l.id) === rowId) as LogProps | undefined;
			if (!log) return false;
			const totalFields = Object.keys((log as any).params || {}).length
				+ Object.keys((log as any).entries || {}).length;
			const selectedCount = deletableCells.filter(cell => cell.split('_')[0] === rowId).length;
			return selectedCount === totalFields;
		});
		if (allMatch) {
			removeLabel = 'Remove from this context only';
		}
	}

	return (showDialog &&
		<DeleteDialog
			deletingFunction={deleteLogFields}
			args={args}
			type="log entries"
			showDialog={showDialog}
			setShowDialog={setShowDialog}
			onDelete={onDelete}
			removeLabel={removeLabel}
		/>
	);
}
export default DeleteCells;