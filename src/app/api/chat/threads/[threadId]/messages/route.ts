import { NextRequest } from 'next/server';
import { badRequest } from '../../../../_utils/auth';
import { forwardToOrchestra } from '../../../_utils/orchestra';

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

function parseThreadId(threadId: string): number | null {
  const parsed = parseInt(threadId, 10);
  return isNaN(parsed) ? null : parsed;
}

/** History for one unified chat-store thread (most recent last). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { threadId } = await params;
  const id = parseThreadId(threadId);
  if (id === null) {
    return badRequest('Invalid thread ID format. Must be an integer.');
  }

  const query = new URLSearchParams();
  const limit = request.nextUrl.searchParams.get('limit');
  const beforeId = request.nextUrl.searchParams.get('before_id');
  const afterId = request.nextUrl.searchParams.get('after_id');
  const q = request.nextUrl.searchParams.get('q');
  if (limit) query.set('limit', limit);
  if (beforeId) query.set('before_id', beforeId);
  if (afterId) query.set('after_id', afterId);
  if (q) query.set('q', q);

  return forwardToOrchestra(request, `/chat/threads/${id}/messages`, {
    method: 'GET',
    query,
  });
}

/** Post one message into a unified chat-store thread. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { threadId } = await params;
  const id = parseThreadId(threadId);
  if (id === null) {
    return badRequest('Invalid thread ID format. Must be an integer.');
  }

  let body: { content?: string; mentions?: unknown; attachments?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }
  const content = typeof body.content === 'string' ? body.content : '';
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!content.trim() && attachments.length === 0) {
    return badRequest('Missing content or attachments');
  }

  return forwardToOrchestra(request, `/chat/threads/${id}/messages`, {
    method: 'POST',
    body: {
      content,
      ...(body.mentions !== undefined ? { mentions: body.mentions } : {}),
      attachments,
    },
  });
}
