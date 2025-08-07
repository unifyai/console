"use server";

import { getCurrentUser } from "@/lib/user/user";
import { ChatCompletionMessage, ChatCompletionRequest } from "@/types/assistants/chat";

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