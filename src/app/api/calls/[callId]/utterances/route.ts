import { NextRequest } from 'next/server';
import { badRequest } from '../../../_utils/auth';
import { forwardToOrchestra } from '../../../chat/_utils/orchestra';

interface RouteParams {
  params: Promise<{ callId: string }>;
}

/** One assistant's transcript of a call (oldest first). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { callId } = await params;
  const assistantId = request.nextUrl.searchParams.get('assistantId');
  if (!callId || !assistantId || isNaN(parseInt(assistantId, 10))) {
    return badRequest('callId path and assistantId query parameter are required');
  }

  const query = new URLSearchParams({ assistant_id: assistantId });
  const limit = request.nextUrl.searchParams.get('limit');
  if (limit) query.set('limit', limit);

  return forwardToOrchestra(request, `/calls/${encodeURIComponent(callId)}/utterances`, {
    method: 'GET',
    query,
  });
}
