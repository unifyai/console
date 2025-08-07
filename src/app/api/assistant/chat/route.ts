import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";
import { ChatCompletionMessage, ChatCompletionRequest } from "@/types/assistants/chat";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.apiKey) {
            return new NextResponse(JSON.stringify({ detail: "Unauthorized" }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const apiKey = user.apiKey;

        const { messages } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return new NextResponse(JSON.stringify({ detail: "Invalid request body: messages are required." }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' },
             });
        }

        const url = `${process.env.ORCHESTRA_URL}/v0/chat/completions`;
        const payload: ChatCompletionRequest = {
            model: "gpt-4o-mini@openai",
            messages,
            stream: true,
        };

        const orchestraResponse = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!orchestraResponse.ok) {
            const errorBody = await orchestraResponse.text();
            console.error(`[API /api/assistant/chat] Orchestra API Error: ${errorBody}`);
            // Specifically check for insufficient credits
            if (orchestraResponse.status === 402) {
                return new NextResponse(JSON.stringify({ detail: "INSUFFICIENT_CREDITS" }), {
                    status: 402,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new NextResponse(JSON.stringify({ detail: `Upstream API error: ${errorBody}` }), {
                status: orchestraResponse.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Use the globally available ReadableStream
        const stream = new ReadableStream({
            async start(controller) {
                const reader = orchestraResponse.body?.getReader();
                if (!reader) {
                    controller.close();
                    return;
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
                                controller.close();
                                return;
                            }
                            try {
                                const json = JSON.parse(data);
                                const content = json.choices?.[0]?.delta?.content;
                                if (content) {
                                    controller.enqueue(new TextEncoder().encode(content));
                                }
                            } catch (e) {
                                // Ignore JSON parsing errors for incomplete chunks
                            }
                        }
                    }
                }
                controller.close();
            },
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error) {
        console.error("[API /api/assistant/chat] Internal Server Error:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return new NextResponse(JSON.stringify({ detail: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}