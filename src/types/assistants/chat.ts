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

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: AttachmentType;
  file?: File;
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
}
