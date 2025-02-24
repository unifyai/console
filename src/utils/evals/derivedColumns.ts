/*
    Converts a raw mathematical function using column and table names as variables
    to the proper format derived column equations. Preprocessing uses the following
    regex patterns;
    - appendRegex: Replaces standalone column names with current_table.column_name.
    - wrapRegex: Wraps all instances of table_name.column_name with curly braces.
    - processed: Extracts non-quoted variables and only apply formatting to those.
*/
export const expressionToDerivedFunction = ( expression: string, currentTable: string, tables: string[], columns: string[] ) => {
    const appendRegex = new RegExp(`(?<!(${tables.join('|')})[.:])(${columns.join('|')})`, 'g'); 
    const wrapRegex = new RegExp(`(${tables.join('|')})[.:](${columns.join('|')})`, 'g');
  
    const tokens = expression.split(/(".*?"|'.*?')/g);
    const processed = tokens.map(token => {
      if (token.startsWith('"') || token.startsWith("'")) return token;
      return token
        .replace(appendRegex, (match, p1, p2) => `${currentTable}:${p2}`)
        .replace(wrapRegex, '{$1:$2}');
    });

    return processed.join('');
};
  

/* Converts back a derived equation to a raw mathematical function, by:
   1- Removing curly braces around table:column or table.column, and
   2- Replacing all colons with dots to revert to original separator
*/
export const derivedFunctionToExpression = (equation: string) => {
    const unwrapped = equation.replace(/\{([^}]+)\}/g, '$1');
    const original = unwrapped.replace(/:/g, '.');
    return original;
};
