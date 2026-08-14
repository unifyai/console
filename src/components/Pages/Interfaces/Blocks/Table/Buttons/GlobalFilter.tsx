'use client';

import { useState, useEffect, FormEvent, KeyboardEvent } from 'react';

import { GroupedLogProps, LogProps } from '@/types/interfaces/logs';
import { TableArguments } from '@/types/interfaces/logs';

import ActionButton from '@/components/Common/Buttons/Action';
import FormulaInput from '@/components/Common/Input/Formula';
import { Input } from '@/components/UI/input';

import { X, LoaderCircle, Search } from 'lucide-react';
import { TbMathFunction } from 'react-icons/tb';
import { isImeComposing } from '@/utils/keyboard';

const GlobalFilter = ({
  interactive,
  commonFilter,
  setCommonFilter,
  logs,
  currentTable,
  tableArguments,
}: {
  interactive: boolean;
  logsFilters: string | undefined;
  commonFilter: string | undefined;
  setCommonFilter: (newValue: string | undefined) => void;
  logs: LogProps[] | GroupedLogProps[];
  currentTable: string;
  tableArguments: TableArguments;
}) => {
  /* Display loader when data updates */
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(false);
  }, [logs]);

  /* Handle filter states */
  const initialMode = commonFilter ? commonFilter.split('§')[0] : 'search';
  const initialValue = commonFilter ? commonFilter.split('§')[1] : '';
  const initialFilter = { mode: initialMode, value: initialValue };
  const [globalFilter, setGlobalFilter] = useState(initialFilter);
  const mode = globalFilter.mode;
  const value = globalFilter.value;

  /* Mode toggler */
  const modeIcon = loading ? (
    <LoaderCircle className="animate-spin text-primary" />
  ) : mode === 'search' ? (
    <Search />
  ) : (
    <TbMathFunction />
  );
  const modeTooltip = loading
    ? 'Filtering logs..'
    : mode === 'search'
      ? 'Toggle function mode'
      : 'Toggle search mode';
  const onModeClick = () =>
    setGlobalFilter((filter) => {
      const newMode = filter.mode === 'search' ? 'expression' : 'search';
      return { mode: newMode, value: filter.value };
    });
  const modeDisabled = !interactive || loading;
  const modeClassName = 'rounded-none rounded-tl-md rounded-bl-md border p-2 h-8 w-8';
  const modeButton = (
    <ActionButton
      icon={modeIcon}
      tooltip={modeTooltip}
      onClick={onModeClick}
      disabled={modeDisabled}
      className={modeClassName}
    />
  );

  /* Expression input */
  const options = Object.entries(tableArguments)
    .map(([table, args]) => ({
      name: table,
      type: 'Table Name',
      children: Object.keys(args?.availableFields ?? {}),
    })) // Add all displayed tables
    .concat(
      Object.entries(tableArguments[currentTable as keyof TableArguments]?.availableFields ?? {}) // Add all columns of current table
        .map(([column, _]) => ({ name: column, type: 'Column Name', children: [] }))
    );
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e)) return;
    if (e.key === 'Enter') {
      setCommonFilter(`${mode}§${value}`);
      setLoading(true);
    }
  };
  const setExpression = (value: string) =>
    setGlobalFilter((filter) => ({ mode: filter.mode, value: value }));
  const expressionClassName = 'left-0 top-0.5 w-[100%]';
  const expressionPlaceholder = loading ? 'Filtering logs..' : 'Search all logs..';
  const expressionInput = (
    <FormulaInput
      options={options}
      value={value}
      setValue={setExpression}
      onEnter={onEnter}
      withIcon={false}
      withAutocomplete={false}
      className={expressionClassName}
      placeholder={expressionPlaceholder}
    />
  );

  /* Filter input */
  const placeholder = loading ? 'Filtering logs..' : 'Search all logs..';
  const onInput = (input: FormEvent<HTMLInputElement>) => {
    setGlobalFilter((filter) => ({ mode: filter.mode, value: input.currentTarget?.value }));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e)) return;
    if (e.key === 'Enter') {
      setCommonFilter(`${mode}§${value}`);
      setLoading(true);
    }
  };
  const filterDisabled = !interactive || loading;
  const filterClassName = 'rounded-none rounded-tr-md rounded-br-md p-2 h-8 text-body-sm';
  const filterInput = (
    <Input
      placeholder={placeholder}
      value={value}
      onInput={onInput}
      onKeyDown={onKeyDown}
      disabled={filterDisabled}
      className={filterClassName}
    />
  );

  /* Close button */
  const onCloseClick = () => {
    setCommonFilter(undefined);
    setGlobalFilter({ mode: 'search', value: '' });
    setLoading(true);
  };
  const closeIcon = <X size={15} onClick={onCloseClick} className="cursor-pointer" />;
  const closeClassName = `absolute z-10 right-2 ${mode === 'expression' ? 'top-[10px]' : 'top-[8px]'}`;
  const closeButton = commonFilter?.length && <div className={closeClassName}>{closeIcon}</div>;

  return (
    <div className="flex flex-row items-center">
      {modeButton}
      <div className="relative min-w-[250px]">
        {mode === 'search' ? filterInput : expressionInput}
        {closeButton}
      </div>
    </div>
  );
};

export default GlobalFilter;
