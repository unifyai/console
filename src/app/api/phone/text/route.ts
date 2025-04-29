import { NextResponse } from 'next/server';
import { twiml } from 'twilio';
import { CoreMessage, generateText } from 'ai';
import { createUnifyProvider } from '@/lib/chat/unify-provider';

const unify = createUnifyProvider({ apiKey: "***REMOVED***"});

// export async function POST(req: Request) {
//   const { messages }: { messages: CoreMessage[] } = await req.json();
//   const { response } = await generateText({
//     model: unify('gpt-4o-mini@openai'),
//     system: 'You are a helpful assistant.',
//     messages,
//   });
  
//   return Response.json({ messages: response.messages });
// }



export async function POST(request: Request) {
    const formData = await request.formData();
    const body = formData.get('Body') || "";

    const messages: CoreMessage[] = [{role: 'user', content: body.toString() }];
    const { response } = await generateText({
        model: unify('gpt-4o-mini@openai'),
        system: 'You are a helpful assistant.',
        messages,
    });

    const firstContentPart = response.messages[0]?.content[0];
    const replyText = (typeof firstContentPart !== 'string' && 'text' in firstContentPart)
        ? firstContentPart.text.toString()
        : '';

    const messagingResponse = new twiml.MessagingResponse();
    messagingResponse.message(replyText);

    return new NextResponse(
        messagingResponse.toString(),
        {
            status: 200,
            headers: {
                'Content-Type': 'text/xml',
            },
        });
}
