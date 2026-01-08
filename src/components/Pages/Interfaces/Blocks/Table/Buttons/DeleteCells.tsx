'use client';

import { useKeyPressEvent } from 'react-use';
import DeleteDialog from '@/components/Common/Dialogs/Delete';
import { useState, useCallback, useRef } from 'react';
import { GroupedLogProps, LogProps } from '@/types/interfaces/logs';
import { getPartAfterFirstUnderscore } from '@/utils/interfaces/selection/selection';
import { processContext, sanitizeId } from '@/utils/interfaces/table/columnOperations';
import { maybeFlattenGroupedLogs } from '@/utils/interfaces/table/grouping';
import { useTableAutoUpdateQuery } from '@/hooks/Interfaces/Query/useTableAutoUpdateQuery';
import {
  ProjectsActions,
  ContextActions,
  FieldsActions,
  LogsActions,
} from '@/types/interfaces/grid';

const DeleteCells = ({
  projectId,
  tabId,
  tileId,
  selectedCells,
  logs,
  context,
  columnContext,
  setPending,
  projectsActions,
  logsActions,
  contextActions,
  fieldsActions,
}: {
  projectId: string;
  tabId: string;
  tileId: string;
  selectedCells: string[];
  logs: LogProps[] | GroupedLogProps[];
  context: string | undefined;
  columnContext: string | undefined;
  setPending: (pending: boolean) => void;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  contextActions: ContextActions;
  fieldsActions: FieldsActions;
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const pendingRef = useRef(false);

  // Use the table auto-update hook to get manual refresh functionality
  const { manualRefresh } = useTableAutoUpdateQuery(
    tileId,
    tabId,
    projectId,
    pendingRef.current,
    logsActions,
    projectsActions,
    contextActions,
    fieldsActions
  );

  const onDelete = async () => {
    // Set table pending state and use manual refresh
    setPending(true);
    await manualRefresh();
    setPending(false); // Only clear pending after manual refresh completes
  };

  const flattenedLogs = maybeFlattenGroupedLogs(logs);
  const deletableCells = selectedCells.filter((cell) => {
    const id = cell.split('_').at(0) as string;
    const column = sanitizeId(getPartAfterFirstUnderscore(cell));
    const idMatch = (log: LogProps) => String(log.id) === String(id);
    return flattenedLogs.findIndex((log) => idMatch(log)) !== -1;
  });

  // Skip dialog trigger when pressing backspace / delete within an editable element
  const handlePotentialDeleteKey = useCallback(
    (event: KeyboardEvent) => {
      if (deletableCells.length === 0) {
        return;
      }
      const target = event.target as HTMLElement;
      const isEditingInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!isEditingInput && deletableCells.length > 0) {
        setShowDialog(true);
      }
    },
    [deletableCells, setShowDialog]
  );

  useKeyPressEvent('Backspace', handlePotentialDeleteKey);
  useKeyPressEvent('Delete', handlePotentialDeleteKey);

  const fieldsToDelete = deletableCells.map((cell) => [
    parseInt(cell.split('_').at(0) as string),
    columnContext
      ? processContext('merge', columnContext, sanitizeId(getPartAfterFirstUnderscore(cell)))
      : sanitizeId(getPartAfterFirstUnderscore(cell)),
  ]);

  const args = fieldsToDelete.length > 0 ? [projectId, context, fieldsToDelete] : [];

  // Show remove-from-context only if every selected row has all its fields selected
  const selectedIds = Array.from(
    new Set(deletableCells.map((cell) => cell.split('_')[0] as string))
  );
  let removeLabel: string | undefined;
  if (selectedIds.length > 0) {
    const allMatch = selectedIds.every((rowId) => {
      const log = flattenedLogs.find((l) => String(l.id) === rowId) as LogProps | undefined;
      if (!log) return false;
      const totalFields =
        Object.keys((log as any).params || {}).length +
        Object.keys((log as any).entries || {}).length;
      const selectedCount = deletableCells.filter((cell) => cell.split('_')[0] === rowId).length;
      return selectedCount === totalFields;
    });
    if (allMatch) {
      removeLabel = 'Remove from this context only';
    }
  }

  return (
    showDialog && (
      <DeleteDialog
        deletingFunction={logsActions.delete}
        args={args}
        type="log entries"
        showDialog={showDialog}
        setShowDialog={setShowDialog}
        onDelete={onDelete}
        removeLabel={removeLabel}
      />
    )
  );
};
export default DeleteCells;
