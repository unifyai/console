/*
    Converts a raw mathematical function using column and table names as variables
    to the proper format derived column equations. Preprocessing uses the following
    regex patterns;
    - appendRegex: Replaces standalone column names with current_table.column_name.
    - wrapRegex: Wraps all instances of table_name.column_name with curly braces.
*/
export const expressionToDerivedFunction = (expression: string, currentTable: string, tables: string[], columns: string[]) => {
    const appendRegex = new RegExp(`(?<!(${tables.join('|')})[.:])(${columns.join('|')})`, 'g'); 
    const wrapRegex = new RegExp(`(${tables.join('|')})[.:](${columns.join('|')})`, 'g');        
    const equation = expression.replace(appendRegex, (match, p1, p2) => `${currentTable}:${p2}`).replace(wrapRegex, '{$1:$2}');
    return equation
}

/* Converts back a derived equation to a raw mathematical function, by:
   1- Removing curly braces around table:column or table.column, and
   2- Replacing all colons with dots to revert to original separator
*/
export const derivedFunctionToExpression = (equation: string) => {
    const unwrapped = equation.replace(/\{([^}]+)\}/g, '$1');
    const original = unwrapped.replace(/:/g, '.');
    return original;
};
