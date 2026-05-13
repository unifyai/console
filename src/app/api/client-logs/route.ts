import { NextRequest, NextResponse } from 'next/server';
import { createOrchestraClient } from '@/lib/orchestra/client';

const PROJECT_NAME = 'ConsoleDiagnostics';
const CONTEXT_NAME = 'ChatClient';

// In-process cache of projects we've already verified.  Cloud Run
// instances are stateless across restarts, so each instance will
// attempt creation once on its first POST and then short-circuit for
// the rest of its lifetime.  Mirrors the pattern Unity uses for the
// `AssistantJobs` project — see
// `unity/conversation_manager/assistant_jobs_api.py::ensure_project_exists`.
const ensuredProjects = new Set<string>();

/**
 * Idempotent project provisioning.
 *
 * Orchestra's `POST /v0/project` accepts a name and either creates the
 * project or returns an error if it already exists.  We treat both
 * outcomes as success for caching purposes — the only thing we care
 * about is "we're confident this project exists from now on".
 *
 * On unexpected failures (network, auth, 5xx) we deliberately leave
 * the project *out* of the cache so the next request retries; we do
 * NOT throw, because a missing project should not block the existing
 * log-forward path from at least surfacing its own real error.
 */
async function ensureProject(
  client: ReturnType<typeof createOrchestraClient>,
  name: string
): Promise<void> {
  if (ensuredProjects.has(name)) return;

  try {
    const { error } = await client.POST('/v0/project', {
      body: { name, is_versioned: false },
    });
    if (!error) {
      ensuredProjects.add(name);
      return;
    }
    // Already-exists responses are the expected steady-state path
    // (every instance after the first successful create hits this).
    // Orchestra returns a 4xx with a "detail" message containing
    // either "exists" or "already" depending on the version — match
    // loosely so a wording change doesn't regress this.
    const detail = JSON.stringify(error).toLowerCase();
    if (detail.includes('exist') || detail.includes('already')) {
      ensuredProjects.add(name);
      return;
    }
    console.warn(`[client-logs] ensureProject(${name}) unexpected response:`, error);
  } catch (err) {
    console.warn(`[client-logs] ensureProject(${name}) threw:`, err);
  }
}

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

  // Lazy provision on the first request per Cloud Run instance.  No
  // separate startup hook is needed because this route is the only
  // writer to `ConsoleDiagnostics` and runs on the same instance as
  // any subsequent log POST.
  await ensureProject(client, PROJECT_NAME);

  try {
    await client.POST('/v0/logs', {
      body: {
        project_name: PROJECT_NAME,
        context: CONTEXT_NAME,
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
