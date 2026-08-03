import { NextResponse } from 'next/server';
import { buildConsoleGuidance } from '@/lib/agent-guidance/consoleGuidance';

/**
 * Console orientation text for the assistant runtime.
 *
 * Deliberately unauthenticated: the body is a description of this console's own
 * surfaces, identical for every caller and carrying no user, workspace, or
 * credential data. The runtime reads it from outside any browser session and so
 * has no cookie to present. Keep it that way — nothing user-scoped belongs in
 * this response.
 */
export async function GET() {
  const guidance = buildConsoleGuidance();
  return NextResponse.json(guidance, {
    headers: {
      // Fixed for a given deployment, so edge/proxy caching is safe and keeps
      // the runtime's session-start fetch off the critical path.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
}
