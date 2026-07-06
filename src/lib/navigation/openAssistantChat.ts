export const OPEN_ASSISTANT_CHAT_EVENT = 'console:open-assistant-chat';

export type OpenAssistantChatDetail = {
  assistantId: string;
};

export function dispatchOpenAssistantChat(assistantId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OpenAssistantChatDetail>(OPEN_ASSISTANT_CHAT_EVENT, {
      detail: { assistantId },
    })
  );
}

export function assistantChatHref(assistantId: string): string {
  return `/assistants?profile=${encodeURIComponent(assistantId)}`;
}
