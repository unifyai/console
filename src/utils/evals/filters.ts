import { FiltersByColumn } from "@/types/evals/columns";

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
				fn === "in" 
					? `${value} ${fn} ${cKey}` 
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
					column = context + column
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
