/**
 * Column-id helpers shared by Data LogGrid and Interfaces table tiles.
 * Interfaces historically prefixes ids with `Entries/` / `Parameters/`;
 * Data uses flat public field names. Call sites normalize at product boundaries.
 */

/** Strip `Parameters/` or `Entries/` prefixes from a column id. */
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
