export type LogCellEditorKind = 'text' | 'textarea' | 'select' | 'switch';

export interface LogCellEditorDescriptor {
  kind: LogCellEditorKind;
  inputType?: 'text' | 'number' | 'date' | 'time' | 'datetime-local';
  options?: string[];
  /** Selects and switches commit as soon as a value is chosen. */
  commitOnChange?: boolean;
}

export type ResolveLogCellEditor = (
  columnId: string,
  value: unknown
) => LogCellEditorDescriptor | undefined;
