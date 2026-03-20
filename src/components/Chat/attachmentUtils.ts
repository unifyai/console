import { v4 as uuidv4 } from 'uuid';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  FileCode,
  FileArchive,
  File,
  type LucideIcon,
} from 'lucide-react';
import type { AttachmentType, Attachment, AttachmentUploadResponse } from '@/types/assistants/chat';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum file size in bytes (32MB — matches Cloud Run request limit) */
export const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024;

/** Allowed file extensions for upload */
export const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.heic',
  '.heif',
  '.tiff',
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.rtf',
  '.odt',
  // Spreadsheets
  '.xls',
  '.xlsx',
  '.csv',
  '.ods',
  // Presentations
  '.ppt',
  '.pptx',
  '.odp',
  // Archives
  '.zip',
  // Data
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  // Web
  '.html',
  '.htm',
  // Code
  '.py',
]);

/** Blocked file extensions (security risk) */
export const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.dll',
  '.so',
  '.dylib',
  '.app',
  '.msi',
  '.com',
  '.scr',
  '.vbs',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.psc1',
  '.reg',
  '.inf',
  '.lnk',
  '.pif',
]);

// =============================================================================
// FILE TYPE DETECTION
// =============================================================================

const FILE_TYPE_MAP: Record<string, AttachmentType> = {
  // Documents
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  xls: 'excel',
  xlsx: 'excel',
  csv: 'excel',
  ppt: 'powerpoint',
  pptx: 'powerpoint',
  rtf: 'text',

  // Images
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  ico: 'image',
  heic: 'image',
  heif: 'image',
  tiff: 'image',

  // Text/Config
  txt: 'text',
  md: 'text',
  yaml: 'text',
  yml: 'text',
  toml: 'text',
  env: 'text',

  // Code
  json: 'code',
  js: 'code',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  py: 'code',
  html: 'code',
  css: 'code',
  xml: 'code',
  sql: 'code',
  sh: 'code',
  bat: 'code',
  ps1: 'code',

  // Archives
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  rar: 'archive',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '7z': 'archive',
};

/**
 * Get attachment type from filename extension.
 */
export function getAttachmentType(filename: string): AttachmentType {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'generic';
  return FILE_TYPE_MAP[ext] || 'generic';
}

// =============================================================================
// ICON & COLOR MAPPING
// =============================================================================

interface AttachmentConfig {
  icon: LucideIcon;
  color: string;
}

const ATTACHMENT_CONFIG: Record<AttachmentType, AttachmentConfig> = {
  pdf: { icon: FileText, color: 'var(--file-pdf)' }, // Red
  word: { icon: FileText, color: 'var(--file-word)' }, // Blue
  excel: { icon: FileSpreadsheet, color: 'var(--file-excel)' }, // Green
  powerpoint: { icon: Presentation, color: 'var(--file-powerpoint)' }, // Orange
  image: { icon: Image, color: 'var(--file-image)' }, // Purple
  text: { icon: FileText, color: 'var(--file-text)' }, // Blue-gray
  code: { icon: FileCode, color: 'var(--file-code)' }, // Blue-gray
  archive: { icon: FileArchive, color: 'var(--file-archive)' }, // Amber
  generic: { icon: File, color: 'var(--file-generic)' }, // Gray
};

/**
 * Get lucide icon component for attachment type.
 */
export function getAttachmentIcon(type: AttachmentType): LucideIcon {
  return ATTACHMENT_CONFIG[type].icon;
}

/**
 * Get CSS color variable for attachment type.
 */
export function getAttachmentColor(type: AttachmentType): string {
  return ATTACHMENT_CONFIG[type].color;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Get file extension from filename (lowercase, with dot).
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Validate file type against allowlist and blocklist.
 */
export function validateFileType(filename: string): { valid: boolean; error?: string } {
  const ext = getFileExtension(filename);

  if (!ext) {
    return { valid: false, error: 'File must have an extension' };
  }

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type ${ext} is not allowed for security reasons` };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type ${ext} is not allowed` };
  }

  return { valid: true };
}

/**
 * Validate a file for upload (type + size).
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const typeCheck = validateFileType(file.name);
  if (!typeCheck.valid) return typeCheck;

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const limitMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `${file.name} is too large (${sizeMB} MB). Maximum size is ${limitMB} MB.`,
    };
  }

  return { valid: true };
}

/**
 * Check whether a file/attachment exceeds the upload size limit.
 */
