import { Filters, FiltersByColumn } from '@/types/interfaces/columns';
import { processContext } from './columnOperations';
import { LogFieldsResponseProps, GetLogsParameters } from '@/types/interfaces/logs';
import { AbsoluteDateString, RelativeDateString } from '@/types/interfaces/filters';
import {
  differenceInYears,
  differenceInMonths,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  differenceInMilliseconds,
  subMonths,
  subDays,
  subHours,
  subMinutes,
  subSeconds,
  subMilliseconds,
  subYears,
} from 'date-fns';
import { TileProps } from '@/types/interfaces/grid';

/* Initialization constants and utils*/
export const now = new Date(Date.now());
export const defaultRelativeDate = `0Y;0M;0D;0h;0m;0s;0ms` as RelativeDateString;
export const defaultAbsoluteDate = new Date(Date.now()).toISOString() as AbsoluteDateString;
export const initDefaultDate = (value: string, relative: boolean) => {
  return relative
    ? value
      ? (value as RelativeDateString)
      : defaultRelativeDate
    : value
      ? (value as AbsoluteDateString)
      : defaultAbsoluteDate;
};

/* Checks if a date is in relative format */
export const isRelativeDate = (date: AbsoluteDateString | RelativeDateString) => {
  const regex = /^\d+Y;\d+M;\d+D;\d+h;\d+m;\d+s;\d+ms$/;
  return regex.test(date);
};

/* Checks if a date has NaN values and resets to the default date if so */
export const handleInvalidDate = (date: AbsoluteDateString | RelativeDateString) => {
  if (date === 'NaNY;NaNM;NaND;NaNh;NaNm;NaNs;NaNms') return defaultRelativeDate;
  else if (date === 'NaN-NaN-NaNTNaN:NaN:NaNZ') return defaultAbsoluteDate;
  else return date;
};

/* 
	Converts a relative format date to an ISO timedelta string
*/
export const relativeToTimeDelta = (value: RelativeDateString) => {
  let times = value.replace('"', '').split(';');
  times = times.map((time) => {
    if (time.endsWith('Y')) return `P${time}`;
    else if (time.endsWith('D')) return `${time}T`;
    else if (time.endsWith('h')) return time.replace('h', 'H');
    else if (time.endsWith('m')) return time.replace('m', 'M');
    else if (time.endsWith('s')) return time.replace('s', 'S');
    else return time;
  });
  times = times.slice(0, -1); // Remove milliseconds
  return `${times.join('')}`;
};

/* Converts a date from relative format to an absolute date	*/
export const toAbsoluteDate = (value: RelativeDateString) => {
  const offsets = value.split(';').map((offset) => +offset.replace(/[^0-9]/g, ''));
  const date = new Date(Date.now());
  date.setFullYear(date.getFullYear() - offsets[0]);
  date.setMonth(date.getMonth() - offsets[1]);
  date.setDate(date.getDate() - offsets[2]);
  date.setHours(date.getHours() - offsets[3]);
  date.setMinutes(date.getMinutes() - offsets[4]);
  date.setSeconds(date.getSeconds() - offsets[5]);
  date.setMilliseconds(date.getMilliseconds() - offsets[6]);
  const absolute = handleInvalidDate(date.toISOString() as AbsoluteDateString);
  return absolute as AbsoluteDateString;
};

/* Converts a date from absolute format to relative, compared to a specified baseline date */
export const toRelativeDate = (value: AbsoluteDateString, base: Date) => {
  const date = new Date(value);

  // Determine if date is before or after base for proper difference calculation
  const isAfter = date >= base;
  const [later, earlier] = isAfter ? [date, base] : [base, date];

  // Calculate differences by subtracting larger units first
  const years = differenceInYears(later, earlier);
  const afterYears = subYears(later, years);
  const months = differenceInMonths(afterYears, earlier);
  const afterMonths = subMonths(afterYears, months);
  const days = differenceInDays(afterMonths, earlier);
  const afterDays = subDays(afterMonths, days);
  const hours = differenceInHours(afterDays, earlier);
  const afterHours = subHours(afterDays, hours);
  const minutes = differenceInMinutes(afterHours, earlier);
  const afterMinutes = subMinutes(afterHours, minutes);
  const seconds = differenceInSeconds(afterMinutes, earlier);
  const afterSeconds = subSeconds(afterMinutes, seconds);
  const milliseconds = differenceInMilliseconds(afterSeconds, earlier);

  const offsets = [
    `${years}Y`,
    `${months}M`,
    `${days}D`,
    `${hours}h`,
    `${minutes}m`,
    `${seconds}s`,
    `${milliseconds}ms`,
  ];
  const relative = handleInvalidDate(offsets.join(';') as RelativeDateString);
  return relative as RelativeDateString;
};

