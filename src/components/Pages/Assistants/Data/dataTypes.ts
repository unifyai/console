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
