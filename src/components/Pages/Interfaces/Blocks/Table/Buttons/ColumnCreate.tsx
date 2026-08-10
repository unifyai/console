'use client';

import { KeyboardEventHandler, useState, useEffect, useRef } from 'react';
import { Input } from '@/components/UI/input';
import SubmitButton from '@/components/Common/Buttons/Submit';
import Tooltip from '@/components/Common/Misc/Tooltip';
import {
  GetLogsParameters,
  TableArguments,
  LogProps,
  GroupedLogProps,
} from '@/types/interfaces/logs';
import { DropdownMenuItem, DropdownMenuLabel } from '@/components/UI/dropdown-menu';
import { LoaderCircle, Info, Plus } from 'lucide-react';
import { ResponseProps } from '@/types/common';
import FormulaInput from '@/components/Common/Input/Formula';
import { expressionToDerivedFunction } from '@/lib/logs/derivedColumns';
import { buildFilterExpressionArgument } from '@/lib/logs/filters';
import { processContext, sanitizeId } from '@/lib/logs/columns';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { useTableAutoUpdateQuery } from '@/hooks/Interfaces/Query/useTableAutoUpdateQuery';
import { FieldsActions } from '@/types/interfaces/grid';
import { ContextActions } from '@/types/interfaces/grid';
import { ProjectsActions } from '@/types/interfaces/grid';
import { LogsActions } from '@/types/interfaces/grid';
import { isImeComposing } from '@/utils/keyboard';

const extractSharedPath = (firstColumnName: string, secondColumnName: string) => {
  const firstPathParts = firstColumnName.split('/').filter((p) => p !== '');
  const secondPathParts = secondColumnName.split('/').filter((p) => p !== '');
  let commonParts: string[] = [];
  let i = 0;
  while (
    i < firstPathParts.length &&
    i < secondPathParts.length &&
    firstPathParts[i] === secondPathParts[i]
  ) {
    commonParts.push(firstPathParts[i]);
    i++;
  }
  const commonRoot = commonParts.length > 0 ? commonParts.join('/') + '/' : '';
  return commonRoot;
};

const extractColumnPath = (columnName: string) => columnName.split('/').slice(1, -1).join('/');

