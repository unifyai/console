"use client";

import { useKeyPressEvent } from "react-use";
import DeleteDialog from "@/components/Common/Dialogs/Delete";
import { Row } from "@tanstack/react-table";
import { useState } from "react";
import { ResponseProps } from "@/types/common";

const DeleteRows = ({ selectedRows, deleteLogs }: {
	selectedRows: Row<any | unknown>[],
	deleteLogs: (ids: string[]) => Promise<ResponseProps>,
}) => {
	const [showDialog, setShowDialog] = useState(false);

	useKeyPressEvent("Backspace", () => {
		if (selectedRows.length > 0) {
			setShowDialog(true);
		}
	});

	useKeyPressEvent("Delete", () => {
		if (selectedRows.length > 0) {
			setShowDialog(true);
		}
	});

	return (showDialog &&
		<DeleteDialog
			deletingFunction={deleteLogs}
			resource={selectedRows.map((row) => row.original.id)}
			type="logs"
			showDialog={showDialog}
			setShowDialog={setShowDialog}
		/>
	);
}
export default DeleteRows;
