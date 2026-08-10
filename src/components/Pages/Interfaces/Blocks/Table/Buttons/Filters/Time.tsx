'use client';

import { useState, useRef, useEffect, Dispatch, SetStateAction, useMemo, useCallback } from 'react';
import { Filters, FiltersByColumn } from '@/types/interfaces/columns';
import BaseDropdown from '@/components/Common/Dropdowns/Base';
import ActionButton from '@/components/Common/Buttons/Action';
import SubmitButton from '@/components/Common/Buttons/Submit';
import BaseButton from '@/components/Common/Buttons/Base';
import { Filter, X, ListTree } from 'lucide-react';
import { TbMathFunction } from 'react-icons/tb';
import InputWithStartSelect from '@/components/Common/Input/StartSelect';
import { KeyboardEventHandler } from 'react';
import {
  initFilters,
  combineFilters,
  defaultRelativeDate,
  defaultAbsoluteDate,
  initDefaultDate,
} from '@/utils/interfaces/table/filters';
import { Trash, Plus, Minus, CircleX, Clock, History, LoaderCircle } from 'lucide-react';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';
import { DateTimeInput } from '@/components/Common/Time/DateTimeInput';
import { AbsoluteDateString, RelativeDateString } from '@/types/interfaces/filters';
import { GroupedLogProps, LogProps } from '@/types/interfaces/logs';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { sanitizeId } from '@/utils/interfaces/table/columnOperations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import Tooltip from '@/components/Common/Misc/Tooltip';
import FormulaInput from '@/components/Common/Input/Formula';
import { isImeComposing } from '@/utils/keyboard';

interface TimeFilter {
  key: number;
  mode: '>' | '<' | 'exists' | 'isNone';
  join: '&&' | '||';
  value: string;
}

