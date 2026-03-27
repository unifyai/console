import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  let body: { assistantId?: string; contactId?: number; entries: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { assistantId, contactId, entries } = body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'entries required' }, { status: 400 });
  }

  const sessionId = (entries[0] as Record<string, unknown>)?.sid;

  const client = createOrchestraClient(apiKey);

  try {
    await client.POST('/v0/logs', {
      body: {
        project_name: 'ConsoleDiagnostics',
        context: { name: 'ChatClient' },
        entries: {
          assistantId: assistantId ?? 'unknown',
          contactId: contactId ?? null,
          sessionId: sessionId ?? 'unknown',
          events: entries,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to persist logs' }, { status: 502 });
  }
}
