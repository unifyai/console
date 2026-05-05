'use server';

import { getCurrentUser } from '@/lib/user/user';
import {
  Attachment,
  ChatCompletionMessage,
  ChatCompletionRequest,
  ChatMessage,
  UnifyMessage,
  AttachmentUploadResponse,
} from '@/types/assistants/chat';
import { ResponseProps } from '@/types/common';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';
import { camelToSnakeObject } from '@/utils/casing';
import type { Assistant } from '@/types/assistants/assistant';
import { mergeRootRows } from '@/lib/client/read_across_roots';
import {
  contactScopedRootQueries,
  roleFromRootSenderId,
  rootContext,
  transcriptFilterForRoot,
} from '@/lib/assistants/scope';

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
export const getContactIdByEmail = async (apiKey: string) => {
  return async (userEmail: string, assistant: Assistant): Promise<number | null> => {
    'use server';
    try {
      const project = 'Assistants';
      const filterExpr = `email_address == "${userEmail}"`;
      const context = rootContext(
        { kind: 'personal' },
        assistant.userId,
        assistant.agentId,
        'Contacts'
      );
      const url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=${project}&context=${context}&filterExpr=${encodeURIComponent(filterExpr)}&limit=1`;

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
  };
};

/**
 * Fetches chat transcripts for a specific user's conversation with an assistant.
 *
 * @param contactId - The current user's contact_id (used for filtering)
 * @param ownerId - The owner's user ID (used in security filter)
 * @param assistantId - The assistant's ID (used in security filter)
 * @param before - Optional merged cursor for pagination
 *
 * Filter: Shows messages sent by the current user OR assistant responses to the current user.
 */
export const getTranscripts = async (apiKey: string) => {
  return async (
    contactId: number,
    assistant: Assistant,
    before?: { timestamp: string; excludedKeys?: string[] }
  ): Promise<ChatMessage[] | ResponseProps> => {
    'use server';
    try {
      const project = 'Assistants';
      const limit = ASSISTANT_CHAT_LOADED_MESSAGES_COUNT;
      const excludedKeys = new Set(before?.excludedKeys ?? []);
      const rootLimit = limit + excludedKeys.size;
      const queries = contactScopedRootQueries(assistant, contactId, 'Transcripts');
      const rootLogs = await Promise.all(
        queries.map(async (query) => {
          let filterExpr = transcriptFilterForRoot(query);
          if (before) {
            filterExpr += ` and timestamp <= "${before.timestamp}"`;
          }
          const sorting = encodeURIComponent(JSON.stringify({ timestamp: 'descending' }));
          const url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=${project}&context=${query.context}&limit=${rootLimit}&sorting=${sorting}&filterExpr=${encodeURIComponent(filterExpr)}`;

          const response = await fetch(url, {
            method: 'GET',
            headers: { apiKey: apiKey },
            cache: 'no-store',
          });

          if (response.status === 404) {
            return [];
          }
          if (!response.ok) {
            let errorDetail = `Failed to get chat history with status ${response.status}: ${response.statusText}`;
            try {
              const errorData = await response.json();
              errorDetail = errorData.detail || errorDetail;
            } catch (e) {
              const textError = await response.text();
              console.error('[getTranscripts] Non-JSON error response from /api/logs:', textError);
              errorDetail = textError || errorDetail;
            }
            throw new Error(errorDetail);
          }

          const data = await response.json();
          const logsResponse = data as LogsResponseProps;
          return (logsResponse.logs as LogProps[]).map((log) => ({ log, query }));
        })
      );
      const logs = mergeRootRows(rootLogs.flat(), {
        limit: rootLimit,
        sortValue: ({ log }) => log.entries?.timestamp,
        dedupeKey: ({ log, query }) => `${query.context}:${log.entries?.messageId ?? log.id}`,
      })
        .filter(
          ({ log, query }) =>
            !excludedKeys.has(`${query.context}:${log.entries?.messageId ?? log.id}`)
        )
        .slice(0, limit);

      const mappedMessages = logs
        .map(({ log, query }): ChatMessage | null => {
          const { entries, id } = log;
          if (
            !entries ||
            typeof entries.content !== 'string' ||
            typeof entries.senderId === 'undefined'
          ) {
            console.warn('[getTranscripts] Skipping invalid log entry:', log);
            return null;
          }
          const senderId = entries.senderId as number;
          return {
            id: String(id),
            role: roleFromRootSenderId(query, senderId),
            content: entries.content,
            timestamp: new Date(entries.timestamp as string),
            messageId: typeof entries.messageId === 'number' ? entries.messageId : undefined,
            sourceContext: query.context,
            attachments: Array.isArray(entries.attachments)
              ? (entries.attachments as Record<string, unknown>[]).map(
                  (a): Attachment => ({
                    id: (a.id as string) || String(id),
                    filename: (a.filename as string) || 'attachment',
                    gsUrl: a.gsUrl as string | undefined,
                    contentType: a.contentType as string | undefined,
                    sizeBytes: a.sizeBytes as number | undefined,
                  })
                )
              : [],
          };
        })
        .filter((msg): msg is ChatMessage => msg !== null);
      return mappedMessages;
    } catch (error) {
      console.error(
        `[getTranscripts] CATCH block error for assistant '${assistant.agentId}':`,
        error
      );
      const message = error instanceof Error ? error.message : 'Unknown error getting history.';
      return { detail: message };
    }
  };
};

export const messageAssistant = async (apiKey: string) => {
  return async (
    payload: UnifyMessageWithAttachments
  ): Promise<ResponseProps & { info?: string }> => {
    'use server';
    try {
      // Convert camelCase payload to snake_case for API
      const snakeCasePayload = camelToSnakeObject(payload);

      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/message`, {
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
  };
};

/**
 * Upload an attachment for a Unify message.
 * Returns metadata including gs_url for transcript logging.
 *
 * @param assistantId - The assistant ID to associate with the upload
 * @param file - The File to upload
 * @returns Upload response with gs_url, content_type, size_bytes
 */
export const uploadAttachment = async (apiKey: string) => {
  return async (
    assistantId: string,
    file: File,
    deployEnv?: string | null
  ): Promise<AttachmentUploadResponse | ResponseProps> => {
    'use server';
    try {
      // Create FormData with the file and assistant_id
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assistant_id', assistantId);
      if (deployEnv) {
        formData.append('deploy_env', deployEnv);
      }

      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/attachment`, {
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
      const message =
        error instanceof Error ? error.message : 'Unknown error uploading attachment.';
      return { detail: message };
    }
  };
};

/**
 * Generate a signed URL from a gs:// URL.
 * Used for displaying historical attachments from transcripts.
 *
 * @param gsUrl - GCS URL (gs://bucket/path)
 * @returns Signed HTTPS URL for browser access
 */
export const getSignedUrl = async (apiKey: string) => {
  return async (gsUrl: string): Promise<{ signedUrl: string } | ResponseProps> => {
    'use server';
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/storage/signed-url`, {
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
  };
};

/**
 * Fetches a user's first and last name by their user ID.
 * Used as a fallback when assistant.userFirstName/userLastName are missing.
 *
 * @param userId - The user ID to look up
 * @returns Object with firstName and lastName, or null if lookup fails
 */
export const getAssistantOwnerById = async () => {
  return async (userId: string): Promise<{ firstName: string; lastName: string } | null> => {
    'use server';
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
  };
};
