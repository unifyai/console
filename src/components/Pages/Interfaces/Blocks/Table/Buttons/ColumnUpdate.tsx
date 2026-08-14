'use client';

import { KeyboardEventHandler, useState, useEffect, Dispatch, SetStateAction, useRef } from 'react';
import SubmitButton from '@/components/Common/Buttons/Submit';
import {
  GetLogsParameters,
  TableArguments,
  LogProps,
  GroupedLogProps,
} from '@/types/interfaces/logs';
import ActionButton from '@/components/Common/Buttons/Action';
import { ResponseProps } from '@/types/common';
import FormulaInput from '@/components/Common/Input/Formula';
import { TbMathFunction } from 'react-icons/tb';
import { LoaderCircle } from 'lucide-react';
import {
  expressionToDerivedFunction,
  derivedFunctionToExpression,
} from '@/lib/logs/derivedColumns';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';
import { sanitizeId } from '@/lib/logs/columns';
import { buildFilterExpressionArgument } from '@/lib/logs/filters';
import { DerivedEntryActions } from '@/types/interfaces/grid';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { useTableAutoUpdateQuery } from '@/hooks/Interfaces/Query/useTableAutoUpdateQuery';
import { FieldsActions } from '@/types/interfaces/grid';
import { ContextActions } from '@/types/interfaces/grid';
import { ProjectsActions } from '@/types/interfaces/grid';
import { LogsActions } from '@/types/interfaces/grid';
import { isImeComposing } from '@/utils/keyboard';

const ColumnUpdate = ({
  tileId,
  tabId,
  project,
  context,
  colId,
  previousEquation,
  currentTable,
  tableArguments,
  logs,
  open,
  updateLoading,
  renderMode,
  update,
  setPending,
  setOpen,
  setUpdateLoading,
  logsActions,
  projectsActions,
  contextActions,
  fieldsActions,
}: {
  tileId: string;
  tabId: string;
  project: string;
  context: string | undefined;
  colId: string;
  previousEquation: string;
  currentTable: string;
  tableArguments: TableArguments;
  logs: LogProps[] | GroupedLogProps[];
  open: boolean;
  updateLoading: boolean;
  renderMode: 'button' | 'menuItem';
  update: DerivedEntryActions['update'];
  setPending: (pending: boolean) => void;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setUpdateLoading: (updateLoading: boolean) => void;
  logsActions: LogsActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
  fieldsActions: FieldsActions;
}) => {
  /* Construct autocomplete options list from table arguments and extract tables and columns from the options for regex parsing */
  const options = Object.entries(tableArguments)
    .map(([table, args]) => ({
      name: table,
      type: 'Table Name',
      children: Object.keys(args.availableFields ?? {}),
    })) // Add all displayed tables
    .concat(
      Object.entries(tableArguments[currentTable as keyof TableArguments].availableFields ?? {}) // Add all columns of current table
        .map(([column, _]) => ({ name: column, type: 'Column Name', children: [] }))
    );
  const tables = options
    .filter((option) => option.type === 'Table Name')
    .map((option) => option.name);
  const columns = options
    .filter((option) => option.type === 'Column Name')
    .map((option) => option.name);

  // State tracking
  const previousExpression = derivedFunctionToExpression(previousEquation, tables, columns);
  const [expression, setExpression] = useState<string>(previousExpression);
  const [equation, setEquation] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

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
    fieldsActions
  );

  /* Display loader when data updates - this stops the updateLoading state */
  useEffect(() => {
    setUpdateLoading(false);
  }, [logs, setUpdateLoading]);

  // Handle inputs
  const handleExpression = (value: string) => {
    setExpression(value);
    const equation = expressionToDerivedFunction(value, currentTable, tables, columns);
    setEquation(equation);
  };

  // Handle submission
  const onSubmit = async () => {
    let previousReferencedTables: (keyof TableArguments)[] = tables.filter((table) =>
      previousEquation.includes(table)
    );
    if (!previousReferencedTables.length) previousReferencedTables = [currentTable];
    const targetDerivedLogs = Object.fromEntries(
      Object.entries(tableArguments)
        .filter(([key, _]) => previousReferencedTables.includes(key))
        .map(([key, args]) => [key, buildFilterExpressionArgument(args).getLogsParameters])
    );

    setUpdateLoading(true);

    try {
      const response = await update(
        project,
        context,
        sanitizeId(colId),
        equation,
        targetDerivedLogs
      );

      if ('info' in response) {
        // Update states
        setErrorMessage('');
        setUpdateLoading(false); // Dialog loading stops immediately after successful update
        setOpen(false);

        // Set table pending state and use manual refresh
        setPending(true);
        await manualRefresh();
        setPending(false); // Only clear pending after manual refresh completes

        return;
      }

      let error = 'Failed to update derived entries, please try again.';
      if ('detail' in response) {
        if (typeof response.detail === 'string') error = response.detail;
        else error = JSON.stringify(response.detail);
      }
      setErrorMessage(error);
      setTimeout(() => setErrorMessage(''), 5000);
    } catch (error) {
      console.error('Failed to update column:', error);
      setErrorMessage('Failed to update derived entries, please try again.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setUpdateLoading(false);
    }
  };

  const onEnter: KeyboardEventHandler = (e) => {
    e.stopPropagation();
    if (isImeComposing(e)) return;
    if (e.key === 'Enter' && expression) onSubmit();
  };

  // Subcomponents
  const warning = (error: string) => (
    <p className="text-body-sm flex justify-start text-destructive">{error}</p>
  );
  const submit = (
    <div className="flex justify-end">
      <SubmitButton
        text="Apply"
        onClick={() => onSubmit()}
        icon={updateLoading && <LoaderCircle className="animate-spin text-primary-foreground" />}
      />
    </div>
  );

  const icon = updateLoading ? (
    <LoaderCircle className="animate-spin text-primary" />
  ) : (
    <TbMathFunction />
  );
  const columnButton =
    renderMode === 'button' ? (
      <ActionButton tooltip={'Update equation'} icon={icon} disabled={updateLoading} />
    ) : (
      <TbMathFunction className="h-4 w-4" />
    );
  const body = (
    <div className="flex h-full flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <FormulaInput
        options={options}
        value={expression}
        setValue={handleExpression}
        onEnter={onEnter}
        className="left-8"
      />
    </div>
  );
  const footer = (
    <div className="flex flex-row justify-between gap-1 p-2">
      {warning(errorMessage)}
      {expression && submit}
    </div>
  );

  return (
    <BaseDialog
      context="tile"
      button={
        renderMode === 'menuItem' ? (
          // Because this is inside a parent DropdownMenuItem,
          // we must prevent the parent from closing automatically:
          <DropdownMenuItem
            className="text-body-sm relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"
            onSelect={(e) => e.preventDefault()}
          >
            {columnButton}
            <span>Update Equation</span>
          </DropdownMenuItem>
        ) : (
          columnButton
        )
      }
      open={renderMode === 'menuItem' ? undefined : open}
      setOpen={renderMode === 'menuItem' ? undefined : setOpen}
      body={body}
      footer={footer}
      // Stop clicks from closing the parent if it's still around
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerOver={(e) => e.stopPropagation()}
      className="sm:max-w-xl"
    />
  );
};

export default ColumnUpdate;
