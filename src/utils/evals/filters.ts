import { FiltersByColumn } from "@/types/evals/columns";
import { processContext } from "./columnOperations";

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

	return separated
}

/* 
	Constructs a filter expression from a list of filters / separators using the same function
	E.g: 
		A filter of this format: ["first", "||", "second", "&&", "third", "||", "fourth"]
		Is transformed into: "first ${fn} ${cKey} or second ${fn} ${cKey} and third ${fn} ${cKey} or fourth ${fn} ${cKey}"
*/
export function joinFunctionFilters (filter: string, fn: string,cKey: string) {
	
	// Use the resulting list of values / separators 
	// to construct the final filter expression 
	let joined = '';
	const separated = separateFunctionFilters(filter)
	separated.forEach(item => {
		if (item != '||' && item != '&&' ) {
			joined += `${item} ${fn} ${cKey}`
		} else {
			const join = item === "&&" ? "and" : "or"
			joined += ` ${join} `
		}
	})

	return joined;
}

/* 
	Converts nested filters dict into string filter expression.
	Join column filters with the corresponding filter functions and values using "and"
*/
export function filtersToExpression (columnFilters: FiltersByColumn) {
	if (Object.keys(columnFilters).length === 0) return ""
	const expression = Object
		.entries(columnFilters)
		.map(([cKey, filter]) =>
			Object.entries(filter).map(([fn, value]) => 
				["in", "not in"].includes(fn) 
					? value.includes(" && ") || value.includes(" || ")
						? joinFunctionFilters(value, fn, cKey)
						: `${value} ${fn} ${cKey}` 
					: `${cKey} ${fn} ${value}`
			)
		)
		.flat()
		.join(" and ")
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
