import { Filters, FiltersByColumn } from "@/types/evals/columns";
import { processContext } from "./columnOperations";
import { LogFieldsResponseProps } from "@/types/evals/logs";
import { AbsoluteDateString, RelativeDateString } from "@/types/evals/filters";
import { differenceInYears, differenceInMonths, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, differenceInMilliseconds, subMonths, subDays, subHours, subMinutes, subSeconds, subMilliseconds, subYears } from 'date-fns';

/* Initialization constants and utils*/
export const now = new Date(Date.now())
export const defaultRelativeDate = `0Y;0M;0D;0h;0m;0s;0ms` as RelativeDateString;
export const defaultAbsoluteDate = new Date(Date.now()).toISOString() as AbsoluteDateString;
export const initDefaultDate = (value: string, relative: boolean) => {
    return relative 
    ? value ? value as RelativeDateString : defaultRelativeDate
    : value ? value as AbsoluteDateString : defaultAbsoluteDate
}

/* Checks if a date is in relative format */
export const isRelativeDate = (date: AbsoluteDateString | RelativeDateString) => {
	const regex = /^\d+Y;\d+M;\d+D;\d+h;\d+m;\d+s;\d+ms$/;
  	return regex.test(date);
}

/* Checks if a date has NaN values and resets to the default date if so */
export const handleInvalidDate = (date: AbsoluteDateString | RelativeDateString) => {
	if (date === "NaNY;NaNM;NaND;NaNh;NaNm;NaNs;NaNms") 
		return defaultRelativeDate
	else if (date === "NaN-NaN-NaNTNaN:NaN:NaNZ")
		return defaultAbsoluteDate
	else 
		return date  
}

/* Converts a date from relative format to an absolute date	*/
export const toAbsoluteDate = (value: RelativeDateString) => {
	const offsets = value.split(";").map(offset => +offset.replace(/[^0-9]/g, ''))
	const date = new Date(Date.now())
	date.setFullYear(date.getFullYear() - offsets[0])
	date.setMonth(date.getMonth() - offsets[1])
	date.setDate(date.getDate() - offsets[2] )
	date.setHours(date.getHours() - offsets[3])
	date.setMinutes(date.getMinutes() - offsets[4])
	date.setSeconds(date.getSeconds() - offsets[5])
	date.setMilliseconds(date.getMilliseconds() - offsets[6])
	const absolute = handleInvalidDate(date.toISOString() as AbsoluteDateString)
	return absolute as AbsoluteDateString
}

/* Converts a date from absolute format to relative, compared to a specified baseline date */
export const toRelativeDate = (value: AbsoluteDateString, base: Date) => {
	const date = new Date(value);
	const offsets = [];
    offsets[0] = `${Math.max(0, differenceInYears(base, date))}Y`;
    offsets[1] = `${Math.max(0, differenceInMonths(base, date) % 12)}M`;
    offsets[2] = `${Math.max(0, differenceInDays(base, date) % 30)}D`;
    offsets[3] = `${Math.max(0, differenceInHours(base, date) % 24)}h`;
    offsets[4] = `${Math.max(0, differenceInMinutes(base, date) % 60)}m`;
    offsets[5] = `${Math.max(0, differenceInSeconds(base, date) % 60)}s`;
    offsets[6] = `${Math.max(0, differenceInMilliseconds(base, date) % 1000)}ms`;
	const relative = handleInvalidDate(offsets.join(";") as RelativeDateString)
	return relative as RelativeDateString
}

/* Converts a date string from relative format to absolute format or vice versa */
export const rebaseDate = (date: AbsoluteDateString | RelativeDateString, target: "absolute" | "relative") => {
  const isRelative = isRelativeDate(date)
  if (target === "relative") {
	return isRelative ? date : toRelativeDate(date as AbsoluteDateString, now)
  } else {
	return isRelative ? toAbsoluteDate(date as RelativeDateString) : date
  }
}

