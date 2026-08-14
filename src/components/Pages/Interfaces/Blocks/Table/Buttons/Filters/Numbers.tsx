'use client';

import { useState, useEffect, Dispatch, SetStateAction, useMemo } from 'react';
import { Filters, FiltersByColumn } from '@/types/interfaces/columns';
import BaseDropdown from '@/components/Common/Dropdowns/Base';
import ActionButton from '@/components/Common/Buttons/Action';
import SubmitButton from '@/components/Common/Buttons/Submit';
import BaseButton from '@/components/Common/Buttons/Base';
import { Filter, X, ListTree } from 'lucide-react';
import { TbMathFunction } from 'react-icons/tb';
import { KeyboardEventHandler } from 'react';
import InputWithStartSelect from '@/components/Common/Input/StartSelect';
import { Input } from '@/components/UI/input';
import { Slider } from '@/components/UI/slider';
import { initFilters, combineFilters } from '@/utils/interfaces/table/filters';
import { Trash, Plus, Minus, CircleX, LoaderCircle } from 'lucide-react';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { formatNumber } from '@/utils/interfaces/formatNumber';
import { useTableBoundariesQuery } from '@/hooks/Interfaces/Query/useTableDataQuery';
import { useTileData } from '@/contexts/hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { LogsActions } from '@/types/interfaces/grid';
import FormulaInput from '@/components/Common/Input/Formula';
import { isImeComposing } from '@/utils/keyboard';

interface NumericFilter {
  key: number;
  mode: '==' | '!=' | '>=' | '=<' | '>' | '<' | 'exists' | 'isNone';
  join: '&&' | '||';
  value: string;
}

