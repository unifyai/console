/** Re-export grouping helpers from the shared interfaces table utils. */
export {
  maybeConvertRawToGroupedLogs,
  getGroupingFilters,
  getUpdatedGroupingExpression,
  isGroupedLogs,
  getTargetGroupFilters,
} from '@/utils/interfaces/table/grouping';

import { sanitizeId } from './columns';

/** Append a single equality filter for a group key/value onto an existing filterExpr. */
export function appendGroupValueFilter(
  filterExpr: string | null | undefined,
  groupingColumnId: string,
  groupingValue: unknown,
  dataType?: string
): string {
  const col = sanitizeId(groupingColumnId);
  let literal: string;
  if (groupingValue === null || groupingValue === undefined) {
    literal = 'None';
  } else if (dataType === 'int' || dataType === 'float' || dataType === 'bool') {
    literal = String(groupingValue);
  } else {
    literal = `"${String(groupingValue).replace(/"/g, '\\"')}"`;
  }
  const clause = `${col} == ${literal}`;
  if (!filterExpr?.trim()) return clause;
  return `(${filterExpr}) and (${clause})`;
}

/** Encode group sort for Orchestra (`field@true` = descending). */
export function encodeGroupSorting(columnId: string, descending: boolean): string {
  return `${columnId}@${descending ? 'true' : 'false'}`;
}
