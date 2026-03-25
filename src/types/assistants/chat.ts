export type AttachmentType =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'image'
  | 'audio'
  | 'video'
  | 'text'
  | 'code'
  | 'archive'
  | 'generic';

/**
 * Unified attachment type used across the entire lifecycle:
 * local file selection, upload, API messages, and transcript history.
 *
 * Storage fields (`gsUrl`, `contentType`, `sizeBytes`) are optional because
 * they're only populated after upload. `file` is only present during upload
 * (browser File objects can't be serialized).
 */
export type AttachmentUploadStatus = 'pending' | 'queued' | 'uploading' | 'done' | 'error';

export interface Attachment {
  id: string;
  filename: string;
  gsUrl?: string;
  contentType?: string;
  sizeBytes?: number;
  /** Browser File object, only present during upload */
  file?: File;
  uploadStatus?: AttachmentUploadStatus;
}

/**
 * Attachment metadata returned from upload API.
 * Note: API returns snake_case, converted to camelCase here.
 */
export interface AttachmentUploadResponse {
  id: string;
  filename: string;
  gsUrl: string;
  signedUrl: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Type guard to check if an attachment has upload metadata.
 */
export function isAttachmentMetadata(
  attachment: Attachment
): attachment is Attachment & { gsUrl: string; contentType: string; sizeBytes: number } {
  return !!attachment.gsUrl && !!attachment.contentType && typeof attachment.sizeBytes === 'number';
}

/**
 * Helper to create attachment with full metadata (for testing/mocking).
 */
export function createAttachmentWithMetadata(
  base: Omit<Attachment, 'gsUrl' | 'contentType' | 'sizeBytes'>,
  metadata: { gsUrl: string; contentType: string; sizeBytes: number }
): Attachment {
  return { ...base, ...metadata };
}

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  messageId?: number;
  /** Pub/Sub ack ID for client-side acknowledgement after display */
  __ackId?: string;
  attachments?: Attachment[];
}

export type ChatRole = 'user' | 'system' | 'assistant';

export interface ChatCompletionMessage {
  role: ChatRole;
  content: string;
}

export interface OutboundMessagePayload {
  thread: string;
  id: string;
  publishTime: string;
  event: ChatCompletionMessage;
}

export type BroadcastMessagePayload = {
  type: 'NEW_MESSAGE';
  message: ChatMessage;
};

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
  maxTokens?: number | null;
  temperature?: number | null;
  stop?: string | string[] | null;
}

export interface UnifyMessage {
  assistantId: number;
  contactId: number;
  message: string;
  /** Attachments with full metadata for transcript logging */
  attachments?: Attachment[];
  /** Deployment environment override — 'preview' routes to preview adapters */
  deployEnv?: string | null;
}
