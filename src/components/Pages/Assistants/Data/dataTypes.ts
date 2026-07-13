export interface DataField {
  dataType?: string;
  fieldType?: string;
  mutable?: boolean;
  enumValues?: string[] | null;
  restrict?: boolean;
}

export interface DataRow {
  logId: number;
  entries: Record<string, unknown>;
}
