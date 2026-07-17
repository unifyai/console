import { NextRequest } from 'next/server';
import { badRequest } from '../../../_utils/auth';
import { forwardToOrchestra } from '../../_utils/orchestra';

/** Get-or-create one unified chat-store thread by scope. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }
  if (typeof body.kind !== 'string') {
    return badRequest('kind is required');
  }
  return forwardToOrchestra(request, '/chat/threads/resolve', {
    method: 'POST',
    body,
  });
}
