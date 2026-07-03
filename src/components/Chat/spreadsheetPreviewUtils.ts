/** Maximum bytes to decode for delimited spreadsheet preview (matches text preview cap). */
export const SPREADSHEET_PREVIEW_MAX_BYTES = 1024 * 1024;

export interface SpreadsheetPreviewSheet {
  name: string;
  html: string;
}

export type DelimitedSpreadsheetExtension = 'csv' | 'tsv';

export function getSpreadsheetExtension(filename: string): string | undefined {
  return filename.split('.').pop()?.toLowerCase();
}

export function isDelimitedSpreadsheetExtension(
  ext: string | undefined
): ext is DelimitedSpreadsheetExtension {
  return ext === 'csv' || ext === 'tsv';
}

export function spreadsheetSheetNameFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return filename;
  return filename.slice(0, dot);
}

/**
 * Parse delimiter-separated text into rows, supporting quoted fields and escaped quotes.
 */
export function parseDelimitedText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\r' && next === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (char === '\n' || char === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Build spreadsheet table HTML matching the ExcelJS worksheet preview shape. */
export function rowsToSpreadsheetHtml(rows: string[][]): string {
  const body = rows
    .map((cells) => {
      const tds = cells.map((value) => `<td>${value != null ? String(value) : ''}</td>`).join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');
  return `<table>${body}</table>`;
}

export function delimitedSpreadsheetPreview(
  arrayBuffer: ArrayBuffer,
  filename: string,
  maxBytes: number = SPREADSHEET_PREVIEW_MAX_BYTES
): { sheets: SpreadsheetPreviewSheet[] } | { error: string } {
  if (arrayBuffer.byteLength > maxBytes) {
    return { error: 'File too large to preview as spreadsheet' };
  }

  const ext = getSpreadsheetExtension(filename);
  if (!isDelimitedSpreadsheetExtension(ext)) {
    return { error: 'Unsupported delimited spreadsheet format' };
  }

  const text = new TextDecoder().decode(arrayBuffer);
  const delimiter = ext === 'tsv' ? '\t' : ',';
  const rows = parseDelimitedText(text, delimiter);
  const name = spreadsheetSheetNameFromFilename(filename);

  return {
    sheets: [{ name, html: rowsToSpreadsheetHtml(rows) }],
  };
}