/* Converts a date string from relative format to absolute format or vice versa */
export const rebaseDate = (
  date: AbsoluteDateString | RelativeDateString,
  target: 'absolute' | 'relative'
) => {
  const isRelative = isRelativeDate(date);
  if (target === 'relative') {
    return isRelative ? date : toRelativeDate(date as AbsoluteDateString, now);
  } else {
    return isRelative ? toAbsoluteDate(date as RelativeDateString) : date;
  }
};

/* 
	Separates string filters that have more than one filter joined with && / ||, for a given function.
	E.g: 
		A filter of this format: "first || second && third || fourth"
		Is transformed into: ["first", "||", "second", "&&", "third", "||", "fourth"]
*/
export function separateFunctionFilters(filter: string) {
  const parts = filter.split(/(\s\|\|\s|\s&&\s)/); // Split and keep separators
  let separated = [];
  let currentPart = '';

  // If part is a separator, save the current part and add separator
  // Otherwise, accumulate the current part
  // Then, push the final accumulated part if there's any
  parts.forEach((part) => {
    if (part === ' || ' || part === ' && ') {
      separated.push(currentPart);
      separated.push(part.trim());
      currentPart = '';
    } else {
      currentPart += part;
    }
  });
  if (currentPart) separated.push(currentPart);

  // Filter out empty strings from the beginning (if any)
  if (separated[0] === '') {
    separated.shift(); // Remove the first element
  }

  return separated;
}

/* 
	Constructs a filter expression from a list of filters / separators using the same function
	E.g: 
		A `separated` filter of this format: ["first", "||", "second", "&&", "third", "||", "fourth"]
		Is transformed into: "first ${fn} ${cKey} or second ${fn} ${cKey} and third ${fn} ${cKey} or fourth ${fn} ${cKey}"
*/
function joinFunctionFilters(
  filter: string,
  fn: string,
  cKey: string,
  fields: LogFieldsResponseProps
) {
  let joined = '';

  /* Fallback value */
  if (!filter) return '';

  /* Single filters: Filters with a single value per function */
  // Handle images
  if (fields[cKey] && fields[cKey].dataType === 'image') {
    joined = filter === 'false' ? `isNone(${cKey})` : `not isNone(${cKey})`;
    return ' and ' + joined;
  }

  /* Cumulative filters: Filters that can have more than one value for a given function */
  // Break down a filter into a list of successive joins (&& / ||) and filter values
  const separated = separateFunctionFilters(filter);

  /** Combines the list into a single expression and:
   * Replace "&&" with "and", and "||" with "or"
   * Handle ordering of value / fn / cKey for "in" / "not in" operators and other operators differently
   * Converts relative timestamp filters to absolute timestamps (if applicable)
   */
  separated.forEach((item) => {
    // Append filter value
    if (item != '||' && item != '&&') {
      let value = item;

      // Handle relative timestamps
      if (
        fields[cKey] &&
        ['timestamp', 'time', 'date'].includes(fields[cKey].dataType) &&
        value.includes(';')
      ) {
        const date = toAbsoluteDate(value as RelativeDateString);
        value = `${date.replace('T', ' ').replace('Z', '')}`;
        value = value.startsWith('"') ? value : `"${value}`;
        value = value.endsWith('"') ? value : `${value}"`;
      }

      // Handle datetime
      if (fields[cKey] && fields[cKey].dataType === 'date') {
        value = value.split(' ')[0];
        value = value.startsWith('"') ? value : `"${value}`;
        value = value.endsWith('"') ? value : `${value}"`;
      }

      // Handle time
      if (fields[cKey] && fields[cKey].dataType === 'time') {
        value = value.split(' ')[1];
        value = value.startsWith('"') ? value : `"${value}`;
        value = value.endsWith('"') ? value : `${value}"`;
      }

      // Handle timedelta (relative by default)
      if (fields[cKey] && fields[cKey].dataType === 'timedelta') {
        value = relativeToTimeDelta(value as RelativeDateString);
        value = value.startsWith('"') ? value : `"${value}`;
        value = value.endsWith('"') ? value : `${value}"`;
      }

      // Handle isNone / exists / inclusion
      if (fn === 'isNone') {
        joined += value.includes('true') ? `isNone(${cKey})` : `not isNone(${cKey})`;
      } else if (fn === 'exists') {
        joined += value.includes('true') ? `exists(${cKey})` : `not exists(${cKey})`;
      } else if (['in str', 'not in str'].includes(fn)) {
        joined += `${value} ${fn.replace(' str', '')} str(${cKey})`;
      } else if (['in', 'not in'].includes(fn)) {
        joined += `${value} ${fn} ${cKey}`;
      } else {
        joined += `${cKey} ${fn} ${value}`;
      }
    }
    // Append join operator
    else {
      const join = item === '&&' ? 'and' : 'or';
      joined += ` ${join} `;
    }
  });

  return joined;
}