const TimeColumnFilter = ({
  interactive,
  column,
  columnFilters,
  setColumnFilterQuery,
  open,
  setOpen,
  filterLoading,
  setFilterLoading,
  setIsFiltered,
  renderMode,
  dataType,
  entriesProperties,
}: {
  interactive: boolean;
  column: string;
  columnFilters: FiltersByColumn;
  setColumnFilterQuery: (columnFilters: FiltersByColumn) => void;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  filterLoading: boolean;
  setFilterLoading: (filterLoading: boolean) => void;
  setIsFiltered: (isFiltered: boolean) => void;
  renderMode: 'button' | 'menuItem';
  dataType?: 'timedelta' | 'timestamp' | 'date' | 'time';
  entriesProperties: string[];
}) => {
  /* Display loader when data updates */
  const [spinnerColor, setSpinnerColor] = useState('white');
  const [filterMode, setFilterMode] = useState<'structured' | 'expression'>('structured');
  const [expression, setExpression] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  /* Initialize filters */
  const options = useMemo(
    () => [
      { name: '>', label: '>', description: `Filter for ${column} values greater than..` },
      { name: '<', label: '<', description: `Filter for ${column} values less than..` },
      { name: 'exists', label: 'exists', description: `Filter for ${column} existing values..` },
      { name: 'isNone', label: 'isNone', description: `Filter for ${column} none values..` },
    ],
    [column]
  );
  const modes = useMemo(() => options.map((option) => option.name), [options]);
  const defaultFilter: TimeFilter = useMemo(
    () => ({ key: 0, mode: '>', join: '&&', value: defaultRelativeDate }),
    []
  );
  const initialValues: TimeFilter[] = [];
  const [filters, setFilters] = useState(initialValues);
  const isFiltered = column in columnFilters;

  useEffect(() => {
    if (warningMessage) {
      const timer = setTimeout(() => setWarningMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [warningMessage]);

  useEffect(() => {
    setIsFiltered(isFiltered);
    const existingFilter = columnFilters[column];
    if (existingFilter) {
      if (typeof existingFilter.expression === 'string') {
        setFilterMode('expression');
        setExpression(existingFilter.expression);
        setFilters([]); // Clear structured filters
      } else {
        setFilterMode('structured');
        const initialValues: TimeFilter[] = [];
        initFilters(column, columnFilters, initialValues, modes);
        setFilters(initialValues.length ? initialValues : [defaultFilter]);
        setExpression('');
      }
    } else {
      setFilterMode('structured');
      setFilters([defaultFilter]);
      setExpression('');
    }
  }, [isFiltered, setIsFiltered, columnFilters, column, defaultFilter, modes]);

  const autocompleteOptions = useMemo(() => {
    return entriesProperties.map((col) => ({ name: col, type: 'Column Name', children: [] }));
  }, [entriesProperties]);

  const [relative, setRelative] = useState(
    initialValues.map((initial) => initial.value).every((value) => value.includes(';'))
  );

  const getFilterValueAsString = useCallback(
    (value: string) => {
      let newValue = value ? value : relative ? defaultRelativeDate : defaultAbsoluteDate;
      if (newValue.includes(';')) {
        // Relative date
        newValue = newValue
          .substring(0, newValue.indexOf('ms') + 2)
          .substring(newValue.search(/\d/));
      } else {
        // Absolute date
        newValue = newValue.replace('T', ' ').replace('Z', '');
      }
      return `"${newValue}"`;
    },
    [relative]
  );

  const structuredToExpression = useCallback(
    (structuredFilters: TimeFilter[]): string => {
      if (
        !structuredFilters.length ||
        (structuredFilters.length === 1 && !structuredFilters[0].value.trim())
      )
        return '';
      return structuredFilters
        .map((filter, index) => {
          let singleExpr = '';
          if (filter.mode === 'exists') {
            singleExpr = filter.value === 'true' ? `exists(${column})` : `not exists(${column})`;
          } else if (filter.mode === 'isNone') {
            singleExpr = filter.value === 'true' ? `isNone(${column})` : `not isNone(${column})`;
          } else {
            singleExpr = `${column} ${filter.mode} ${getFilterValueAsString(filter.value)}`;
          }
          if (index > 0) {
            return ` ${filter.join === '&&' ? 'and' : 'or'} ${singleExpr}`;
          }
          return singleExpr;
        })
        .filter(Boolean)
        .join('');
    },
    [column, getFilterValueAsString]
  );

  const expressionToStructured = (expr: string): TimeFilter[] | null => {
    if (!expr.trim()) return [];
    const newFilters: TimeFilter[] = [];
    const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `(?:\\s*(and|or)\\s+)?\\s*\\(?\\s*(?:(?:(not)\\s+)?(exists|isNone)\\s*\\(\\s*${escapedColumn}\\s*\\)|(${escapedColumn})\\s*(>|<)\\s*(".*?"))\\s*\\)?`,
      'gi'
    );

    let match;
    let key = 0;
    let lastIndex = 0;
    while ((match = regex.exec(expr)) !== null) {
      if (match.index > lastIndex) return null;
      const join: '&&' | '||' = match[1] && match[1].toLowerCase() === 'or' ? '||' : '&&';
      if (match[3]) {
        newFilters.push({
          key: key++,
          mode: match[3].toLowerCase() as 'exists' | 'isNone',
          join,
          value: match[2] ? 'false' : 'true',
        });
      } else {
        newFilters.push({
          key: key++,
          mode: match[5] as TimeFilter['mode'],
          join,
          value: match[6].slice(1, -1),
        });
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < expr.trim().length) return null;
    if (newFilters.length > 0) newFilters[0].join = '&&';
    return newFilters;
  };

  const handleTabChange = (newMode: 'structured' | 'expression') => {
    if (filterMode === newMode) return;

    if (newMode === 'expression') {
      setExpression(structuredToExpression(filters));
      setFilterMode('expression');
      setWarningMessage('');
    } else {
      const newFilters = expressionToStructured(expression);
      if (newFilters) {
        setFilters(newFilters.length ? newFilters : [defaultFilter]);
        setFilterMode('structured');
        setWarningMessage('');
      } else {
        setWarningMessage('Expression is invalid or too complex for structured view.');
      }
    }
  };

  /* Event handlers */
  const onInput = (value: AbsoluteDateString | RelativeDateString, filter: TimeFilter) => {
    const newFilters = [...filters];
    newFilters.find((f) => f.key === filter.key)!.value = value;
    setFilters(newFilters);
  };
  const onSubmit = () => {
    let newColumnFilters = { ...columnFilters };
    if (filterMode === 'expression') {
      if (expression.trim()) {
        newColumnFilters = { ...columnFilters, [column]: { expression: expression.trim() } };
      } else {
        delete newColumnFilters[column];
      }
    } else if (filters.length) {
      const newFilters = filters.map((f) => ({
        key: f.key,
        mode: f.mode,
        join: f.join,
        value: getFilterValueAsString(f.value),
      }));
      let filter: Filters = combineFilters(newFilters, modes);
      newColumnFilters = { ...columnFilters, [column]: filter };
    } else {
      newColumnFilters = Object.fromEntries(
        Object.entries(columnFilters).filter(([key, _]) => key != column)
      );
      setFilters([defaultFilter]);
    }
    setSpinnerColor('white');
    setFilterLoading(true);
    setColumnFilterQuery(newColumnFilters);
    setOpen(false);
  };
  const onReset = () => {
    const newColumnFilters = Object.fromEntries(
      Object.entries(columnFilters).filter(([key, _]) => key != column)
    );
    setSpinnerColor('primary');
    setFilterLoading(true);
    setFilters([defaultFilter]);
    setColumnFilterQuery(newColumnFilters);
    setOpen(false);
  };
  const onEnter: KeyboardEventHandler = (event) => {
    if (isImeComposing(event)) return;
    if (event.key === 'Enter') {
      onSubmit();
    }
  };

  /* Dialog interactions */
  const close = (
    <BaseButton
      size="sm"
      icon={<CircleX />}
      onClick={() => setOpen(false)}
      className="scale-60 absolute right-0 top-0"
      variant="warning"
    />
  );
  const baseBtn = (
    <ActionButton
      icon={
        filterLoading ? (
          <LoaderCircle className={`animate-spin text-${spinnerColor}`} />
        ) : (
          <Filter />
        )
      }
      tooltip="Filter"
      variant={isFiltered ? 'primary' : undefined}
      disabled={!interactive || filterLoading}
    />
  );
  const button =
    renderMode === 'button' ? (
      <div className="group relative inline-flex">
        {baseBtn}
        {isFiltered && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[color:var(--status-neutral)] text-[color:var(--cream-white)] opacity-0 transition-opacity hover:bg-[color:var(--foreground)] group-hover:opacity-100"
          >
            <X className="h-2 w-2" />
          </button>
        )}
      </div>
    ) : (
      <Filter className="h-4 w-4" />
    );
  const reset = (
    <ActionButton
      tooltip="Delete all filters"
      variant="warning"
      icon={<Trash />}
      onClick={() => onReset()}
    />
  );
  const submit = <SubmitButton text="Save" onClick={() => onSubmit()} />;
  const append = (
    <BaseDropdown context="tile" button={<ActionButton tooltip="Add new filter" icon={<Plus />} />}>
      {['And', 'Or'].map((method, index) => (
        <DropdownMenuItem
          key={index}
          className="cursor-pointer p-2 hover:bg-primary hover:text-primary-foreground"
          onClick={() => {
            const newFilters = [...filters];
            newFilters.push({
              key: filters.length,
              mode: '>',
              join: method === 'And' ? '&&' : '||',
              value: '',
            });
            setFilters(newFilters);
          }}
        >
          {method.toLowerCase()}
        </DropdownMenuItem>
      ))}
    </BaseDropdown>
  );
  const onRebase = () => {
    const value = relative
      ? (defaultAbsoluteDate as AbsoluteDateString)
      : (defaultRelativeDate as RelativeDateString);
    const filter: TimeFilter = { key: 0, mode: '>', join: '&&', value: value };
    setFilters([filter]);
    setRelative(!relative);
  };
  const basis = (
    <ActionButton
      tooltip={relative ? 'Set absolute time' : 'Set relative time'}
      icon={relative ? <History /> : <Clock />}
      onClick={onRebase}
    />
  );

  /* Filter row */
  const join = (filter: TimeFilter) => (
    <BaseDropdown
      context="tile"
      button={
        <ActionButton tooltip="Update joining method" text={filter.join === '&&' ? 'and' : 'or'} />
      }
    >
      {['And', 'Or'].map((method, index) => (
        <DropdownMenuItem
          key={index}
          className="cursor-pointer p-2 hover:bg-primary hover:text-primary-foreground"
          onClick={() => {
            const newFilters = [...filters];
            const join = method === 'And' ? '&&' : '||';
            newFilters.find((f) => f.key === filter.key)!.join = join;
            setFilters(newFilters);
          }}
        >
          {method.toLowerCase()}
        </DropdownMenuItem>
      ))}
    </BaseDropdown>
  );

  /* Define time components based on data type */
  const year = { name: 'year', className: 'w-[72px] border-r-0' };
  const month = { name: 'month', className: 'border-l-0 border-r-0' };
  const day = { name: 'day', className: 'border-l-0 border-r-0' };
  const hours = { name: 'hours', className: 'border-l-0 border-r-0' };
  const minutes = { name: 'minutes', className: 'border-l-0 border-r-0' };
  const seconds = { name: 'seconds', className: 'border-l-0 border-r-0' };
  const milliseconds = {
    name: 'milliseconds',
    className: 'w-[68px] border-l-0 rounded-tr-md rounded-br-md',
  };
  let times: any[] = [];
  switch (dataType) {
    case 'date':
      day.className = 'border-l-0 rounded-tr-md rounded-br-md';
      times = [year, month, day];
      break;
    case 'time':
      seconds.className = 'border-l-0 rounded-tr-md rounded-br-md';
      times = [hours, minutes, seconds];
      break;
    case 'timedelta':
      seconds.className = 'border-l-0 rounded-tr-md rounded-br-md';
      times = [year, month, day, hours, minutes, seconds];
      break;
    default:
      times = [year, month, day, hours, minutes, seconds, milliseconds];
      break;
  }

  /* Inputs */
  const filterRefs = useRef<Record<string, Record<string, HTMLInputElement | null>>>({});
  const valueInput = (filter: TimeFilter, refs: Record<string, HTMLInputElement | null>) => (
    <div className="flex flex-row">
      {times.map((time, index) => {
        const picker = time.name as
          | 'year'
          | 'month'
          | 'day'
          | 'hours'
          | 'minutes'
          | 'seconds'
          | 'milliseconds';
        const date = initDefaultDate(filter.value, relative);
        const setDate = (date: AbsoluteDateString | RelativeDateString) => onInput(date, filter);
        const ref = (element: HTMLInputElement | null) => {
          refs[time.name] = element;
        };
        const prevIndex = index > 0 ? index - 1 : -1;
        const nextIndex = index < times.length - 1 ? index + 1 : -1;
        const onLeftFocus = () => {
          if (prevIndex !== -1) {
            refs[times[prevIndex].name]?.focus();
          }
        };
        const onRightFocus = () => {
          if (nextIndex !== -1) {
            refs[times[nextIndex].name]?.focus();
          }
        };
        const className = time.className;
        return (
          <DateTimeInput
            key={index}
            picker={picker}
            date={date}
            setDate={setDate}
            ref={ref}
            onLeftFocus={onLeftFocus}
            onRightFocus={onRightFocus}
            relative={relative}
            className={className}
            onEnter={onEnter}
          />
        );
      })}
    </div>
  );
  const toggleInput = (filter: TimeFilter) => (
    <BaseButton
      text={filter.value}
      variant="outline"
      className="rounded-none rounded-br-lg rounded-tr-lg"
      onClick={() => {
        const newFilters = [...filters];
        newFilters.find((f) => f.key === filter.key)!.value === 'true'
          ? (newFilters.find((f) => f.key === filter.key)!.value = 'false')
          : (newFilters.find((f) => f.key === filter.key)!.value = 'true');
        setFilters(newFilters);
      }}
    />
  );
  const filterInput = (filter: TimeFilter) => {
    if (!filterRefs.current[filter.key]) {
      filterRefs.current[filter.key] = {};
    }
    const refs = filterRefs.current[filter.key];
    const option = options.find((option) => option.name === filter.mode)!;
    return (
      <InputWithStartSelect
        options={options}
        option={option}
        onOptionChange={(option) => {
          const newFilters = [...filters];
          newFilters.find((f) => f.key === filter.key)!.mode = option.name as '>' | '<';
          if (['exists', 'isNone'].includes(option.name)) {
            newFilters.find((f) => f.key === filter.key)!.value = 'true';
          }
          setFilters(newFilters);
        }}
      >
        {['exists', 'isNone'].includes(option.name)
          ? toggleInput(filter)
          : valueInput(filter, refs)}
      </InputWithStartSelect>
    );
  };
  const remove = (filter: TimeFilter) => (
    <ActionButton
      tooltip="Remove filter"
      icon={<Minus />}
      onClick={() => {
        let newFilters = filters.filter((f) => f.key != filter.key);
        newFilters = newFilters.map((f, i) => ({
          key: i,
          mode: f.mode,
          join: i === 0 ? '&&' : f.join,
          value: f.value,
        }));
        newFilters = newFilters.length ? newFilters : [defaultFilter];
        setFilters(newFilters);
      }}
    />
  );

  const filterContent = (
    <div className="flex flex-col gap-3 px-2 pb-2 pt-4">
      <Tabs value={filterMode} onValueChange={(v) => handleTabChange(v as any)} className="w-full">
        <TabsList className="inline-flex">
          <Tooltip content={warningMessage} side="top">
            <TabsTrigger
              value="structured"
              disabled={!!warningMessage}
              className="flex items-center gap-2"
            >
              <ListTree className="h-4 w-4" />
              Structured Mode
            </TabsTrigger>
          </Tooltip>
          <TabsTrigger value="expression" className="flex items-center gap-2">
            <TbMathFunction className="h-4 w-4" />
            Expression Mode
          </TabsTrigger>
        </TabsList>
        <TabsContent value="structured" className="space-y-2 pt-4">
          {filters.map((filter, index) => (
            <div key={index} className="grid grid-cols-10 items-center">
              {filters.length > 0 && filter.key != 0 && (
                <div className="col-span-1">{join(filter)}</div>
              )}
              <div
                className={`${filters.length > 0 && filter.key != 0 ? 'col-span-8' : 'col-span-9'}`}
              >
                {filterInput(filter)}
              </div>
              <div className="col-span-1 text-center">{remove(filter)}</div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="expression" className="pt-4">
          <div className="flex flex-col gap-2">
            <FormulaInput
              options={autocompleteOptions}
              value={expression}
              setValue={setExpression}
              onEnter={onEnter}
              withIcon={false}
              placeholder={`e.g. ${column} > "2024-01-01"`}
              withAutocomplete={false}
            />
          </div>
        </TabsContent>
      </Tabs>
      <div className="mt-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {filterMode === 'structured' && (
            <>
              {append}
              {dataType !== 'timedelta' && basis}
            </>
          )}
        </div>
        <div className="flex flex-row justify-end gap-2">
          {reset}
          {submit}
        </div>
      </div>
    </div>
  );

  return (
    <BaseDialog
      context="tile"
      // Tie <Dialog> open to parent state if not "menuItem" mode
      open={renderMode === 'menuItem' ? undefined : interactive && open}
      setOpen={renderMode === 'menuItem' ? undefined : setOpen}
      button={
        renderMode === 'menuItem' ? (
          // Render a styled <DropdownMenuItem> so the parent doesn't close
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="text-body relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"
          >
            {button}
            <span>Filter column</span>
          </DropdownMenuItem>
        ) : (
          button
        )
      }
      body={filterContent}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerOver={(e) => e.stopPropagation()}
      className="sm:max-w-2xl"
    />
  );
};

export default TimeColumnFilter;