export function isOversized(sizeBytes: number | undefined): boolean {
  return typeof sizeBytes === 'number' && sizeBytes > MAX_FILE_SIZE_BYTES;
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format file size in bytes to human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Truncate filename while preserving extension.
 */
export function truncateFilename(name: string, maxLength = 20): string {
  if (name.length <= maxLength) return name;

  const parts = name.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  const basename = parts.join('.');

  const availableLength = maxLength - (ext ? ext.length + 1 : 0) - 3; // -3 for ellipsis

  if (availableLength <= 0) {
    return ext ? `...${ext}` : '...';
  }

  const truncated = basename.slice(0, availableLength);
  return ext ? `${truncated}...${ext}` : `${truncated}...`;
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create Attachment from File object.
 */
export function createAttachment(file: File): Attachment {
  return {
    id: uuidv4(),
    filename: file.name,
    sizeBytes: file.size,
    file,
  };
}

// =============================================================================
// UPLOAD & MESSAGE FUNCTIONS
// =============================================================================

/**
 * Upload an attachment to GCS via the API.
 * Returns full metadata including gsUrl for transcript logging.
 *
 * @param file - The file to upload
 * @param assistantId - The assistant ID to associate with the upload
 * @returns Upload response with gsUrl, contentType, sizeBytes
 */
export async function uploadAttachment(
  file: File,
  assistantId: string
): Promise<AttachmentUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('assistant_id', assistantId);

  let response: Response;
  try {
    response = await fetch('/api/assistant/attachment', {
      method: 'POST',
      body: formData,
    });
  } catch {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Upload failed — the file may be too large (${sizeMB} MB). Try a file under ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB.`
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || `Upload failed: ${response.statusText}`);
  }

  // API returns snake_case, convert to camelCase
  const data = await response.json();
  return {
    id: data.id,
    filename: data.filename,
    gsUrl: data.gs_url,
    signedUrl: data.signed_url,
    contentType: data.content_type,
    sizeBytes: data.size_bytes,
  };
}

const UPLOAD_CONCURRENCY = 6;

export interface BatchUploadCallbacks {
  onStatusChange: (id: string, status: Attachment['uploadStatus']) => void;
  onUploaded: (id: string, result: AttachmentUploadResponse) => void;
}

export interface BatchUploadHandle {
  promise: Promise<Attachment[]>;
  cancel: () => void;
}

/**
 * Upload a batch of attachments with bounded concurrency.
 * Calls back per-file so the UI can update chips in real time.
 * Returns a handle with the result promise and a cancel function.
 */
export function uploadAttachmentBatch(
  attachments: Attachment[],
  assistantId: string,
  callbacks: BatchUploadCallbacks
): BatchUploadHandle {
  const toUpload = attachments.filter((a) => a.file);
  const succeeded: Attachment[] = [];
  let cancelled = false;

  for (const a of toUpload) {
    callbacks.onStatusChange(a.id, 'queued');
  }

  let cursor = 0;

  async function runNext(): Promise<void> {
    const idx = cursor++;
    if (idx >= toUpload.length || cancelled) return;

    const attachment = toUpload[idx];
    callbacks.onStatusChange(attachment.id, 'uploading');

    try {
      const result = await uploadAttachment(attachment.file!, assistantId);
      if (cancelled) return;
      callbacks.onStatusChange(attachment.id, 'done');
      callbacks.onUploaded(attachment.id, result);
      succeeded.push({
        id: result.id,
        filename: result.filename,
        gsUrl: result.gsUrl,
        contentType: result.contentType,
        sizeBytes: result.sizeBytes,
      });
    } catch {
      if (cancelled) return;
      callbacks.onStatusChange(attachment.id, 'error');
    }

    if (!cancelled) return runNext();
  }

  const promise = (async () => {
    const workers = Array.from(
      { length: Math.min(UPLOAD_CONCURRENCY, toUpload.length) },
      () => runNext()
    );
    await Promise.all(workers);
    return succeeded;
  })();

  return {
    promise,
    cancel: () => { cancelled = true; },
  };
}

/**
 * Create an Attachment from an upload response, stripping the signedUrl
 * (only gsUrl is persisted in transcripts).
 */
export function createMessageAttachment(uploadResponse: AttachmentUploadResponse): Attachment {
  return {
    id: uploadResponse.id,
    filename: uploadResponse.filename,
    gsUrl: uploadResponse.gsUrl,
    contentType: uploadResponse.contentType,
    sizeBytes: uploadResponse.sizeBytes,
  };
}

/**
 * Merge upload metadata into an existing attachment.
 */
export function updateAttachmentWithMetadata(
  attachment: Attachment,
  uploadResponse: AttachmentUploadResponse
): Attachment {
  return {
    ...attachment,
    gsUrl: uploadResponse.gsUrl,
    contentType: uploadResponse.contentType,
    sizeBytes: uploadResponse.sizeBytes,
  };
}

/**
 * Generate a signed URL from a gs:// URL for display.
 * Used when loading historical attachments from transcripts.
 *
 * @param gsUrl - GCS URL (gs://bucket/path)
 * @param download - If true, URL will force download with Content-Disposition: attachment
 * @param filename - Override filename in Content-Disposition header (only used when download=true)
 * @returns Signed HTTPS URL for browser access
 */
export async function getSignedUrl(
  gsUrl: string,
  download: boolean = false,
  filename?: string
): Promise<string> {
  const response = await fetch('/api/storage/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
    body: JSON.stringify({ gs_url: gsUrl, download, filename }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get signed URL' }));
    throw new Error(error.detail || `Failed to get signed URL: ${response.statusText}`);
  }

  const data = await response.json();
  // API returns snake_case
  return data.signed_url;
}

/**
 * Fetch raw file content from GCS via server-side proxy.
 * Avoids CORS issues that arise when fetching signed URLs directly.
 */
export async function fetchGcsContent(gsUrl: string): Promise<ArrayBuffer> {
  const response = await fetch('/api/storage/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
    body: JSON.stringify({ gs_url: gsUrl }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch content' }));
    throw new Error(error.detail || `Failed to fetch content: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * Check whether an attachment is an HTML file by extension.
 */
export function isHtmlAttachment(attachment: Attachment): boolean {
  const ext = attachment.filename.split('.').pop()?.toLowerCase();
  return ext === 'html' || ext === 'htm';
}