/* 
	Converts nested filters dict into string filter expression.
*/
export function filtersToExpression(
  columnFilters: FiltersByColumn,
  fields: LogFieldsResponseProps
) {
  if (Object.keys(columnFilters).length === 0) return '';
  let expression = '';

  Object.entries(columnFilters).forEach(([cKey, filter]) =>
    Object.entries(filter).forEach(([fn, value]) => {
      if (fn === 'expression') {
        // For expression mode, the value is the complete, user-provided expression for that column.
        // Wrap it in parentheses for safety during assembly.
        if (value) {
          expression += ` and (${value})`;
        }
      } else {
        const filterExpr = joinFunctionFilters(value, fn, cKey, fields);
        if (filterExpr) {
          expression += ` and (${filterExpr})`;
        }
      }
    })
  );

  expression = expression.replace(' and ', ''); // Remove first instance of " and "
  return expression;
}

/* 
	Converts filter search param expression to nested fitlers dict.
	Group triplets of column, fn and value together, then group filters by column.
*/
export function searchParamToFilters(
  searchExpression: string | undefined,
  columnContext: string | undefined
) {
  if (!searchExpression) return {};
  const filters = searchExpression
    .split('§')
    .map((filter) => {
      let [column, fn, value] = filter.split('~');
      if (columnContext) column = processContext('merge', columnContext, column);
      return { [column]: { [fn]: value } };
    })
    .reduce((acc, curr) => {
      for (const column in curr) {
        acc[column] = acc.hasOwnProperty(column)
          ? { ...acc[column], ...curr[column] }
          : curr[column];
      }
      return acc;
    }, {});
  return filters;
}

/* 
	Extract array of filter inputs from column filters
*/
export function initFilters(
  column: string,
  columnFilters: FiltersByColumn,
  initialValues: { key: number; mode: string; join: '&&' | '||'; value: string }[],
  modes: string[]
) {
  const filterModes = Object.keys(columnFilters[column]);
  filterModes.forEach((mode) => {
    const filtersString = columnFilters[column][mode];
    if (filtersString) {
      const parts = separateFunctionFilters(filtersString);
      if (parts.length === 0) return;

      // First part is always a value, with a default join for UI purposes
      initialValues.push({
        key: initialValues.length,
        mode,
        join: '&&', // This is not used for expression generation, just for UI state
        value:
          parts[0].startsWith('"') && parts[0].endsWith('"')
            ? parts[0].slice(1, -1).trim()
            : parts[0].trim(),
      });

      // Subsequent parts are [join, value] pairs
      for (let i = 1; i < parts.length; i += 2) {
        const join = parts[i] as '&&' | '||';
        const value = parts[i + 1]
          ? parts[i + 1].startsWith('"') && parts[i + 1].endsWith('"')
            ? parts[i + 1].slice(1, -1).trim()
            : parts[i + 1].trim()
          : '';
        initialValues.push({ key: initialValues.length, mode, join, value });
      }
    }
  });
}

