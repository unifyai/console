"use server";

import { getCurrentUser } from "@/lib/user/user";
import { ChatCompletionMessage, ChatCompletionRequest, ChatMessage, UnifyMessage } from "@/types/assistants/chat";
import { ResponseProps } from "@/types/common";
import { LogProps, LogsResponseProps } from "@/types/interfaces/logs";
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from "@/constants/assistants/settings";

/**
 * Looks up a user's contact_id from the Contacts table using their email address.
 * Returns null if no contact record is found (user cannot chat with this assistant).
 * 
 * Contact ID Reference:
 * - 0 = Assistant (AI)
 * - 1 = Owner (creator of assistant)
 * - 2+ = Other users/contacts
 */
export const getContactIdByEmail = async (apiKey: string) => {
    return async (ownerContext: string, assistantContext: string, userEmail: string): Promise<number | null> => {
        "use server";
        try {
            const project = "Assistants";
            const context = `${ownerContext}/${assistantContext}/Contacts`;
            const filter_expr = `email_address == "${userEmail}"`;
            const url = `${process.env.NEXTAUTH_URL}/api/logs?project=${project}&context=${context}&filter_expr=${encodeURIComponent(filter_expr)}&limit=1`;

            const response = await fetch(url, {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: 'no-store',
            });

            if (response.status === 404) {
                console.warn(`[getContactIdByEmail] No contacts found for context '${context}'`);
                return null;
            }
            if (!response.ok) {
                console.error(`[getContactIdByEmail] Error response: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();
            const logsResponse = data as LogsResponseProps;
            const logs = logsResponse.logs as LogProps[];
            
            if (logs.length === 0) {
                console.warn(`[getContactIdByEmail] No contact found for email '${userEmail}' in context '${context}'`);
                return null;
            }

            const contactId = logs[0].entries?.contact_id;
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
 * @param ownerContext - The owner's context name (e.g., "JohnDoe")
 * @param assistantContext - The assistant's context name (e.g., "AdaLovelace")
 * @param contactId - The current user's contact_id (used for filtering)
 * @param beforeMessageId - Optional message ID for pagination
 * 
 * Filter: Shows messages sent by the current user OR assistant responses to the current user.
 * Role mapping: sender_id=0 (assistant) -> 'assistant', sender_id!=0 (humans) -> 'user'
 */
export const getTranscripts = async (apiKey: string) => {
    return async (ownerContext: string, assistantContext: string, contactId: number, beforeMessageId?: number): Promise<ChatMessage[] | ResponseProps> => {
        "use server";
        try {
            const project = "Assistants";
            const context = `${ownerContext}/${assistantContext}/Transcripts`;
            const limit = ASSISTANT_CHAT_LOADED_MESSAGES_COUNT;
            // Filter: messages sent BY this contact OR assistant responses TO this contact
            let filter_expr = `medium == "unify_message" and (sender_id == ${contactId} or (sender_id == 0 and ${contactId} in receiver_ids))`;
            if (beforeMessageId !== undefined) {
                filter_expr += ` and message_id < ${beforeMessageId}`;
            }
            let url = `${process.env.NEXTAUTH_URL}/api/logs?project=${project}&context=${context}&limit=${limit}&filter_expr=${encodeURIComponent(filter_expr)}`;

            const response = await fetch(url, {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: 'no-store',
            });

            if (response.status === 404) {
                console.warn(`[getTranscripts] No logs found for context '${context}', returning empty array.`);
                return [];
            }
            if (!response.ok) {
                let errorDetail = `Failed to get chat history with status ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                    const textError = await response.text();
                    console.error("[getTranscripts] Non-JSON error response from /api/logs:", textError);
                    errorDetail = textError || errorDetail;
                }
                console.error(`[getTranscripts] Error response: ${errorDetail}`);
                return { detail: errorDetail };
            }
            const data = await response.json();
            const logsResponse = data as LogsResponseProps;
            const mappedMessages = (logsResponse.logs as LogProps[])
                .map((log): ChatMessage | null => {
                    const { entries, id, timestamp } = log;
                    if (!entries || typeof entries.content !== 'string' || typeof entries.sender_id === 'undefined') {
                        console.warn("[getTranscripts] Skipping invalid log entry:", log);
                        return null;
                    }
                    return {
                        id: String(id),
                        // sender_id=0 is assistant, anything else is a human user
                        role: entries.sender_id === 0 ? 'assistant' : 'user',
                        content: entries.content,
                        timestamp: new Date(timestamp as string),
                        message_id: typeof entries.message_id === 'number' ? entries.message_id : undefined,
                    };
                })
                .filter((msg): msg is ChatMessage => msg !== null);
            return mappedMessages;

        } catch (error) {
            console.error(`[getTranscripts] CATCH block error for context '${assistantContext}':`, error);
            const message = error instanceof Error ? error.message : "Unknown error getting history.";
            return { detail: message };
        }
    };
};

export const messageAssistant = async (apiKey: string) => {
    return async (payload: UnifyMessage): Promise<ResponseProps & { info?: string }> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/message`, {
                method: "POST",
                headers: {
                    apiKey: apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || `Failed to send message: ${response.statusText}` };
            }
            return data as ResponseProps & { info?: string };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error sending message.";
            return { detail: message };
        }
    };
};

/**
 * Fetches a user's first and last name by their user ID.
 * Used as a fallback when assistant.user_first_name/user_last_name are missing.
 * 
 * @param userId - The user ID to look up
 * @returns Object with first_name and last_name, or null if lookup fails
 */
export const getAssistantOwnerById = async () => {
    return async (userId: string): Promise<{ first_name: string; last_name: string } | null> => {
        "use server";
        try {
            // Import here to avoid circular dependencies
            const { getUserByID } = await import("@/lib/user/user");
            const user = await getUserByID(userId);
            
            if (!user || !user.name) {
                console.warn(`[getAssistantOwnerById] User not found or missing name for ID: ${userId}`);
                return null;
            }
            
            return {
                first_name: user.name,
                last_name: user.last_name || '',
            };
        } catch (error) {
            console.error(`[getAssistantOwnerById] Error fetching user:`, error);
            return null;
        }
    };
};