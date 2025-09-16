import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";
import { getTranscripts } from "@/lib/assistants/chat";
import { ChatCompletionMessage, ChatCompletionRequest, ChatMessage } from "@/types/assistants/chat";

type ChatRequestType = 'hire' | 'profile' | 'post-hire-greeting';

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
        const userName = user.name || "the user";

        // `messages` here is the full client-side session history
        const { messages, assistantName, assistantAge, assistantBio, assistantRegion, assistantId, type, preHireChat } = await request.json();
        const chatType: ChatRequestType = type || 'hire';

        // generate post hire greeting
        if (chatType === 'post-hire-greeting') {
            const hasPreHireChat = preHireChat && Array.isArray(preHireChat) && preHireChat.length > 0;
            let greetingSystemPrompt: string;
            const displayName = assistantName.replace(/([A-Z])/g, ' $1').trim();

            if (hasPreHireChat) {
                // Case B: Hired with pre-hire chat
                const chatHistoryString = preHireChat.map((m: any) => `${m.role === 'user' ? userName : displayName}: ${m.content}`).join('\n');
                greetingSystemPrompt = `You are ${displayName}, a personal assistant for ${userName}. You were just hired after a brief chat with them. Here is your profile: Age ${assistantAge || 'ageless'}, from ${assistantRegion || 'an undisclosed location'}, and your bio is "${assistantBio || 'a helpful assistant'}". Here is the transcript of the pre-hire chat:\n\n${chatHistoryString}\n\nBased on your profile, bio, and this prior conversation, generate a short (2-3 sentences), friendly, and enthusiastic message to ${userName} expressing your excitement to start working together.`;
            } else {
                // Case A: Hired without pre-hire chat
                greetingSystemPrompt = `You are ${displayName}, a personal assistant for ${userName}. You were just hired. Your profile is: Age ${assistantAge || 'ageless'}, from ${assistantRegion || 'an undisclosed location'}, and your bio is "${assistantBio || 'a helpful assistant'}". Generate a friendly, welcoming first message (2-3 sentences) to ${userName}. In your message, mention that you're ready to get started and that they can reach you via this chat interface, by phone call, or by text message.`;
            }

            const greetingMessages: ChatCompletionMessage[] = [{ role: "system", content: greetingSystemPrompt }];

            const url = `${process.env.ORCHESTRA_URL}/v0/chat/completions`;
            const payload: ChatCompletionRequest = {
                model: "gpt-4o-mini@openai",
                messages: greetingMessages,
                stream: false, // This is a non-streaming request
            };

            const orchestraResponse = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify(payload),
            });

            const responseData = await orchestraResponse.json();

            if (!orchestraResponse.ok) {
                 console.error(`[API /api/assistant/chat GREETING] Orchestra API Error:`, responseData);
                 return new NextResponse(JSON.stringify({ detail: responseData.detail || "Upstream API error" }), {
                    status: orchestraResponse.status, headers: { 'Content-Type': 'application/json' },
                });
            }

            const content = responseData.choices?.[0]?.message?.content;
            return NextResponse.json({ content });
        }

        if (!messages || !Array.isArray(messages)) {
            return new NextResponse(JSON.stringify({ detail: "Invalid request body: messages are required." }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' },
             });
        }
        
        let systemPrompt: string;
        let finalMessages: ChatCompletionMessage[];

        if (chatType === 'profile') {
            if (!assistantId || !assistantName) {
                return new NextResponse(JSON.stringify({ detail: "assistantId and assistantName are required for profile chat." }), { status: 400 });
            }
            
            // Fetch recent history using the provided name context
            const getTranscriptsAction = await getTranscripts(apiKey);
            const historyResult = await getTranscriptsAction(assistantName);

            if ('detail' in historyResult) {
                // If fetching logs fails, use the client's session history as context.
                console.warn(`Could not fetch chat history for context '${assistantName}': ${historyResult.detail}. Using client-side history as fallback.`);
                finalMessages = messages;
            } else {
                // Combine historical logs with the latest user message.
                const historyMessages = historyResult as ChatMessage[];
                const historyCompletionMessages: ChatCompletionMessage[] = historyMessages.map(m => ({ role: m.role, content: m.content }));                
                const lastUserMessage = messages.slice(-1);                 
                finalMessages = [...historyCompletionMessages, ...lastUserMessage];
            }
            
            const bio = assistantBio || "a helpful assistant capable of handling any task";
            const age = assistantAge || 'ageless';
            const region = assistantRegion || 'an undisclosed location';
            const displayName = assistantName.replace(/([A-Z])/g, ' $1').trim();
            
            systemPrompt = `You are ${displayName}, a personal assistant for ${userName}. You are ${age} years old, from ${region} and described as ${bio}. You are currently chatting with ${userName} through a web interface but you also kept note of the recent messages you've exchanged across several mediums. You may use these notes as context for the discussion but because you don't have access to all your notes and memories when talking through the web interface, ${userName} may ask you about something you don't have context for. If it's a general world knowledge question, respond normally as you would, if it's a question related to a previous interaction, explain that you don't have all your notes currently and politely suggest that you hop on a call or text via phone.`;

        } else { // 'hire' type
            systemPrompt = `You are an assistant named ${assistantName || 'Assistant'}, who is ${assistantAge || 'ageless'}. You are speaking with ${userName}, who is considering hiring you as a general administrative assistant. Here is a bit about yourself: ${assistantBio || 'I am a diligent and capable assistant.'}. If ${userName} asks any questions about yourself, and this is not covered in the short bio above, then please just make up a sensible response to their question. If they ask what you're able to do, then explain that you can do anything that a very competent virtual administrative assistant can do. You have your own computer with your own mouse and keyboard, your own email address and phone number, and you are a fast learner who quickly learns from on-the-job experience. If the ${userName} is interested in pursuing further, then politely (not forcefully) suggest hiring in order to hop on an introductory call. If un-impressed, then it's a zero-hour contract so it's not a big deal.`;
            finalMessages = messages; // For hire chat, always use the client messages
        }

        const systemMessage: ChatCompletionMessage = {
            role: "system",
            content: systemPrompt
        };

        const messagesWithSystemPrompt = [systemMessage, ...finalMessages];

        const url = `${process.env.ORCHESTRA_URL}/v0/chat/completions`;
        const payload: ChatCompletionRequest = {
            model: "gpt-4o-mini@openai",
            messages: messagesWithSystemPrompt,
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