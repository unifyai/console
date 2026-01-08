export type UnifyPrompt = Array<UnifyMessage>;

export type UnifyMessage =
  | UnifySystemMessage
  | UnifyUserMessage
  | UnifyAssistantMessage
  | UnifyToolMessage;

export interface UnifySystemMessage {
  role: 'system';
  content: string;
}

export interface UnifyUserMessage {
  role: 'user';
  content: Array<UnifyUserMessageContent>;
}

export type UnifyUserMessageContent =
  | UnifyUserMessageTextContent
  | UnifyUserMessageImageContent;

export interface UnifyUserMessageImageContent {
  type: 'imageUrl';
  imageUrl: string;
}

export interface UnifyUserMessageTextContent {
  type: 'text';
  text: string;
}

export interface UnifyAssistantMessage {
  role: 'assistant';
  content: string;
  prefix?: boolean;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface UnifyToolMessage {
  role: 'tool';
  name: string;
  content: string;
  toolCallId: string;
}