const NumericColumnFilter = ({
  tileId,
  tabId,
  projectId,
  interactive,
  column,
  columnFilters,
  setColumnFilterQuery,
  dataTypes,
  open,
  setOpen,
  filterLoading,
  setFilterLoading,
  setIsFiltered,
  renderMode,
  entriesProperties,
  logsActions,
}: {
  tileId?: string;
  tabId?: string;
  projectId?: string;
  interactive: boolean;
  column: string;
  columnFilters: FiltersByColumn;
  setColumnFilterQuery: (columnFilters: FiltersByColumn) => void;
  dataTypes: { [key: string]: string };
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  filterLoading: boolean;
  setFilterLoading: (filterLoading: boolean) => void;
  setIsFiltered: (isFiltered: boolean) => void;
  renderMode: 'button' | 'menuItem';
  entriesProperties: string[];
  logsActions: LogsActions;
}) => {
  const { data: tileDataState } = useTileData(tileId || null, tabId || null);

  // Only request boundaries for the active column to avoid heavy, multi-column analytics
  const columns = [column];

  // Use the boundaries query - ONLY fetch when dialog is actually open to avoid blocking initial render
  // The min/max endpoints are very slow and can timeout, so we defer until user needs them
  const { data: queryBoundaries, isLoading: isBoundariesLoading } = useTableBoundariesQuery(
    tileId || null,
    tabId || null,
    open, // Only enabled when dialog is open - prevents blocking initial tile render
    logsActions,
    projectId,
    tileDataState?.context,
    tileDataState?.columnContext,
    columns,
    'Numbers' // caller identifier
  );

  /* Display loader when data updates */
  const [spinnerColor, setSpinnerColor] = useState('white');
  const [filterMode, setFilterMode] = useState<'structured' | 'expression'>('structured');
  const [expression, setExpression] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  /* Initialize filters */
  const options = useMemo(
    () => [
      { name: '==', label: '==', description: `Filter ${column} for values equal to..` },
      { name: '!=', label: '!=', description: `Filter ${column} for values not equal to..` },
      { name: '>', label: '>', description: `Filter ${column} for values greater than..` },
      { name: '>=', label: '>=', description: `Filter ${column} for values greater or equal to..` },
      { name: '<', label: '<', description: `Filter ${column} for values less than..` },
      { name: '<=', label: '<=', description: `Filter ${column} for values less or equal to..` },
      { name: 'exists', label: 'exists', description: `Filter ${column} for existing values..` },
      { name: 'isNone', label: 'isNone', description: `Filter ${column} for none values..` },
    ],
    [column]
  );
  const modes = useMemo(() => options.map((option) => option.name), [options]);

  const [minValue, maxValue] = [
    queryBoundaries?.minimums[column],
    queryBoundaries?.maximums[column],
  ];
  const sliderMin = minValue;
  const sliderMax = maxValue;

  // Show loading state if boundaries are being fetched and we don't have data for this column
  const shouldShowBoundariesLoading =
    isBoundariesLoading && (minValue === undefined || maxValue === undefined);

  // Choose step size based on data type
  let stepSize = 1; // default step for non-float
  if (dataTypes[column] === 'float') {
    const range = sliderMax! - sliderMin!;
    // Avoid dividing by zero if range is 0
    stepSize = range !== 0 ? range / 1000 : 1;
  }

  const defaultFilter: NumericFilter = useMemo(
    () => ({ key: 0, mode: '==', join: '&&', value: '' }),
    []
  );
  const initialValues: NumericFilter[] = [];
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
        const initialValues: NumericFilter[] = [];
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

  const structuredToExpression = (filters: NumericFilter[]): string => {
    if (!filters.length || (filters.length === 1 && !filters[0].value.trim())) return '';
    return filters
      .map((filter, index) => {
        let singleExpr = '';
        if (!filter.value.trim() && !['exists', 'isNone'].includes(filter.mode)) {
          return null; // Skip empty filters, except for exists/isNone
        }

        if (filter.mode === 'exists') {
          singleExpr = filter.value === 'true' ? `exists(${column})` : `not exists(${column})`;
        } else if (filter.mode === 'isNone') {
          singleExpr = filter.value === 'true' ? `isNone(${column})` : `not isNone(${column})`;
        } else {
          singleExpr = `${column} ${filter.mode} ${filter.value}`;
        }

        if (index > 0) {
          return ` ${filter.join === '&&' ? 'and' : 'or'} ${singleExpr}`;
        }
        return singleExpr;
      })
      .filter(Boolean)
      .join('');
  };

  const expressionToStructured = (expression: string): NumericFilter[] | null => {
    if (!expression.trim()) return [];
    const newFilters: NumericFilter[] = [];
    const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `(?:\\s*(and|or)\\s+)?\\s*\\(?\\s*(?:(not\\s+)?(exists|isNone)\\s*\\(\\s*${escapedColumn}\\s*\\)|(${escapedColumn})\\s*(==|!=|>=|<=|>|<)\\s*([\\d\\.-]+))\\s*\\)?`,
      'gi'
    );
    let match;
    let key = 0;
    let lastIndex = 0;

    while ((match = regex.exec(expression)) !== null) {
      if (match.index > lastIndex) return null; // Unparsable part
      const joinStr = match[1];
      const join: '&&' | '||' = joinStr && joinStr.toLowerCase() === 'or' ? '||' : '&&';
      if (match[3]) {
        // exists or isNone
        newFilters.push({
          key: key++,
          mode: match[3].toLowerCase() as 'exists' | 'isNone',
          join,
          value: match[2] ? 'false' : 'true',
        });
      } else {
        // standard operator
        newFilters.push({
          key: key++,
          mode: match[5] as NumericFilter['mode'],
          join,
          value: match[6],
        });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < expression.trim().length) return null; // Didn't parse whole string
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
  const onInput = (value: any, filter: NumericFilter) => {
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
        value: f.value,
      }));
      const filter: Filters = combineFilters(newFilters, modes);
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
              mode: '==',
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

  /* Filter row */
  const join = (filter: NumericFilter) => (
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
  const valueInput = (
    filter: NumericFilter,
    option: { name: string; label: string; description: string }
  ) => (
    <Input
      className="-ms-px rounded-s-none shadow-none focus-visible:z-10"
      placeholder={option.description}
      type="text"
      value={filter.value}
      onInput={(input: any) => onInput(input.currentTarget.value, filter)}
      onKeyDown={onEnter}
      inputMode="decimal"
    />
  );
  const toggleInput = (filter: NumericFilter) => (
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
  const filterInput = (filter: NumericFilter, withSlider: boolean) => {
    const option = options.find((option) => option.name === filter.mode)!;
    return (
      <div className="flex w-full flex-row gap-2">
        <InputWithStartSelect
          options={options}
          option={option}
          onOptionChange={(option) => {
            const newFilters = [...filters];
            newFilters.find((f) => f.key === filter.key)!.mode = option.name as '==' | '!=';
            if (['exists', 'isNone'].includes(option.name)) {
              newFilters.find((f) => f.key === filter.key)!.value = 'true';
            }
            setFilters(newFilters);
          }}
        >
          {['exists', 'isNone'].includes(option.name)
            ? toggleInput(filter)
            : valueInput(filter, option)}
        </InputWithStartSelect>
        {withSlider &&
          (shouldShowBoundariesLoading ? (
            <div className="flex w-full grow flex-col px-2">
              <div className="mb-2 h-4 animate-pulse rounded bg-muted" />
              <div className="h-2 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <div className="flex w-full grow flex-col px-2">
              <span
                className="text-caption mb-2 flex w-full items-center justify-between gap-2 text-muted-foreground"
                aria-hidden="true"
              >
                <span>{formatNumber(sliderMin!)}</span>
                <span>{formatNumber(sliderMax!)}</span>
              </span>
              <Slider
                className="w-full"
                value={[parseFloat(filter.value) || sliderMin!]}
                onValueChange={(vals) => {
                  const val = vals[0];
                  // Force it to 3 decimal places
                  const precise = parseFloat(val.toFixed(3));
                  onInput(precise.toString(), filter);
                }}
                min={sliderMin!}
                max={sliderMax!}
                step={stepSize}
                aria-label="Slider with input"
              />
            </div>
          ))}
      </div>
    );
  };
  const remove = (filter: NumericFilter) => (
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
                {filterInput(filter, !['==', '!=', 'exists', 'isNone'].includes(filter.mode))}
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
              placeholder={`e.g. ${column} > 0 and ${column} < 100`}
              withAutocomplete={false}
            />
          </div>
        </TabsContent>
      </Tabs>
      <div className="mt-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">{filterMode === 'structured' && append}</div>
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
      // Tie the <Dialog> open to the parent state if not "menuItem" mode
      open={renderMode === 'menuItem' ? undefined : interactive && open}
      setOpen={renderMode === 'menuItem' ? undefined : setOpen}
      button={
        renderMode === 'menuItem' ? (
          // Because this is inside a parent DropdownMenuItem,
          // we must prevent the parent from closing automatically:
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
      // Stop clicks from closing the parent if it's still around
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerOver={(e) => e.stopPropagation()}
      className="sm:max-w-lg"
    />
  );
};

export default NumericColumnFilter;
