"use server";

import { getCurrentUser } from "@/lib/user/user";
import { ChatCompletionMessage, ChatCompletionRequest, ChatMessage, UnifyMessage } from "@/types/assistants/chat";
import { ResponseProps } from "@/types/common";
import { LogProps, LogsResponseProps } from "@/types/interfaces/logs";
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from "@/constants/assistants/settings";

export const getTranscripts = async (apiKey: string, userContext: string) => {
    return async (assistantContext: string, beforeMessageId?: number): Promise<ChatMessage[] | ResponseProps> => {
        "use server";
        try {
            const project = "Assistants";
            const context = `${userContext}/${assistantContext}/Transcripts`;
            const limit = ASSISTANT_CHAT_LOADED_MESSAGES_COUNT;
            let filter_expr = `medium == "unify_message" and (sender_id == 1 or sender_id == 0)`;
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
                        role: entries.sender_id === 1 ? 'user' : 'assistant',
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