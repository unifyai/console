/*
    Converts a raw mathematical function using column and table names as variables
    to the proper format derived column equations. 
*/
export const expressionToDerivedFunction = (
  expression: string,
  currentTable: string,
  tables: string[],
  columns: string[]
) => {
  // Sort columns descending by length to match longer names first
  columns.sort((a, b) => b.length - a.length);

  // Regex to match optional table prefix + a column
  const regex = new RegExp(`(?:(${tables.join('|')})[.:])?(${columns.join('|')})`, 'g');

  return expression.replace(regex, (match, table, column) => {
    // Always wrap the result in {}
    if (table) return `{${table}:${column}}`;
    return `{${currentTable}:${column}}`;
  });
};

/* Converts back a derived equation to a raw mathematical function by
   removing curly braces and replacing colon with dot in all instances
   of {table:column} pattern
*/
export const derivedFunctionToExpression = (
  equation: string,
  tables: string[],
  columns: string[]
) => {
  const tableSet = new Set(tables);
  const columnSet = new Set(columns);
  const replaced = equation.replace(/\{([^}]+)\}/g, (_, content) => {
    const parts = content.split(':');
    if (parts.length === 2 && tableSet.has(parts[0]) && columnSet.has(parts[1])) {
      return `${parts[0]}.${parts[1]}`;
    } else {
      return `{${content}}`;
    }
  });
  return replaced;
};
