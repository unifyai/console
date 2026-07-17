import type { DataBrowserMode } from '@/lib/assistants/dataBrowser';
import { isStateManagerMode } from '@/lib/assistants/dataBrowser';

export interface DataField {
  dataType?: string;
  fieldType?: string;
  mutable?: boolean;
  uiEditable?: boolean;
  enumValues?: string[] | null;
  restrict?: boolean;
}

export interface DataRow {
  logId: number;
  entries: Record<string, unknown>;
}

/** Whether the Data pane may offer editing for this field under the given browser mode. */
export function isDataFieldEditable(field: DataField, mode: DataBrowserMode): boolean {
  if (field.mutable === false || field.fieldType === 'derived_entry') return false;
  if (isStateManagerMode(mode)) {
    return field.uiEditable === true;
  }
  return field.uiEditable !== false;
}

function isJsonValue(field: DataField, value: unknown): boolean {
  const type = field.dataType?.toLowerCase() ?? '';
  return (
    Array.isArray(value) ||
    (typeof value === 'object' && value !== null) ||
    /dict|list|object|json/.test(type)
  );
}

function isNumericField(field: DataField): boolean {
  return /^(int|integer|float|number|decimal)$/i.test(field.dataType ?? '');
}

/** Plain-text draft for inline / form editors. */
export function draftStringForField(field: DataField, value: unknown): string {
  if (value === null || value === undefined) return '';
  const asString = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  const type = field.dataType?.toLowerCase();
  if (type === 'date') return asString.slice(0, 10);
  if (type === 'datetime' || type === 'date-time') return asString.slice(0, 16);
  return asString;
}

/** Coerce an editor draft back to a typed field value for Orchestra. */
export function coerceFieldDraft(field: DataField, draft: string, currentValue: unknown): unknown {
  if (isJsonValue(field, currentValue)) {
    return JSON.parse(draft);
  }
  if (isNumericField(field)) {
    const next = Number(draft);
    if (!Number.isFinite(next)) throw new Error('Enter a valid number.');
    return next;
  }
  if (/^(bool|boolean)$/i.test(field.dataType ?? '')) {
    const lower = draft.trim().toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    throw new Error('Enter true or false.');
  }
  return draft;
}
