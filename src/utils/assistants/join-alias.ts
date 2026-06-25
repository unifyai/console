/**
 * Translates fully-qualified context paths in join args to the A./B. alias
 * format that Orchestra's _join_query_internal expects.
 *
 * Bindings from Unity use full context paths (e.g.
 * "userId/assistantId/Data/Project/Context.Column") because Unity needs the
 * resolved path for context lookup. Orchestra's join engine, however, expects
 * the two tables to be referenced as A and B:
 *   join_expr: "A.Column == B.Column"
 *   select:    { "A.Column": "alias", "B.Column": "alias" }
 *
 * tables[0] -> A, tables[1] -> B
 */

export function aliasJoinPaths(
  tables: [string, string],
  joinExpr: string,
  select: Record<string, string>,
  resultWhere?: string | null
): {
  joinExpr: string;
  select: Record<string, string>;
  resultWhere?: string;
} {
  const [ctxA, ctxB] = tables;

  let aliasedExpr = joinExpr;
  aliasedExpr = aliasedExpr.replaceAll(`${ctxA}.`, 'A.');
  aliasedExpr = aliasedExpr.replaceAll(`${ctxB}.`, 'B.');

  const aliasedSelect: Record<string, string> = {};
  for (const [key, value] of Object.entries(select)) {
    let aliasedKey = key;
    if (key.startsWith(`${ctxA}.`)) {
      aliasedKey = 'A.' + key.slice(ctxA.length + 1);
    } else if (key.startsWith(`${ctxB}.`)) {
      aliasedKey = 'B.' + key.slice(ctxB.length + 1);
    }
    aliasedSelect[aliasedKey] = value;
  }

  const result: {
    joinExpr: string;
    select: Record<string, string>;
    resultWhere?: string;
  } = { joinExpr: aliasedExpr, select: aliasedSelect };

  if (resultWhere) {
    let rw = resultWhere;
    rw = rw.replaceAll(`${ctxA}.`, 'A.');
    rw = rw.replaceAll(`${ctxB}.`, 'B.');
    result.resultWhere = rw;
  }

  return result;
}
