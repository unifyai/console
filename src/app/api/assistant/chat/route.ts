import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { ChatCompletionMessage, ChatCompletionRequest } from '@/types/assistants/chat';

type ChatRequestType = 'hire' | 'post-hire-greeting';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.apiKey) {
      return new NextResponse(JSON.stringify({ detail: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiKey = user.apiKey;
    const userName = `${user.name}${user.lastName}` || 'the user';

    // `messages` here is the full client-side session history
    const {
      messages,
      assistantName,
      assistantAge,
      assistantBio,
      assistantNationality,
      assistantId,
      type,
      preHireChat,
    } = await request.json();
    const chatType: ChatRequestType = type || 'hire';

    // This is now used BEFORE an assistant is hired to generate their first message
    if (chatType === 'post-hire-greeting') {
      const displayName = assistantName.replace(/([A-Z])/g, ' $1').trim();
      const greetingSystemPrompt = `You are ${displayName}, a personal assistant for ${userName}. You were just hired. Your profile is: Age ${assistantAge || 'ageless'}, from ${assistantNationality || 'an undisclosed location'}, and your bio is "${assistantBio || 'a helpful assistant'}". Generate a friendly, welcoming first message (2-3 sentences) to ${userName}. In your message, mention that you're ready to get started and that they can reach you via this chat interface, by phone call, or by text message.`;

      const greetingMessages: ChatCompletionMessage[] = [
        { role: 'system', content: greetingSystemPrompt },
      ];

      const url = `${process.env.ORCHESTRA_URL}/v0/chat/completions`;
      const payload: ChatCompletionRequest = {
        model: 'gpt-4o-mini@openai',
        messages: greetingMessages,
        stream: false, // This is a non-streaming request
      };

      const orchestraResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });

      const responseData = await orchestraResponse.json();

      if (!orchestraResponse.ok) {
        console.error(`[API /api/assistant/chat GREETING] Orchestra API Error:`, responseData);
        return new NextResponse(
          JSON.stringify({ detail: responseData.detail || 'Upstream API error' }),
          {
            status: orchestraResponse.status,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const content = responseData.choices?.[0]?.message?.content;
      return NextResponse.json({ content });
    }

    if (!messages || !Array.isArray(messages)) {
      return new NextResponse(
        JSON.stringify({ detail: 'Invalid request body: messages are required.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Only 'hire' type uses this streaming chat completion endpoint
    // Post-hire chat messages go through the /api/assistant/message endpoint with contact_id
    const systemPrompt = `You are an assistant named ${assistantName || 'Assistant'}, who is ${assistantAge || 'ageless'}. You are speaking with ${userName}, who is considering hiring you as a general administrative assistant. Here is a bit about yourself: ${assistantBio || 'I am a diligent and capable assistant.'}. If ${userName} asks any questions about yourself, and this is not covered in the short bio above, then please just make up a sensible response to their question. If they ask what you're able to do, then explain that you can do anything that a very competent virtual administrative assistant can do. You have your own computer with your own mouse and keyboard, your own email address and phone number, and you are a fast learner who quickly learns from on-the-job experience. If the ${userName} is interested in pursuing further, then politely (not forcefully) suggest hiring in order to hop on an introductory call. If un-impressed, then it's a zero-hour contract so it's not a big deal.`;
    const finalMessages: ChatCompletionMessage[] = messages;

    const systemMessage: ChatCompletionMessage = {
      role: 'system',
      content: systemPrompt,
    };

    const messagesWithSystemPrompt = [systemMessage, ...finalMessages];

    const url = `${process.env.ORCHESTRA_URL}/v0/chat/completions`;
    const payload: ChatCompletionRequest = {
      model: 'gpt-4o-mini@openai',
      messages: messagesWithSystemPrompt,
      stream: true,
    };

    const orchestraResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!orchestraResponse.ok) {
      const errorBody = await orchestraResponse.text();
      console.error(`[API /api/assistant/chat] Orchestra API Error: ${errorBody}`);
      if (orchestraResponse.status === 402) {
        return new NextResponse(JSON.stringify({ detail: 'INSUFFICIENT_CREDITS' }), {
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
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data.trim() === '[DONE]') {
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
    console.error('[API /api/assistant/chat] Internal Server Error:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new NextResponse(JSON.stringify({ detail: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
