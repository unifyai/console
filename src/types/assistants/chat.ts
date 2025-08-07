export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type ChatRole = "user" | "system" | "assistant";

export interface ChatCompletionMessage {
    role: ChatRole;
    content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
  max_tokens?: number | null;
  temperature?: number | null;
  stop?: string | string[] | null;
}