const ColumnCreate = ({
  tileId,
  tabId,
  project,
  context,
  columnContext,
  currentTable,
  tableArguments,
  logs,
  columnOrder,
  previousColumn,
  create,
  setPending,
  setColumnOrder,
  setOpen,
  logsActions,
  projectsActions,
  contextActions,
  fieldsActions,
}: {
  tileId: string;
  tabId: string;
  project: string;
  context: string | undefined;
  columnContext: string | undefined;
  currentTable: string;
  tableArguments: TableArguments;
  logs: LogProps[] | GroupedLogProps[];
  columnOrder: string[];
  previousColumn: string;
  create: (
    project: string,
    context: string | undefined,
    key: string,
    equation: string,
    referencedLogs: { [table_name: string]: GetLogsParameters }
  ) => Promise<ResponseProps>;
  setPending: (pending: boolean) => void;
  setColumnOrder: (order: string[]) => void;
  setOpen: (open: boolean) => void;
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

  // Prepend column context to the order and column name, if applicable
  const previous =
    columnContext && previousColumn != 'RowNumbering'
      ? previousColumn.startsWith('Parameters/')
        ? `${'Parameters/'}${processContext('merge', columnContext, sanitizeId(previousColumn))}`
        : `${'Entries/'}${processContext('merge', columnContext, sanitizeId(previousColumn))}`
      : previousColumn;
  const order = columnOrder.map((columnID) => {
    if (columnID === 'RowNumbering') return columnID;
    if (!columnContext) return columnID;
    const prefix = columnID.startsWith('Parameters/') ? 'Parameters/' : 'Entries/';
    const contextAwareColumn = processContext('merge', columnContext, sanitizeId(columnID));
    return `${prefix}${contextAwareColumn}`;
  });

  // Find index of previous and next column to position the new column
  const previousIndex = order.indexOf(previous);
  const nextIndex =
    previousIndex != -1 && previousIndex < order.length - 1 ? previousIndex + 1 : previousIndex;
  const nextColumn = order.at(nextIndex) ?? previous;

  // Prefix derived column name with previous column prefix, if applicable
  let previousColumnPrefix = extractColumnPath(previousColumn);
  if (previousColumnPrefix.length) previousColumnPrefix += '/';
  let nextColumnPrefix = extractColumnPath(nextColumn);
  if (nextColumnPrefix.length) nextColumnPrefix += '/';
  const commonRoot = extractSharedPath(previousColumnPrefix, nextColumnPrefix);
  const editableInitialName = previousColumnPrefix.slice(commonRoot.length);

  // State tracking
  const [name, setName] = useState<string>(editableInitialName);
  const [nameError, setNameError] = useState<string>('');
  const [expression, setExpression] = useState<string>('');
  const [equation, setEquation] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  /* Display loader when data updates - this is for the dialog loading state */
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    setLoading(false);
  }, [logs]);

  // Handle inputs
  const handleName = (value: string) => {
    if (commonRoot && !value.startsWith(commonRoot)) return;
    const newValue = value.slice(commonRoot.length);
    setName(newValue);
    const fullName = commonRoot + newValue;
    if (columns.includes(fullName)) {
      setNameError(`${fullName} already used as a column name.`);
      return;
    }
    setNameError('');
  };

  const handleExpression = (value: string) => {
    setExpression(value);
    const equation = expressionToDerivedFunction(value, currentTable, tables, columns);
    setEquation(equation);
  };

  // Handle submission
  const onSubmit = async () => {
    /* Build referenced arguments object */
    let referencedTables: (keyof TableArguments)[] = tables.filter((table) =>
      equation.includes(table)
    );
    if (!referencedTables.length) referencedTables = [currentTable];
    const referencedArguments = Object.fromEntries(
      Object.entries(tableArguments)
        .filter(([key, _]) => referencedTables.includes(key))
        .map(([key, args]) => [key, buildFilterExpressionArgument(args).getLogsParameters])
    );

    /* Implicitly prepend selected column context to the name, if applicable */
    let key = commonRoot ? commonRoot + name : name;
    key = columnContext ? processContext('merge', columnContext, key) : key;

    setLoading(true);

    try {
      const response = await create(project, context, key, equation, referencedArguments);

      if ('info' in response) {
        // Update states
        setErrorMessage('');
        setLoading(false); // Dialog loading stops immediately after successful create
        setOpen(false);

        // Add new column next to the previous
        const newColumnId = previous.includes('Parameters/')
          ? `Parameters/${key}`
          : `Entries/${key}`;
        const newOrder =
          previousIndex !== -1
            ? [...order.slice(0, previousIndex + 1), newColumnId, ...order.slice(previousIndex + 1)]
            : [...order, newColumnId];
        setColumnOrder(newOrder);

        // Set table pending state and use manual refresh
        setPending(true);
        await manualRefresh();
        setPending(false); // Only clear pending after manual refresh completes

        return;
      }

      let error = 'Failed to create derived entries, please try again.';
      if ('detail' in response) {
        if (typeof response.detail === 'string') error = response.detail;
        else error = JSON.stringify(response.detail);
      }
      setErrorMessage(error);
      setTimeout(() => setErrorMessage(''), 10000);
    } catch (error) {
      console.error('Failed to create column:', error);
      setErrorMessage('Failed to create derived entries, please try again.');
      setTimeout(() => setErrorMessage(''), 10000);
    } finally {
      setLoading(false);
    }
  };
  const onEnter: KeyboardEventHandler = (e) => {
    e.stopPropagation();
    if (isImeComposing(e)) return;
    if (e.key === 'Enter' && name && expression && !nameError) onSubmit();
  };

  // Subcomponents
  const column = (
    <Input
      className="text-body-sm w-1/2 min-w-[100px]"
      onClick={(event) => event.stopPropagation()}
      placeholder={'Enter a column name..'}
      value={commonRoot + name}
      onInput={(event) => handleName(event.currentTarget.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onKeyDown={onEnter}
    />
  );

  const info = (
    <Tooltip
      content={`New columns created at this position can only belong to the ${commonRoot.slice(0, -1)} column context`}
    >
      <Info size={16} />
    </Tooltip>
  );

  const entry = (
    <FormulaInput
      options={options}
      value={expression}
      setValue={handleExpression}
      onEnter={onEnter}
      className="left-8"
    />
  );

  const warning = (error: string) => (
    <p
      style={{ 'scrollbar-width': 'thin' } as React.CSSProperties}
      className="text-body-sm flex max-w-[300px] justify-start overflow-x-auto text-destructive"
    >
      {error}
    </p>
  );
  const submit = (
    <div className="flex justify-end">
      <SubmitButton
        text={loading ? 'Creating column' : 'Create'}
        onClick={() => onSubmit()}
        icon={loading && <LoaderCircle className="animate-spin text-primary-foreground" />}
      />
    </div>
  );
  const body = (
    <div
      className="flex h-full w-[400px] flex-col gap-1 px-2 pb-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex h-full flex-col">
        <DropdownMenuLabel className="text-label text-strong">Column name</DropdownMenuLabel>
        <div className="flex flex-row gap-2">
          {column}
          {commonRoot && info}
        </div>
        {nameError && warning(nameError)}
      </div>

      <div className="flex h-full flex-col">
        <DropdownMenuLabel className="text-label text-strong">Derived expression</DropdownMenuLabel>
        <DropdownMenuLabel className="text-body-sm">
          <p>
            Enter a mathematical expression to evaluate. You can use any entry column name as
            variable.
          </p>
        </DropdownMenuLabel>
        {entry}
      </div>
    </div>
  );
  const footer = (
    <div className="flex w-full flex-row justify-between gap-5 p-2">
      {warning(errorMessage)}
      {name && expression && !nameError && submit}
    </div>
  );

  return (
    <BaseDialog
      context="tile"
      open={loading ? true : undefined}
      button={
        <DropdownMenuItem
          className="text-body-sm relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"
          onSelect={(e) => e.preventDefault()}
        >
          <Plus className="h-4 w-4" />
          <span>New column</span>
        </DropdownMenuItem>
      }
      body={body}
      footer={footer}
      // Stop clicks from closing the parent if it's still around
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerOver={(e) => e.stopPropagation()}
      // Prevent auto-focus on the first input element
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="sm:max-w-lg"
    />
  );
};

export default ColumnCreate;

/* TODO: 
    
    - Add button to refresh the values
    - Add dropdown options for: 
        (See https://github.com/unifyai/orchestra/blob/main/orchestra/web/api/log/helpers.py#L151 for source)
        functions: 
            r"(?<!\w)(?:len|type|exists|version|str(?=\()|to_str)"
            ["len", "type", "exists", "version", "str", "to_str"]
        operators: 
            r"==|!=|<=|>=|<|>|(?<!\w)(?:not in|is not|in|not|and|or|is)(?!\w)|\*\*|//|\+|\-|\*|/|%"
            ["!=", "<=", ">=", ">", "<", "not in", "is not", "in", "not", "and", "or", "is", "//", "**", "+", "-", "/", "%"]
*/
