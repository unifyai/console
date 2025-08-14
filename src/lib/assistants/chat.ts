"use server";

import { getCurrentUser } from "@/lib/user/user";
import { ChatCompletionMessage, ChatCompletionRequest, ChatMessage } from "@/types/assistants/chat";
import { ResponseProps } from "@/types/common";
import { LogProps, LogsResponseProps } from "@/types/interfaces/logs";

export const getTranscripts = async (apiKey: string) => {
    return async (assistantContext: string): Promise<ChatMessage[] | ResponseProps> => {
        "use server";
        try {
            const project = "Assistants";
            const context = `${assistantContext}/Transcripts`;
            const limit = 50;
            
            const url = `${process.env.NEXTAUTH_URL}/api/logs?project=${project}&context=${context}&&limit=${limit}`;

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

export const updateTranscripts = async (apiKey: string) => {
    return async (assistantContext: string, messages: Omit<ChatMessage, 'id'>[]): Promise<ResponseProps> => {
        "use server";
        if (messages.length === 0) return { info: "No messages to log." };
        
        try {
            const entries = messages.map(msg => ({
                sender_id: msg.role === 'user' ? 1 : 0,
                receiver_ids: [msg.role === 'user' ? 0 : 1],
                content: msg.content,
                medium: "unify_chat",
                timestamp: msg.timestamp.toISOString(),
                exchange_id: 0 as const,
            }));

            const project = "Assistants";
            const context = `${assistantContext}/Transcripts`;

            const payload = {
                project: project,
                context: context,
                params: {},
                entries: entries
            };
            
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs`,
                {
                    method: "POST",
                    headers: { 
                        apiKey: apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );
            
            const responseText = await response.text();
            
            if (!response.ok) {
                let errorDetail = `Failed to update history: ${response.statusText}`;
                try {
                    const errorData = JSON.parse(responseText);
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                     errorDetail = responseText || errorDetail;
                }
                console.error(`[updateTranscripts] Error response from /api/logs: ${errorDetail}`);
                return { detail: errorDetail };
            }

            const data = JSON.parse(responseText);
            return { info: data.info || "History updated successfully" };
        } catch (error) {
             console.error(`[updateTranscripts] CATCH block error for context '${assistantContext}':`, error);
             const message = error instanceof Error ? error.message : "Unknown error updating history.";
            return { detail: message };
        }
    };
};


export const streamAssistantPreviewChat = async function* (messages: ChatCompletionMessage[]): AsyncGenerator<string> {
    try {
        const user = await getCurrentUser();
        if (!user) {
            throw new Error("User not authenticated.");
        }
        const apiKey = user.apiKey;

        const url = `${process.env.ORCHESTRA_URL}/v0/chat/completions`;

        const payload: ChatCompletionRequest = {
            model: "gpt-4o-mini@openai",
            messages,
            stream: true,
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[chat.ts] API Error Response: ${errorBody}`);
            throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Failed to get response reader.");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; 

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.substring(6);
                    if (data.trim() === "[DONE]") {
                        return;
                    }
                    try {
                        const jsonChunk = JSON.parse(data);
                        const delta = jsonChunk.choices?.[0]?.delta?.content;
                        if (delta) {
                            yield delta;
                        }
                    } catch (e) {
                        console.error("[chat.ts] Failed to parse stream chunk:", data);
                    }
                }
            }
        }
    } catch (error) {
        // Log the full error on the server for debugging
        console.error("[chat.ts] Error during chat streaming:", error);
        // Throw only the serializable error message to the client
        if (error instanceof Error) {
            throw error.message;
        }
        throw "An unknown error occurred during the chat stream.";
    }
};