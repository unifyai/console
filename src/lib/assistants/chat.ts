'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { getCurrentUser } from '@/lib/user/user';
import {
  Attachment,
  ChatCompletionMessage,
  ChatCompletionRequest,
  ChatMessage,
  UnifyMessage,
  AttachmentUploadResponse,
  UnifyMessageReaction,
} from '@/types/assistants/chat';
import { ResponseProps } from '@/types/common';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';
import { camelToSnakeObject } from '@/utils/casing';
import type { Assistant } from '@/types/assistants/assistant';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';
import { mapOrgChatReactions } from '@/utils/assistants/chat-reactions';
import { rootContext } from '@/lib/assistants/scope';

/** Message payload with optional attachments */
export interface UnifyMessageWithAttachments extends UnifyMessage {
  attachments?: Attachment[];
}

/**
 * Looks up a user's contactId from the Contacts table using their email address.
 * Returns null if no contact record is found (user cannot chat with this assistant).
 *
 * Contact ids are resolved from assistant-scoped relationship overlays.
 */
export async function getContactIdByEmail(
  userEmail: string,
  assistant: Assistant
): Promise<number | null> {
  const apiKey = await requireUserApiKey();
  try {
    const project = 'Assistants';
    const filterExpr = `email_address == "${userEmail}"`;
    const context = rootContext(
      { kind: 'personal' },
      assistant.userId,
      assistant.agentId,
      'Contacts'
    );
    const url = `${getInternalApiBaseUrl()}/api/logs?projectName=${project}&context=${context}&filterExpr=${encodeURIComponent(filterExpr)}&limit=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      console.error(
        `[getContactIdByEmail] Error response: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();
    const logsResponse = data as LogsResponseProps;
    const logs = logsResponse.logs as LogProps[];

    if (logs.length === 0) {
      console.warn(`[getContactIdByEmail] No contact found for email '${userEmail}'`);
      return null;
    }

    const contactId = logs[0].entries?.contactId;
    if (typeof contactId !== 'number') {
      console.warn(`[getContactIdByEmail] Invalid contact_id in log entry:`, logs[0]);
      return null;
    }

    return contactId;
  } catch (error) {
    console.error(`[getContactIdByEmail] Error looking up contact:`, error);
    return null;
  }
}
function mapStoreMessageEntry(raw: Record<string, unknown>): ChatMessage | null {
  const messageId = Number(raw.id);
  if (!Number.isFinite(messageId)) return null;
  const content = typeof raw.content === 'string' ? raw.content : '';
  const senderKind = (raw.sender_kind ?? raw.senderKind) as string | undefined;
  const timestampRaw = (raw.timestamp ?? raw.created_at) as string | undefined;
  const timestamp = timestampRaw ? new Date(timestampRaw) : new Date();
  if (isNaN(timestamp.getTime())) return null;
  const rawAttachments = raw.attachments;
  return {
    id: String(messageId),
    role: senderKind === 'assistant' ? 'assistant' : 'user',
    content,
    timestamp,
    messageId,
    attachments: Array.isArray(rawAttachments)
      ? (rawAttachments as Record<string, unknown>[]).map(
          (a): Attachment => ({
            id: (a.id as string) || String(messageId),
            filename: (a.filename as string) || 'attachment',
            gsUrl: (a.gs_url ?? a.gsUrl) as string | undefined,
            contentType: (a.content_type ?? a.contentType) as string | undefined,
            sizeBytes: (a.size_bytes ?? a.sizeBytes) as number | undefined,
          })
        )
      : [],
    reactions: mapOrgChatReactions(raw.reactions),
  };
}

/**
 * Resolve (get-or-create) the caller's assistant-DM thread in the unified
 * chat store. Returns the thread id, or an error payload.
 */
