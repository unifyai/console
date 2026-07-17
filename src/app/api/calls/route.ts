import { NextRequest } from 'next/server';
import { badRequest } from '../_utils/auth';
import { forwardToOrchestra } from '../chat/_utils/orchestra';

/** Call summaries transcribed by one assistant (most recent last). */
export async function GET(request: NextRequest) {
  const assistantId = request.nextUrl.searchParams.get('assistantId');
  if (!assistantId || isNaN(parseInt(assistantId, 10))) {
    return badRequest('assistantId query parameter is required');
  }

  const query = new URLSearchParams({ assistant_id: assistantId });
  const limit = request.nextUrl.searchParams.get('limit');
  if (limit) query.set('limit', limit);

  return forwardToOrchestra(request, '/calls', { method: 'GET', query });
}
