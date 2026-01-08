import { CoreMessage, generateText } from 'ai';
import { createUnifyProvider } from '@/lib/chat/unify-provider';

const unify = createUnifyProvider({ apiKey: '***REMOVED***' });

export async function POST(req: Request) {
  const { messages }: { messages: CoreMessage[] } = await req.json();
  const { response } = await generateText({
    model: unify('gpt-4o-mini@openai'),
    system: 'You are a helpful assistant.',
    messages,
  });

  return Response.json({ messages: response.messages });
}
