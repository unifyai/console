import { NextRequest } from 'next/server';
import { badRequest } from '../../../../../../_utils/auth';
import { forwardToOrchestra } from '../../../../../_utils/orchestra';

interface RouteParams {
  params: Promise<{ threadId: string; messageId: string }>;
}

/** Toggle the caller's emoji reaction on one chat message. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { threadId, messageId } = await params;
  const thread = parseInt(threadId, 10);
  const message = parseInt(messageId, 10);
  if (isNaN(thread) || isNaN(message)) {
    return badRequest('Invalid thread or message ID format. Must be integers.');
  }

  let body: { emoji?: string | null };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  return forwardToOrchestra(request, `/chat/threads/${thread}/messages/${message}/reactions`, {
    method: 'POST',
    body: { emoji: body.emoji ?? null },
  });
}
