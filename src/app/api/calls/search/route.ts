import { NextRequest } from 'next/server';
import { badRequest } from '../../_utils/auth';
import { forwardToOrchestra } from '../../chat/_utils/orchestra';

/** Utterance content search across one assistant's calls (most recent first). */
export async function GET(request: NextRequest) {
  const assistantId = request.nextUrl.searchParams.get('assistantId');
  const q = request.nextUrl.searchParams.get('q');
  if (!assistantId || isNaN(parseInt(assistantId, 10)) || !q?.trim()) {
    return badRequest('assistantId and q query parameters are required');
  }

  const query = new URLSearchParams({ assistant_id: assistantId, q });
  const limit = request.nextUrl.searchParams.get('limit');
  const offset = request.nextUrl.searchParams.get('offset');
  if (limit) query.set('limit', limit);
  if (offset) query.set('offset', offset);

  return forwardToOrchestra(request, '/calls/utterances/search', { method: 'GET', query });
}
