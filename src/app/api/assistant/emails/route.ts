import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.GET('/v0/assistant');

    if (error) {
      const detail = (error as Record<string, unknown>)?.detail || 'Failed to fetch assistants';
      return NextResponse.json({ detail }, { status: response.status });
    }

    // Data is already transformed to camelCase by the client middleware
    const assistants = Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown>)?.info)
        ? (data as Record<string, unknown>).info
        : Array.isArray((data as Record<string, unknown>)?.results)
          ? (data as Record<string, unknown>).results
          : [];

    const emailsSet = new Set<string>();
    const emails: string[] = [];
    for (const a of assistants as Array<Record<string, unknown>>) {
      const email = a?.email;
      if (typeof email === 'string' && email.trim().length > 0 && !emailsSet.has(email)) {
        emailsSet.add(email);
        emails.push(email);
      }
    }
    return NextResponse.json({ emails });
  } catch (err) {
    console.error('[/api/assistant/emails] GET error', err);
    return NextResponse.json({ detail: 'Failed to list assistant emails' }, { status: 500 });
  }
}
