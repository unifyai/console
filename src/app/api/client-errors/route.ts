/**
 * Client-error sink.
 *
 * Receives error-boundary captures from the browser and writes them
 * straight to Cloud Run stdout via `console.error` so they're
 * queryable via `gcloud logging read` without depending on the
 * Orchestra `ConsoleDiagnostics` project being provisioned (the
 * existing `/api/client-logs` route forwards to Orchestra and
 * silently 404s today because `ConsoleDiagnostics` isn't initialised
 * for the platform system writer — see `assistant_jobs_api.py`'s
 * `ensure_project_exists` for the pattern that's missing here).
 *
 * Intentionally minimal: no Discord webhook, no Orchestra round-trip,
 * no PII beyond what the user's session already carries.  The single
 * job is to make Matt-style React #185 boundary hits land in
 * `gcloud logging read 'resource.type="cloud_run_revision"
 *   AND resource.labels.service_name="saas-web-app"
 *   AND textPayload=~"\\[ERROR_BOUNDARY\\]"'`
 * so on-call can correlate a ticket to a server-side stack frame
 * after the fact.
 *
 * Body shape mirrors the `clientLog('ERROR_BOUNDARY', …)` data so
 * callers can reuse the same object on both sides if they want.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/user/user';

// Bounded so a malicious / runaway client can't OOM the action with
// a multi-megabyte "stack trace".  Cloud Logging caps single entries
// at 256 KiB anyway; these defaults keep us well below that even
// after JSON-stringification.
const MAX_MESSAGE_LENGTH = 4096;
const MAX_STACK_LENGTH = 16_384;
const MAX_DIGEST_LENGTH = 256;
const MAX_PAGE_URL_LENGTH = 1024;

interface ErrorReportBody {
  digest?: string | null;
  message?: string | null;
  stack?: string | null;
  pageUrl?: string | null;
  userAgent?: string | null;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

export async function POST(request: NextRequest) {
  let body: ErrorReportBody;
  try {
    body = (await request.json()) as ErrorReportBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Auth is best-effort — we still log unauthenticated captures (the
  // boundary can fire on the login page) but session email, when
  // present, makes correlation to a support ticket trivial.  Reading
  // from session rather than trusting the body keeps the email
  // tamper-proof.
  let userEmail: string | null = null;
  try {
    const session = await getSession();
    userEmail = session?.user?.email ?? null;
  } catch {
    /* unauthenticated boundary capture — keep going */
  }

  // Single structured stdout line per capture.  The `[ERROR_BOUNDARY]`
  // prefix is the indexable token for filtering in Cloud Logging.
  // `console.error` rather than `console.log` so the entry gets
  // `severity: ERROR` in Cloud Run logs, which surfaces it in the
  // service's default error views without extra filtering.
  console.error(
    '[ERROR_BOUNDARY] ' +
      JSON.stringify({
        userEmail,
        digest: truncate(body.digest, MAX_DIGEST_LENGTH),
        message: truncate(body.message, MAX_MESSAGE_LENGTH),
        stack: truncate(body.stack, MAX_STACK_LENGTH),
        pageUrl: truncate(body.pageUrl, MAX_PAGE_URL_LENGTH),
        userAgent: truncate(body.userAgent, 256),
        // `Date.now()` rather than the client clock so timestamps
        // are comparable across reports and aligned with the rest
        // of the Cloud Logging stream.
        capturedAt: new Date().toISOString(),
      })
  );

  return NextResponse.json({ ok: true });
}
