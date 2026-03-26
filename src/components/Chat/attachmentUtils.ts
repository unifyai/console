import { v4 as uuidv4 } from 'uuid';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  FileCode,
  FileArchive,
  FileAudio,
  FileVideo,
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
  // Images (raster)
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.heic',
  '.heif',
  '.tiff',
  '.tif',
  '.avif',
  '.jfif',
  '.raw',
  '.cr2',
  '.nef',
  '.arw',
  '.dng',
  // Images (vector)
  '.svg',
  '.eps',
  // Video
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.wmv',
  '.flv',
  '.m4v',
  '.mpg',
  '.mpeg',
  '.3gp',
  '.ogv',
  '.ts',
  '.mts',
  '.vob',
  // Audio
  '.mp3',
  '.wav',
  '.aac',
  '.ogg',
  '.flac',
  '.wma',
  '.m4a',
  '.aiff',
  '.aif',
  '.opus',
  '.mid',
  '.midi',
  '.amr',
  '.ape',
  '.wv',
  // Adobe
  '.psd',
  '.ai',
  '.indd',
  '.idml',
  '.xd',
  '.fla',
  '.swf',
  '.prproj',
  '.aep',
  '.ppj',
  '.sesx',
  '.drp',
  // Other design/multimedia
  '.sketch',
  '.fig',
  '.blend',
  '.fbx',
  '.obj',
  '.stl',
  '.gltf',
  '.glb',
  '.usdz',
  '.3ds',
  '.dae',
  '.lottie',
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.rtf',
  '.odt',
  '.pages',
  '.epub',
  '.mobi',
  // Spreadsheets
  '.xls',
  '.xlsx',
  '.csv',
  '.ods',
  '.numbers',
  '.tsv',
  // Presentations
  '.ppt',
  '.pptx',
  '.odp',
  '.key',
  // Archives
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.7z',
  '.rar',
  '.tgz',
  // Data
  '.json',
  '.jsonl',
  '.xml',
  '.yaml',
  '.yml',
  '.toml',
  '.parquet',
  '.avro',
  '.ndjson',
  // Web
  '.html',
  '.htm',
  '.css',
  '.wasm',
  // Code
  '.py',
  '.md',
  '.markdown',
  '.rst',
  '.tex',
  '.log',
  '.sql',
  // Fonts
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  // Subtitles / captions
  '.srt',
  '.vtt',
  '.ass',
  '.sub',
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

// eslint-disable-next-line @typescript-eslint/naming-convention
const FILE_TYPE_MAP: Record<string, AttachmentType> = {
  // Documents
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  odt: 'word',
  rtf: 'text',
  pages: 'word',
  epub: 'text',
  mobi: 'text',

  // Spreadsheets
  xls: 'excel',
  xlsx: 'excel',
  csv: 'excel',
  ods: 'excel',
  numbers: 'excel',
  tsv: 'excel',

  // Presentations
  ppt: 'powerpoint',
  pptx: 'powerpoint',
  odp: 'powerpoint',
  key: 'powerpoint',

  // Images (raster)
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  ico: 'image',
  heic: 'image',
  heif: 'image',
  tiff: 'image',
  tif: 'image',
  avif: 'image',
  jfif: 'image',
  raw: 'image',
  cr2: 'image',
  nef: 'image',
  arw: 'image',
  dng: 'image',

  // Images (vector) / Design
  svg: 'image',
  eps: 'image',
  psd: 'image',
  ai: 'image',
  sketch: 'image',
  fig: 'image',
  xd: 'image',
  indd: 'image',
  idml: 'image',

  // Video
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  webm: 'video',
  wmv: 'video',
  flv: 'video',
  m4v: 'video',
  mpg: 'video',
  mpeg: 'video',
  ['3gp']: 'video',
  ogv: 'video',
  mts: 'video',
  vob: 'video',

  // Audio
  mp3: 'audio',
  wav: 'audio',
  aac: 'audio',
  ogg: 'audio',
  flac: 'audio',
  wma: 'audio',
  m4a: 'audio',
  aiff: 'audio',
  aif: 'audio',
  opus: 'audio',
  mid: 'audio',
  midi: 'audio',
  amr: 'audio',
  ape: 'audio',
  wv: 'audio',
  sesx: 'audio',

  // Adobe project files
  fla: 'video',
  swf: 'video',
  prproj: 'video',
  aep: 'video',
  ppj: 'video',
  drp: 'video',

  // 3D / Design
  blend: 'image',
  fbx: 'image',
  obj: 'image',
  stl: 'image',
  gltf: 'image',
  glb: 'image',
  usdz: 'image',
  ['3ds']: 'image',
  dae: 'image',
  lottie: 'image',

  // Text/Config
  txt: 'text',
  md: 'text',
  markdown: 'text',
  rst: 'text',
  tex: 'text',
  log: 'text',
  yaml: 'text',
  yml: 'text',
  toml: 'text',
  env: 'text',
  srt: 'text',
  vtt: 'text',
  ass: 'text',
  sub: 'text',

  // Code
  json: 'code',
  jsonl: 'code',
  ndjson: 'code',
  js: 'code',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  py: 'code',
  html: 'code',
  htm: 'code',
  css: 'code',
  xml: 'code',
  sql: 'code',
  sh: 'code',
  bat: 'code',
  ps1: 'code',
  wasm: 'code',

  // Archives
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  bz2: 'archive',
  xz: 'archive',
  rar: 'archive',
  tgz: 'archive',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '7z': 'archive',

  // Data
  parquet: 'code',
  avro: 'code',

  // Fonts
  ttf: 'generic',
  otf: 'generic',
  woff: 'generic',
  woff2: 'generic',
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
  pdf: { icon: FileText, color: 'var(--file-pdf)' },
  word: { icon: FileText, color: 'var(--file-word)' },
  excel: { icon: FileSpreadsheet, color: 'var(--file-excel)' },
  powerpoint: { icon: Presentation, color: 'var(--file-powerpoint)' },
  image: { icon: Image, color: 'var(--file-image)' },
  audio: { icon: FileAudio, color: 'var(--file-audio, var(--file-image))' },
  video: { icon: FileVideo, color: 'var(--file-video, var(--file-image))' },
  text: { icon: FileText, color: 'var(--file-text)' },
  code: { icon: FileCode, color: 'var(--file-code)' },
  archive: { icon: FileArchive, color: 'var(--file-archive)' },
  generic: { icon: File, color: 'var(--file-generic)' },
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
  assistantId: string,
  deployEnv?: string | null
): Promise<AttachmentUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('assistant_id', assistantId);
  if (deployEnv) {
    formData.append('deploy_env', deployEnv);
  }

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
  callbacks: BatchUploadCallbacks,
  deployEnv?: string | null
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
      const result = await uploadAttachment(attachment.file!, assistantId, deployEnv);
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