export async function resolveAssistantThread(
  assistant: Assistant
): Promise<{ threadId: number } | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/chat/threads/resolve`, {
      method: 'POST',
      headers: { apiKey: apiKey, 'Content-Type': 'application/json' },
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      body: JSON.stringify({ kind: 'assistant_dm', assistant_id: parseInt(assistant.agentId, 10) }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { detail: data?.detail || `Failed to resolve chat thread (${response.status})` };
    }
    const threadId = Number(data?.thread_id);
    if (!Number.isFinite(threadId)) {
      return { detail: 'Chat thread resolution returned no thread id.' };
    }
    return { threadId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error resolving thread.';
    return { detail: message };
  }
}

/**
 * Fetches the user's 1-on-1 chat history with an assistant from the unified
 * chat store (most recent first).
 *
 * @param contactId - Retained for call-panel identity; not used for history.
 * @param before - Optional pagination cursor: fetch messages older than
 *   `beforeId` (a unified chat-store message id).
 */
export async function getTranscripts(
  contactId: number,
  assistant: Assistant,
  before?: { beforeId?: number }
): Promise<ChatMessage[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const thread = await resolveAssistantThread(assistant);
    if ('detail' in thread) return thread;

    const params = new URLSearchParams({
      limit: String(ASSISTANT_CHAT_LOADED_MESSAGES_COUNT),
    });
    if (before?.beforeId) params.set('before_id', String(before.beforeId));
    const url = `${getInternalApiBaseUrl()}/api/chat/threads/${thread.threadId}/messages?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { apiKey: apiKey },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { detail: data?.detail || `Failed to get chat history (${response.status})` };
    }
    const rawMessages = Array.isArray(data?.messages) ? data.messages : [];
    return rawMessages
      .map((raw: Record<string, unknown>) => mapStoreMessageEntry(raw))
      .filter((message: ChatMessage | null): message is ChatMessage => message !== null)
      .reverse();
  } catch (error) {
    console.error(
      `[getTranscripts] CATCH block error for assistant '${assistant.agentId}':`,
      error
    );
    const message = error instanceof Error ? error.message : 'Unknown error getting history.';
    return { detail: message };
  }
}
export async function messageAssistant(
  payload: UnifyMessageWithAttachments
): Promise<ResponseProps & { info?: string }> {
  const apiKey = await requireUserApiKey();
  try {
    // Convert camelCase payload to snake_case for API
    const snakeCasePayload = camelToSnakeObject(payload);

    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/message`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCasePayload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to send message: ${response.statusText}` };
    }
    return data as ResponseProps & { info?: string };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error sending message.';
    return { detail: message };
  }
}

export async function reactToMessage(
  payload: UnifyMessageReaction
): Promise<ResponseProps & { info?: string }> {
  const apiKey = await requireUserApiKey();
  try {
    const snakeCasePayload = camelToSnakeObject(payload);
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/message/reaction`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCasePayload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to react to message: ${response.statusText}` };
    }
    return data as ResponseProps & { info?: string };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error reacting to message.';
    return { detail: message };
  }
}

/**
 * Upload an attachment for a Unify message.
 * Returns metadata including gs_url for transcript logging.
 *
 * @param assistantId - The assistant ID to associate with the upload
 * @param file - The File to upload
 * @returns Upload response with gs_url, content_type, size_bytes
 */
export async function uploadAttachment(
  assistantId: string,
  file: File
): Promise<AttachmentUploadResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    // Create FormData with the file and assistant_id
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assistant_id', assistantId);

    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/attachment`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
        // Don't set Content-Type - fetch will set it with boundary for FormData
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to upload: ${response.statusText}` };
    }
    // API returns snake_case, convert to camelCase
    return {
      id: data.id,
      filename: data.filename,
      gsUrl: data.gs_url,
      signedUrl: data.signed_url,
      contentType: data.content_type,
      sizeBytes: data.size_bytes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error uploading attachment.';
    return { detail: message };
  }
}
/**
 * Generate a signed URL from a gs:// URL.
 * Used for displaying historical attachments from transcripts.
 *
 * @param gsUrl - GCS URL (gs://bucket/path)
 * @returns Signed HTTPS URL for browser access
 */
export async function getSignedUrl(gsUrl: string): Promise<{ signedUrl: string } | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/storage/signed-url`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      body: JSON.stringify({ gs_url: gsUrl }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { detail: data.detail || `Failed to get signed URL: ${response.statusText}` };
    }
    // API returns snake_case, convert to camelCase
    return { signedUrl: data.signed_url };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error getting signed URL.';
    return { detail: message };
  }
}
/**
 * Fetches a user's first and last name by their user ID.
 * Used as a fallback when assistant.userFirstName/userLastName are missing.
 *
 * @param userId - The user ID to look up
 * @returns Object with firstName and lastName, or null if lookup fails
 */
export async function getAssistantOwnerById(
  userId: string
): Promise<{ firstName: string; lastName: string } | null> {
  try {
    // Import here to avoid circular dependencies
    const { getUserByID } = await import('@/lib/user/user');
    const user = await getUserByID(userId);

    if (!user || !user.name) {
      console.warn(`[getAssistantOwnerById] User not found or missing name for ID: ${userId}`);
      return null;
    }

    return {
      firstName: user.name,
      lastName: user.lastName || '',
    };
  } catch (error) {
    console.error(`[getAssistantOwnerById] Error fetching user:`, error);
    return null;
  }
}
