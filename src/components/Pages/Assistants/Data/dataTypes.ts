import type { DataBrowserMode } from '@/lib/assistants/dataBrowser';
import { isStateManagerMode } from '@/lib/assistants/dataBrowser';
import type { LogCellEditorDescriptor } from '@/components/Common/LogGrid/editorTypes';

/** Orchestra data types offered when creating a Data-sheet column. */
export const DATA_COLUMN_TYPE_OPTIONS = [
  { value: 'str', label: 'Text (str)' },
  { value: 'int', label: 'Integer (int)' },
  { value: 'float', label: 'Number (float)' },
  { value: 'bool', label: 'Boolean (bool)' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'list', label: 'List' },
  { value: 'dict', label: 'Dict' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
  { value: 'vector', label: 'Vector' },
  { value: 'Any', label: 'Any (untyped)' },
] as const;

export type DataColumnType = (typeof DATA_COLUMN_TYPE_OPTIONS)[number]['value'];

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

/** Editor control selection for a field's declared Orchestra type and constraints. */
export function editorDescriptorForDataField(
  field: DataField,
  value: unknown
): LogCellEditorDescriptor {
  if (field.restrict === true && (field.enumValues?.length ?? 0) > 0) {
    return { kind: 'select', options: field.enumValues!, commitOnChange: true };
  }
  if (/^(bool|boolean)$/i.test(field.dataType ?? '')) {
    return { kind: 'switch', commitOnChange: true };
  }
  if (isJsonValue(field, value)) return { kind: 'textarea' };

  const type = field.dataType?.toLowerCase();
  if (isNumericField(field)) return { kind: 'text', inputType: 'number' };
  if (type === 'date') return { kind: 'text', inputType: 'date' };
  if (type === 'time') return { kind: 'text', inputType: 'time' };
  if (type === 'datetime' || type === 'date-time') {
    return { kind: 'text', inputType: 'datetime-local' };
  }
  return { kind: 'text', inputType: 'text' };
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
  if (field.restrict === true && (field.enumValues?.length ?? 0) > 0) {
    if (!field.enumValues!.includes(draft)) {
      throw new Error('Choose one of the allowed values.');
    }
  }
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
