export type AttachmentType =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'image'
  | 'text'
  | 'code'
  | 'archive'
  | 'generic';

/**
 * Local attachment representation (used in UI before upload).
 */
export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: AttachmentType;
  file?: File;
  /** GCS URL for permanent storage (populated after upload) */
  gsUrl?: string;
  /** MIME type (populated after upload) */
  contentType?: string;
  /** File size in bytes (populated after upload) */
  sizeBytes?: number;
}

/**
 * Attachment metadata returned from upload API.
 * Contains all fields needed for transcript logging.
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
 * Attachment format for sending in messages (uses gsUrl, not signedUrl).
 * This is what gets stored in transcripts.
 * Note: Converted to snake_case when sent to API.
 */
export interface MessageAttachment {
  id: string;
  filename: string;
  gsUrl: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Type guard to check if an attachment has upload metadata.
 */
export function isAttachmentMetadata(
  attachment: ChatAttachment
): attachment is ChatAttachment & { gsUrl: string; contentType: string; sizeBytes: number } {
  return !!attachment.gsUrl && !!attachment.contentType && typeof attachment.sizeBytes === 'number';
}

/**
 * Helper to create attachment with full metadata (for testing/mocking).
 */
export function createAttachmentWithMetadata(
  base: Omit<ChatAttachment, 'gsUrl' | 'contentType' | 'sizeBytes'>,
  metadata: { gsUrl: string; contentType: string; sizeBytes: number }
): ChatAttachment {
  return { ...base, ...metadata };
}

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  messageId?: number;
  __ackId?: string;
  attachments?: ChatAttachment[];
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
  attachments?: MessageAttachment[];
}