/* 
	Combine filter inputs using the same filter mode
*/
export function combineFilters(
  newFilters: { key: number; mode: string; join: '&&' | '||'; value: string }[],
  modes: string[]
) {
  const filtersByMode: { [mode: string]: { value: string; join: '&&' | '||' }[] } = {};
  newFilters.forEach((f) => {
    if (!filtersByMode[f.mode]) filtersByMode[f.mode] = [];
    filtersByMode[f.mode].push({ value: f.value, join: f.join });
  });

  const combined: Filters = {};
  for (const mode in filtersByMode) {
    const items = filtersByMode[mode];
    if (items.length > 0) {
      // First item's value starts the string. Subsequent items use their join operator.
      let result = items[0].value;
      for (let i = 1; i < items.length; i++) {
        result += ` ${items[i].join} ${items[i].value}`;
      }
      combined[mode] = result;
    }
  }
  return combined;
}

/* 
	Potentially wrap a filter value in quotes
*/
export const maybeWrapFilterInQuotes = (value: string) =>
  value.startsWith('"') && value.endsWith('"') ? value : `"${value}"`;

/** 
	Construct full filter expression from column filters, common filters and freezing by:
	* Converting filters search param value to a nested dictionary representation of column, function and values
    * Joining column filters with the corresponding filter functions and values using "and"
    * Joining common filters with the "in" filter function and common filter value using "or", or pass the expression if filtering by expression
    * Joining common and column filters into a single filter expression
*/
export const buildFilterExpression = (
  filters: string | undefined,
  commonFilter: string | undefined,
  columnContext: string | undefined,
  freeze: string | undefined,
  fields: LogFieldsResponseProps
) => {
  const filter: { [column: string]: { [fn: string]: string } } = searchParamToFilters(
    filters,
    columnContext
  );

  const columnFiltersExpression = filtersToExpression(filter, fields);

  let commonFiltersExpression = '';
  if (commonFilter && fields) {
    const commonFilterMode = commonFilter.split('§')[0];
    const commonFilterValue = commonFilter.split('§')[1];
    if (!commonFilterValue) return columnFiltersExpression || null;
    if (commonFilterMode === 'expression') {
      let filter = commonFilterValue;
      const processFilter = (value: string, column: string, columnContext: string | undefined) =>
        value.replace(
          new RegExp(column, 'g'),
          columnContext ? processContext('merge', columnContext, column) : column
        );
      Object.keys(fields).forEach((column) => processFilter(filter, column, columnContext));
      commonFiltersExpression = filter;
    } else {
      const validFields = Object.fromEntries(
        Object.entries(fields).filter(([_, attributes]) => attributes.dataType != 'image')
      ); // Exclude images
      const filterValue = maybeWrapFilterInQuotes(commonFilterValue);
      const processFilter = (value: string, column: string, columnContext: string | undefined) =>
        `${value} in str(${columnContext ? processContext('merge', columnContext, column) : column})`;
      commonFiltersExpression = Object.keys(validFields)
        .map((column) => processFilter(filterValue, column, columnContext))
        .join(' or ');
    }
  }

  let filterExpression: string | null = null;
  if (columnFiltersExpression) filterExpression = columnFiltersExpression;
  if (commonFiltersExpression)
    filterExpression = filterExpression
      ? `${commonFiltersExpression} and ${filterExpression}`
      : commonFiltersExpression;
  if (freeze)
    filterExpression = filterExpression
      ? filterExpression + ` and createdAt < "${freeze}"`
      : `createdAt < "${freeze}"`;

  return filterExpression;
};

/* 
	Construct filter expression from table argument's filters, common filters and freeze.
	Filter expression neededs to be dynamically evaluated to process relative timestamp filters
*/
export function buildFilterExpressionArgument(args: {
  getLogsParameters: GetLogsParameters;
  availableFields?: LogFieldsResponseProps;
}) {
  const fields = args.availableFields ?? {};
  const params = args.getLogsParameters;
  if ('filters' in params) {
    params['filterExpr'] =
      buildFilterExpression(
        params['column_filters'],
        params['commonFilter'],
        params['columnContext'],
        params['freeze'],
        fields
      ) ?? '';
    delete params['filters'];
    delete params['commonFilter'];
    delete params['freeze'];
  }
  return { availableFields: fields, getLogsParameters: params };
}
