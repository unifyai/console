'use client';

import {
  KeyboardEventHandler,
  useState,
  useEffect,
  Dispatch,
  SetStateAction,
  useMemo,
} from 'react';
import { Filters, FiltersByColumn } from '@/types/interfaces/columns';
import BaseDropdown from '@/components/Common/Dropdowns/Base';
import ActionButton from '@/components/Common/Buttons/Action';
import BaseButton from '@/components/Common/Buttons/Base';
import SubmitButton from '@/components/Common/Buttons/Submit';
import {
  Filter,
  Plus,
  Minus,
  Trash,
  CircleX,
  LoaderCircle,
  ChevronRightIcon,
  X,
  ListTree,
} from 'lucide-react';
import InputWithStartSelect from '@/components/Common/Input/StartSelect';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';
import { combineFilters, initFilters } from '@/utils/interfaces/table/filters';
import { GroupedLogProps, LogProps } from '@/types/interfaces/logs';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { sanitizeId } from '@/utils/interfaces/table/columnOperations';
import {
  SelectValue,
  SelectTrigger,
  SelectLabel,
  SelectContent,
  SelectItem,
  SelectGroup,
} from '@/components/UI/select';
import { Select } from '@/components/UI/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import Tooltip from '@/components/Common/Misc/Tooltip';
import FormulaInput from '@/components/Common/Input/Formula';
import { TbMathFunction } from 'react-icons/tb';
import { isImeComposing } from '@/utils/keyboard';

interface BooleanFilter {
  key: number;
  mode: 'is' | 'exists' | 'isNone';
  join: '&&' | '||';
  value: string;
}

const capitalizeFirstLetter = (value: string): string => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';
  return trimmedValue.charAt(0).toUpperCase() + trimmedValue.slice(1);
};

const BooleanColumnFilter = ({
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
  entriesProperties: string[];
}) => {
  /* Display loader when data updates */
  const [spinnerColor, setSpinnerColor] = useState('white');
  const [filterMode, setFilterMode] = useState<'structured' | 'expression'>('structured');
  const [expression, setExpression] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  /* Init filters */
  const options = useMemo(
    () => [
      { name: 'is', label: 'Is', description: `Filter for ${column} values equal to..` },
      { name: 'exists', label: 'Exists', description: `Filter for ${column} existing values..` },
      { name: 'isNone', label: 'Is None', description: `Filter for ${column} none values..` },
    ],
    [column]
  );
  const modes = useMemo(() => options.map((option) => option.name), [options]);
  const defaultFilter: BooleanFilter = useMemo(
    () => ({ key: 0, mode: 'is', join: '&&', value: 'true' }),
    []
  );
  const initialValues: BooleanFilter[] = [];

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
        const initialValues: BooleanFilter[] = [];
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

  const structuredToExpression = (structuredFilters: BooleanFilter[]): string => {
    if (!structuredFilters.length) return '';
    return structuredFilters
      .map((filter, index) => {
        let singleExpr = '';
        const val = filter.value === 'true' ? 'True' : 'False';

        if (filter.mode === 'exists') {
          singleExpr = filter.value === 'true' ? `exists(${column})` : `not exists(${column})`;
        } else if (filter.mode === 'isNone') {
          singleExpr = filter.value === 'true' ? `isNone(${column})` : `not isNone(${column})`;
        } else {
          // 'is' mode
          singleExpr = `${column} == ${val}`;
        }

        if (index > 0) {
          return ` ${filter.join === '&&' ? 'and' : 'or'} ${singleExpr}`;
        }
        return singleExpr;
      })
      .filter(Boolean)
      .join('');
  };

  const expressionToStructured = (expr: string): BooleanFilter[] | null => {
    if (!expr.trim()) return [];
    const newFilters: BooleanFilter[] = [];
    const escapedColumn = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `(?:\\s*(and|or)\\s+)?\\s*\\(?\\s*(?:(?:(not)\\s+)?(exists|isNone)\\s*\\(\\s*${escapedColumn}\\s*\\)|${escapedColumn}\\s*==\\s*(True|False))\\s*\\)?`,
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
        newFilters.push({ key: key++, mode: 'is', join, value: match[4].toLowerCase() });
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
  const onInput = (input: string, filter: BooleanFilter) => {
    const newFilters = [...filters];
    newFilters.find((f) => f.key === filter.key)!.value = input;
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
        value: f.value === 'true' ? 'True' : f.value === 'false' ? 'False' : f.value,
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

  // Dialog interactions
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
      variant={column in columnFilters ? 'primary' : undefined}
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
  const submit = <SubmitButton text="Apply" onClick={() => onSubmit()} />;
  const append = (
    <BaseDropdown context="tile" button={<ActionButton tooltip="Add new filter" icon={<Plus />} />}>
      {['And', 'Or'].map((method, index) => (
        <DropdownMenuItem
          key={index}
          className="text-body-sm cursor-pointer p-2 hover:bg-primary hover:text-primary-foreground"
          onClick={() => {
            const newFilters = [...filters];
            newFilters.push({
              key: filters.length,
              mode: 'is',
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

  // Filter row
  const join = (filter: BooleanFilter) => (
    <BaseDropdown
      context="tile"
      button={
        <ActionButton tooltip="Update joining method" text={filter.join === '&&' ? 'and' : 'or'} />
      }
    >
      {['And', 'Or'].map((method, index) => (
        <DropdownMenuItem
          key={index}
          className="text-body-sm cursor-pointer p-2 hover:bg-primary hover:text-primary-foreground"
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
  const toggleInput = (filter: BooleanFilter) => (
    <BaseButton
      text={capitalizeFirstLetter(filter.value)}
      variant="outline"
      className="text-body-sm w-full rounded-none rounded-br-lg rounded-tr-lg font-normal"
      onKeyDown={onEnter}
      onClick={() => {
        const newFilters = [...filters];
        newFilters.find((f) => f.key === filter.key)!.value === 'true'
          ? (newFilters.find((f) => f.key === filter.key)!.value = 'false')
          : (newFilters.find((f) => f.key === filter.key)!.value = 'true');
        setFilters(newFilters);
      }}
    />
  );
  const filterInput = (filter: BooleanFilter) => {
    const option = options.find((option) => option.name === filter.mode)!;
    return (
      <InputWithStartSelect
        options={options}
        option={option}
        onOptionChange={(option) => {
          const newFilters = [...filters];
          newFilters.find((f) => f.key === filter.key)!.mode = option.name as 'is';
          if (['exists', 'isNone', 'is'].includes(option.name)) {
            newFilters.find((f) => f.key === filter.key)!.value = 'true';
          }
          setFilters(newFilters);
        }}
      >
        {toggleInput(filter)}
      </InputWithStartSelect>
    );
  };
  const remove = (filter: BooleanFilter) => (
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
              className="text-body-sm flex items-center gap-2"
            >
              <ListTree className="h-4 w-4" />
              Structured Mode
            </TabsTrigger>
          </Tooltip>
          <TabsTrigger value="expression" className="text-body-sm flex items-center gap-2">
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
              placeholder={`e.g. ${column} == True`}
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
      {/* {close} */}
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
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="text-body-sm relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"
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
      className="sm:max-w-lg"
    />
  );
};

export default BooleanColumnFilter;
