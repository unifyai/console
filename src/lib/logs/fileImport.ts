/**
 * Parse CSV / JSONL / JSON / Excel uploads into row objects for Data-pane import.
 */

import Papa from 'papaparse';

export const DATA_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const DATA_IMPORT_EXTENSIONS = ['.csv', '.jsonl', '.json', '.xlsx'] as const;
export const DATA_IMPORT_PREVIEW_ROWS = 20;

export type ParsedImportData = {
  headers: string[];
  rows: Record<string, unknown>[];
  previewRows: Record<string, unknown>[];
};

function checkHeadersForDuplicates(headers: string[], label: string): void {
  const seen = new Set<string>();
  for (const h of headers) {
    if (seen.has(h)) {
      throw new Error(`Duplicate ${label}: "${h}".`);
    }
    seen.add(h);
  }
}

/** Extract top-level object keys from a JSON object literal string (Interfaces port). */
function extractTopLevelKeys(objectLiteral: string): string[] {
  let cleanedText = objectLiteral;
  let prevLength = 0;

  do {
    prevLength = cleanedText.length;
    cleanedText = cleanedText.replace(/\{[^{}]*\}/g, '{}');
  } while (cleanedText.length !== prevLength);

  do {
    prevLength = cleanedText.length;
    cleanedText = cleanedText.replace(/\[[^\[\]]*\]/g, '[]');
  } while (cleanedText.length !== prevLength);

  const keyPattern = /(?:^[^"]*\{|,)\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g;
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = keyPattern.exec(cleanedText)) !== null) {
    keys.push(match[1]!);
  }
  return keys;
}

function cellToValue(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'object' && value !== null && 'text' in value) {
    const text = (value as { text?: string }).text;
    return text ?? null;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  return String(value);
}

async function parseCsv(text: string): Promise<ParsedImportData> {
  let rawHeaders: string[] = [];
  let previewError: Error | null = null;

  Papa.parse(text, {
    preview: 1,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.data.length === 0 || !Array.isArray(results.data[0])) {
        previewError = new Error('Could not parse header row from CSV.');
      } else {
        rawHeaders = (results.data[0] as string[]).map((h) => String(h).trim());
        if (rawHeaders.every((h) => !h)) {
          previewError = new Error('CSV header row is empty or contains only delimiters.');
        }
      }
      if (results.errors.length && !previewError) {
        previewError = new Error(`Error parsing CSV header: ${results.errors[0]!.message}`);
      }
    },
  });

  if (previewError) throw previewError;
  if (!rawHeaders.length) throw new Error('CSV must have a header row.');
  checkHeadersForDuplicates(rawHeaders, 'column names in CSV header');

  const full = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (full.errors.length) {
    throw new Error(`CSV Parsing Error (Row ${full.errors[0]!.row}): ${full.errors[0]!.message}`);
  }
  if (!full.data.length) {
    throw new Error('CSV contains no data rows after the header.');
  }
  return {
    headers: rawHeaders,
    rows: full.data,
    previewRows: full.data.slice(0, DATA_IMPORT_PREVIEW_ROWS),
  };
}

function parseJsonl(text: string): ParsedImportData {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l);
  if (!lines.length) {
    throw new Error('JSONL file is empty or contains only empty lines.');
  }
  const rawKeys = extractTopLevelKeys(lines[0]!);
  checkHeadersForDuplicates(rawKeys, 'keys in the first JSONL object literal');
  const rows = lines.map((line, i) => {
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Error parsing JSONL on line ${i + 1}: ${msg}`);
    }
  });
  return {
    headers: rawKeys,
    rows,
    previewRows: rows.slice(0, DATA_IMPORT_PREVIEW_ROWS),
  };
}

function parseJson(text: string): ParsedImportData {
  const firstObjMatch = text.match(/^\s*\[\s*({[\s\S]*?})/);
  if (!firstObjMatch) {
    throw new Error('Could not locate the first object literal in JSON.');
  }
  const rawKeys = extractTopLevelKeys(firstObjMatch[1]!);
  checkHeadersForDuplicates(rawKeys, 'keys in the first JSON object literal');

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Error parsing JSON: ${msg}`);
  }
  if (!Array.isArray(parsedJson)) {
    throw new Error('JSON file must contain a top-level array.');
  }
  if (parsedJson.length === 0) {
    throw new Error('JSON array is empty.');
  }
  const rows = parsedJson.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item)
  );
  if (!rows.length) {
    throw new Error('JSON array contains no valid object items.');
  }
  return {
    headers: rawKeys,
    rows,
    previewRows: rows.slice(0, DATA_IMPORT_PREVIEW_ROWS),
  };
}

async function parseXlsx(file: File): Promise<ParsedImportData> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('Excel workbook has no sheets.');
  }

  const rows: Record<string, unknown>[] = [];
  let headers: string[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    if (rowNumber === 1) {
      headers = values.map((v, i) => {
        const text = cellToValue(v);
        const name = text == null || text === '' ? `column_${i + 1}` : String(text).trim();
        return name;
      });
      checkHeadersForDuplicates(headers, 'column names in Excel header');
      return;
    }
    if (!headers.length) return;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = cellToValue(values[i]);
    });
    rows.push(obj);
  });

  if (!headers.length) {
    throw new Error('Excel sheet must have a header row.');
  }
  if (!rows.length) {
    throw new Error('Excel sheet contains no data rows after the header.');
  }
  return {
    headers,
    rows,
    previewRows: rows.slice(0, DATA_IMPORT_PREVIEW_ROWS),
  };
}

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

export function isAllowedImportExtension(ext: string): boolean {
  return (DATA_IMPORT_EXTENSIONS as readonly string[]).includes(ext);
}

/** Parse an uploaded file into headers + rows. Throws on validation errors. */
export async function parseImportFile(file: File): Promise<ParsedImportData> {
  if (file.size > DATA_IMPORT_MAX_BYTES) {
    throw new Error(`File size exceeds the limit of ${DATA_IMPORT_MAX_BYTES / 1024 / 1024}MB.`);
  }
  const ext = extensionOf(file.name);
  if (!isAllowedImportExtension(ext)) {
    throw new Error(`Invalid file type. Please upload ${DATA_IMPORT_EXTENSIONS.join(', ')}.`);
  }

  if (ext === '.xlsx') {
    return parseXlsx(file);
  }

  const text = await file.text();
  if (!text.trim()) {
    throw new Error('File is empty or contains only whitespace.');
  }
  if (ext === '.csv') return parseCsv(text);
  if (ext === '.jsonl') return parseJsonl(text);
  if (ext === '.json') return parseJson(text);
  throw new Error('Unsupported file type.');
}
