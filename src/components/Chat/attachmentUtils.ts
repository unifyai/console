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
import type { AttachmentType, ChatAttachment } from '@/types/assistants/chat';

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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate file size.
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File exceeds 10MB limit',
    };
  }
  return { valid: true };
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
 * Create ChatAttachment from File object.
 */
export function createAttachment(file: File): ChatAttachment {
  return {
    id: uuidv4(),
    name: file.name,
    size: file.size,
    type: getAttachmentType(file.name),
    file,
  };
}