/* 
	Separates string filters that have more than one filter joined with && / ||, for a given function.
	E.g: 
		A filter of this format: "first || second && third || fourth"
		Is transformed into: ["first", "||", "second", "&&", "third", "||", "fourth"]
*/
export function separateFunctionFilters (filter: string) {

	const parts = filter.split(/(\s\|\|\s|\s&&\s)/); // Split and keep separators
	let separated = [];
	let currentPart = '';
	
	// If part is a separator, save the current part and add separator
	// Otherwise, accumulate the current part
	// Then, push the final accumulated part if there's any
	parts.forEach(part => {
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
	if (separated[0] === "") {
		separated.shift(); // Remove the first element
	}
	
	return separated
}

/* 
	Constructs a filter expression from a list of filters / separators using the same function
	E.g: 
		A `separated` filter of this format: ["first", "||", "second", "&&", "third", "||", "fourth"]
		Is transformed into: "first ${fn} ${cKey} or second ${fn} ${cKey} and third ${fn} ${cKey} or fourth ${fn} ${cKey}"
*/
function joinFunctionFilters (filter: string, fn: string, cKey: string, fields: LogFieldsResponseProps) {
	let joined = '';

	// Break down a filter into a list of successive joins (&& / ||) and filter values 
	const separated = separateFunctionFilters(filter)

	/** Combines the list into a single expression and:
	 * Replace "&&" with "and", and "||" with "or"
	 * Handle ordering of value / fn / cKey for "in" / "not in" operators and other operators differently
	 * Converts relative timestamp filters to absolute timestamps (if applicable) 
	*/
	separated.forEach(item => {
		// Append filter value
		if (item != '||' && item != '&&' ) {
			let value = item;

			// Handle relative timestamps
			if (fields[cKey] && fields[cKey].data_type === "timestamp" && value.includes(";")) {
				const date = toAbsoluteDate(value as RelativeDateString)
				value = `"${date.replace("T", " ").replace("Z", "")}"`
			}

			if (["in", "not in"].includes(fn))
				joined += `${value} ${fn} ${cKey}`
			else
				joined += `${cKey} ${fn} ${value}`        
		} 
		// Append join operator
		else {
			const join = item === "&&" ? "and" : "or"
			joined += ` ${join} `
		}
	})

	return joined
}

/* 
	Converts nested filters dict into string filter expression.
*/
export function filtersToExpression (columnFilters: FiltersByColumn, fields: LogFieldsResponseProps) {
	if (Object.keys(columnFilters).length === 0) return ""
	let expression = ""
	Object.entries(columnFilters).forEach(([cKey, filter]) => 
		Object.entries(filter).forEach(([fn, value]) => {
		  expression += joinFunctionFilters(value, fn, cKey, fields)
		})
	)
	expression = expression.replace(" and ", "") // Remove first instance of " and "
	return expression
}

/* 
	Converts filter search param expression to nested fitlers dict.
	Group triplets of column, fn and value together, then group filters by column.
*/
export function searchParamToFilters (searchExpression: string | undefined, context: string | undefined) {
	if (!searchExpression) return {}
	const filters = searchExpression
		.split(",")
		.map(filter => {
				let [column, fn, value] = filter.split("@");
				if (context)
					column = processContext("merge", context, column)
				return { [column]: { [fn]: value } };
		})
		.reduce((acc, curr) => {
			for (const column in curr) {
				acc[column] = acc.hasOwnProperty(column) 
					? { ...acc[column], ...curr[column] } 
					: curr[column]
			}
			return acc;
		}, {})
	return filters
}

/* 
	Extract array of filter inputs from column filters
*/
export function initFilters (
	column: string,
	columnFilters: FiltersByColumn,
	initialValues: {key: number, mode: string, join: "&&" | "||", value: string}[],
	modes: string[]
) {
    const filterModes = Object.keys(columnFilters[column]);
    filterModes.forEach((mode, index) => {
        const filters = columnFilters[column][mode];
        if (filters) {
            const array = separateFunctionFilters(filters);
            for (let i = 0; i < array.length; i += 2) {
                const key = index;
                const join = array[i] as "&&" | "||";
                const value = array[i + 1].startsWith('"') && array[i + 1].endsWith('"') ? array[i + 1].slice(1, -1) : array[i + 1];
                initialValues.push({key, mode, join, value});
            }
        }
    });
}

/* 
	Combine filter inputs using the same filter mode
*/
export function combineFilters (
	newFilters: {key: number, mode: string, join: "&&" | "||", value: string}[],
	modes: string[]
) {
	const filters : Filters = {};
	newFilters.forEach(filterItem => {
	  const { mode, join, value } = filterItem;
	  if (filters[mode]) {
		filters[mode] += ` ${join} ${value}`;
	  } else {
		filters[mode] = ` ${join} ${value}`;
	  }
	});
	return filters;
}