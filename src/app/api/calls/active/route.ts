import { NextRequest } from 'next/server';
import { forwardToOrchestra } from '../../chat/_utils/orchestra';

/**
 * Live (ringing/active) call sessions that include the caller, across every
 * scope. Used by the app-level call engine to offer a rejoin after reload.
 */
export async function GET(request: NextRequest) {
  return forwardToOrchestra(request, '/calls/active', { method: 'GET' });
}
