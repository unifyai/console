/**
 * Column-id helpers shared by Data LogGrid and Interfaces table tiles.
 * Interfaces historically prefixes ids with `Entries/` / `Parameters/`;
 * Data uses flat public field names. Call sites normalize at product boundaries.
 *
 * Orchestra stores entry keys in snake_case. The typed client camelCases response
 * keys (`exchange_id` → `exchangeId`), so anything sent back as `group_by`,
 * `filter_expr`, or `sorting` must convert field names to snake_case again.
 */

import { camelToSnake } from '@/utils/casing';

/** Strip `Parameters/` or `Entries/` prefixes from a column id (capitalized only). */
export function sanitizeId(id: string): string {
  if (id.startsWith('Parameters/')) {
    return id.slice('Parameters/'.length);
  }
  if (id.startsWith('Entries/')) {
    return id.slice('Entries/'.length);
  }
  return id;
}

/**
 * Field path as Orchestra expects it in filter/sort payloads (snake_case segments).
 * UI ids may be camelCase after response casing (`exchangeId` → `exchange_id`).
 * Preserves lowercase `entries/…` paths used by Interfaces filter expressions.
 */
export function toOrchestraFieldName(field: string): string {
  // Only strip capitalized Entries/Parameters namespace; lowercase entries/ is a
  // filter-language path segment and must remain.
  return sanitizeId(field)
    .split('/')
    .map((segment) => camelToSnake(segment))
    .join('/');
}

/**
 * Prefixed column path for Orchestra `group_by` / nest expressions.
 * Preserves Entries vs Parameters; normalizes the field portion to snake_case.
 */
export function toOrchestraColumnPath(columnId: string): string {
  const lower = columnId.toLowerCase();
  if (lower.startsWith('parameters/')) {
    const rest = columnId.slice(columnId.indexOf('/') + 1);
    return `Parameters/${rest
      .split('/')
      .map((segment) => camelToSnake(segment))
      .join('/')}`;
  }
  if (lower.startsWith('entries/')) {
    const rest = columnId.slice(columnId.indexOf('/') + 1);
    return `Entries/${rest
      .split('/')
      .map((segment) => camelToSnake(segment))
      .join('/')}`;
  }
  // Flat UI field id (Data LogGrid)
  return `Entries/${toOrchestraFieldName(columnId)}`;
}

/**
 * Split or merge a column-context prefix with a column key.
 * Respects leading/trailing `/` and null/undefined inputs.
 */
export function processContext(
  operation: 'split' | 'merge',
  context: string | null | undefined,
  input: string | null | undefined
): string {
  if (!context && !input) {
    return '';
  }

  if (operation === 'split') {
    if (!input) {
      return '';
    }
    if (!context || !input.startsWith(context)) {
      return input;
    }
    return input.slice(context.length).replace(/^\/+/, '');
  }

  if (operation === 'merge') {
    if (!context) {
      return input || '';
    }
    if (!input) {
      return context;
    }
    return context.replace(/\/+$/, '') + '/' + input.replace(/^\/+/, '');
  }

  throw new Error("Invalid operation. Use 'split' or 'merge'.");
}

/** Prefixed Interfaces-style column id for an entry field. */
export function entriesColumnId(field: string): string {
  return field.startsWith('Entries/') || field.startsWith('Parameters/')
    ? field
    : `Entries/${field}`;
}

/** Visible columns given an order list and a hidden set. */
export function visibleColumnIds(columnOrder: string[], hiddenColumns: string[]): string[] {
  const hidden = new Set(hiddenColumns);
  return columnOrder.filter((id) => !hidden.has(id));
}

/** Default-hide underscore-prefixed private/metadata fields. */
export function defaultHiddenForFields(fieldNames: string[]): string[] {
  return fieldNames.filter((name) => sanitizeId(name).startsWith('_'));
}
