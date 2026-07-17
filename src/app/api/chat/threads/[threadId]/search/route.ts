import { NextRequest } from 'next/server';
import { badRequest } from '../../../../_utils/auth';
import { forwardToOrchestra } from '../../../_utils/orchestra';

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

/** Content search inside one unified chat-store thread (most recent first). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { threadId } = await params;
  const id = parseInt(threadId, 10);
  if (isNaN(id)) {
    return badRequest('Invalid thread ID format. Must be an integer.');
  }
  const query = new URLSearchParams();
  for (const key of ['q', 'sender_kind', 'after', 'before', 'has_attachments', 'limit', 'offset']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  if (!query.toString()) {
    return badRequest('Missing search filters');
  }

  return forwardToOrchestra(request, `/chat/threads/${id}/search`, {
    method: 'GET',
    query,
  });
}
