import { NextRequest, NextResponse } from 'next/server';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function POST(request: NextRequest) {
  const sharedKey = process.env.SHARED_UNIFY_KEY;
  if (!sharedKey) {
    console.error('[client-logs] SHARED_UNIFY_KEY not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: { assistantId?: string; contactId?: number; userEmail?: string; entries: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { assistantId, contactId, userEmail, entries } = body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'entries required' }, { status: 400 });
  }

  const sessionId = (entries[0] as Record<string, unknown>)?.sid;

  const client = createOrchestraClient(sharedKey);

  try {
    await client.POST('/v0/logs', {
      body: {
        project_name: 'ConsoleDiagnostics',
        context: { name: 'ChatClient' },
        entries: {
          assistantId: assistantId ?? 'unknown',
          contactId: contactId ?? null,
          sessionId: sessionId ?? 'unknown',
          userEmail: userEmail ?? 'unknown',
          events: entries,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to persist logs' }, { status: 502 });
  }
}
