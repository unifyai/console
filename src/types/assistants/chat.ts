export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  message_id?: number | string;
}

export type ChatRole = "user" | "system" | "assistant";

export interface ChatCompletionMessage {
    role: ChatRole;
    content: string;
}

export interface OutboundMessagePayload {
  thread: string,
  id: string,
  publishTime: string,
  event: ChatCompletionMessage
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
  max_tokens?: number | null;
  temperature?: number | null;
  stop?: string | string[] | null;
}

export interface UnifyMessage {
    assistant_id: number;
    contact_id: number;
    message: string;
}
