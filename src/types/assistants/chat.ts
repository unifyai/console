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

export interface MessageReaction {
  /** Assistant 1:1 chat reactor (contact id in the assistant's Contacts). */
  contactId?: number;
  /** Org chat reactor (human user id). */
  userId?: string;
  emoji: string;
  updatedAt?: Date;
}

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  messageId?: number;
  sourceContext?: string;
  /** Root-agnostic transcript identity key used for cross-root pagination dedupe. */
  mergeKey?: string;
  /** Pub/Sub ack ID for client-side acknowledgement after display */
  __ackId?: string;
  attachments?: Attachment[];
  reactions?: MessageReaction[];
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

export type BroadcastMessagePayload =
  | {
      type: 'NEW_MESSAGE';
      message: ChatMessage;
    }
  | {
      type: 'REACTION_UPDATE';
      targetMessageId: number;
      reactions: MessageReaction[];
    };

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
  maxTokens?: number | null;
  temperature?: number | null;
  stop?: string | string[] | null;
}

export interface CallPill {
  id: string;
  type: 'call_pill';
  timestamp: Date;
  durationSeconds: number;
  /** Unified call-utterance store key (org call session id or room name). */
  callId?: string;
  recordingUrl?: string;
}

/** Ephemeral onboarding/checklist trigger acknowledgement shown in chat. */
export interface RequestSentAck {
  id: string;
  type: 'request_sent_ack';
  timestamp: Date;
  /** Checklist row title or chip label the user triggered. */
  label: string;
}

export type TimelineItem = ChatMessage | CallPill | RequestSentAck;

export function isCallPill(item: TimelineItem): item is CallPill {
  return 'type' in item && item.type === 'call_pill';
}

export function isRequestSentAck(item: TimelineItem): item is RequestSentAck {
  return 'type' in item && item.type === 'request_sent_ack';
}

export interface CallTranscriptUtterance {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  callUtteranceTimestamp?: string;
}

// ---------------------------------------------------------------------------
// Chat search
// ---------------------------------------------------------------------------

export type ChatSearchMedium = 'all' | 'chat' | 'call';
export type ChatSearchSender = 'everyone' | 'assistant' | 'me';

export interface ChatSearchFilters {
  query: string;
  medium: ChatSearchMedium;
  sender: ChatSearchSender;
  attachmentType: AttachmentType | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface ChatSearchResult {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  messageId?: number;
  medium: string;
  /** Unified call-utterance store key for unify_meet results. */
  callId?: string;
  attachments?: Attachment[];
}

// ---------------------------------------------------------------------------
// Historical view (jump-to-message)
// ---------------------------------------------------------------------------

export interface HistoricalViewState {
  anchorMessageKey: string;
  anchorMessageId?: number;
  messages: ChatMessage[];
  callPills: CallPill[];
  hasOlder: boolean;
  hasNewer: boolean;
  isLoadingOlder: boolean;
  isLoadingNewer: boolean;
}

export interface UnifyMessage {
  assistantId: number;
  contactId: number;
  message: string;
  /** Attachments with full metadata for transcript logging */
  attachments?: Attachment[];
}

export interface UnifyMessageReaction {
  assistantId: number;
  contactId: number;
  targetMessageId: number;
  emoji: string | null;
}
